import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma';
import { addDays } from '../../src/lib/time';
import { webhookToken } from '../../src/services/billing/billing.service';
import {
  app,
  as,
  createMaster,
  createSalon,
  dictionaries,
  resetDb,
  type Dictionaries,
} from '../helpers';

let dict: Dictionaries;

beforeAll(async () => {
  await resetDb();
  dict = await dictionaries();
});

const YOOKASSA_IP = '185.71.76.10';

function webhook(body: object, opts: { ip?: string; token?: string } = {}) {
  return request(app)
    .post(`/api/webhooks/yookassa?token=${opts.token ?? webhookToken()}`)
    .set('X-Forwarded-For', opts.ip ?? YOOKASSA_IP)
    .send(body);
}

describe('YooKassa webhook', () => {
  it('rejects requests from unknown IPs or with a bad token', async () => {
    const body = { type: 'notification', event: 'payment.succeeded', object: {} };
    expect((await webhook(body, { ip: '8.8.8.8' })).status).toBe(403);
    expect((await webhook(body, { token: 'deadbeef' })).status).toBe(403);
  });

  it('activates and extends the subscription once (idempotent)', async () => {
    const m = await createMaster(dict, { slug: 'pay-master' });
    const before = await prisma.master.findUniqueOrThrow({ where: { id: m.masterId } });
    const create = await as(m.token).post('/api/master/subscription/create-payment', {
      autoRenew: true,
    });
    expect(create.status).toBe(200);
    expect(create.body.amountRub).toBe(449);
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: create.body.paymentId },
    });
    const notification = {
      type: 'notification',
      event: 'payment.succeeded',
      object: {
        id: payment.externalId,
        status: 'succeeded',
        paid: true,
        amount: { value: '449.00', currency: 'RUB' },
        payment_method: { id: 'pm_123', saved: true, type: 'bank_card' },
      },
    };
    expect((await webhook(notification)).status).toBe(200);
    expect((await webhook(notification)).status).toBe(200);
    const after = await prisma.master.findUniqueOrThrow({ where: { id: m.masterId } });
    expect(after.status).toBe('ACTIVE');
    expect(after.yookassaPaymentMethodId).toBe('pm_123');
    expect(after.autoRenewEnabled).toBe(true);
    const expectedEnd = before.trialEndsAt!.getTime() + 30 * 86_400_000;
    expect(Math.abs(after.subscriptionEndsAt!.getTime() - expectedEnd)).toBeLessThan(5_000);
  });

  it('charges the salon price for salons', async () => {
    const s = await createSalon(dict, { slug: 'pay-salon' });
    const res = await as(s.token).post('/api/salon/subscription/create-payment', {
      autoRenew: false,
    });
    expect(res.body.amountRub).toBe(1249);
  });
});

describe('promo codes', () => {
  it('applies free days and discount codes once per tenant', async () => {
    const m = await createMaster(dict, { slug: 'promo-master' });
    await prisma.promoCode.createMany({
      data: [
        { code: 'DAYS10', type: 'FREE_DAYS', value: 10 },
        { code: 'OFF50', type: 'DISCOUNT_PERCENT', value: 50, maxUsages: 1 },
      ],
    });
    const before = (await prisma.master.findUniqueOrThrow({ where: { id: m.masterId } }))
      .trialEndsAt!;
    expect(
      (await as(m.token).post('/api/master/subscription/apply-promo', { code: 'days10' })).status,
    ).toBe(200);
    const after = (await prisma.master.findUniqueOrThrow({ where: { id: m.masterId } }))
      .trialEndsAt!;
    expect(after.getTime() - before.getTime()).toBe(10 * 86_400_000);
    expect(
      (await as(m.token).post('/api/master/subscription/apply-promo', { code: 'DAYS10' })).body
        .error.code,
    ).toBe('promoUsed');

    expect(
      (await as(m.token).post('/api/master/subscription/apply-promo', { code: 'OFF50' })).status,
    ).toBe(200);
    const sub = await as(m.token).get('/api/master/subscription');
    expect(sub.body.priceRub).toBe(224.5);
    const other = await createMaster(dict, { slug: 'promo-other' });
    expect(
      (await as(other.token).post('/api/master/subscription/apply-promo', { code: 'OFF50' })).body
        .error.code,
    ).toBe('promoExhausted');
  });
});

describe('master referral', () => {
  it('rewards both masters with bonus days after the first payment', async () => {
    const referrer = await createMaster(dict, { slug: 'ref-referrer', status: 'ACTIVE' });
    const referred = await createMaster(dict, { slug: 'ref-referred' });
    await prisma.masterReferral.create({
      data: { referrerId: referrer.masterId, referredId: referred.masterId, bonusDays: 14 },
    });
    const before = (await prisma.master.findUniqueOrThrow({ where: { id: referrer.masterId } }))
      .subscriptionEndsAt!;
    const create = await as(referred.token).post('/api/master/subscription/create-payment', {
      autoRenew: false,
    });
    const ok = await request(app).post(`/api/dev/mock-payments/${create.body.paymentId}/succeed`);
    expect(ok.status).toBe(200);
    const after = (await prisma.master.findUniqueOrThrow({ where: { id: referrer.masterId } }))
      .subscriptionEndsAt!;
    expect(after.getTime() - before.getTime()).toBe(14 * 86_400_000);
    expect(
      (await prisma.masterReferral.findUniqueOrThrow({ where: { referredId: referred.masterId } }))
        .rewardedAt,
    ).not.toBeNull();
  });
});

describe('salon membership', () => {
  it('covers members with the salon subscription and falls back after removal', async () => {
    const salon = await createSalon(dict, { slug: 'cover-salon' });
    const member = await createMaster(dict, {
      slug: 'cover-member',
      status: 'EXPIRED',
      salonId: salon.salonId,
    });
    expect((await as(member.token).get('/api/master/subscription')).body.coveredBySalon.id).toBe(
      salon.salonId,
    );
    expect(
      (await as(member.token).post('/api/master/services', { name: 'Ok', price: 1, duration: 30 }))
        .status,
    ).toBe(201);
    expect((await as(salon.token).delete(`/api/salon/masters/${member.masterId}`)).status).toBe(
      200,
    );
    const removed = await prisma.master.findUniqueOrThrow({ where: { id: member.masterId } });
    expect(removed.salonId).toBeNull();
    expect(
      (
        await as(member.token).post('/api/master/services', {
          name: 'Blocked',
          price: 1,
          duration: 30,
        })
      ).status,
    ).toBe(402);
    expect(await prisma.service.count({ where: { masterId: member.masterId } })).toBeGreaterThan(0);
  });

  it('joins a salon through an invite link', async () => {
    const salon = await createSalon(dict, { slug: 'join-salon' });
    const link = await as(salon.token).post('/api/salon/masters/invite-link', {});
    const m = await createMaster(dict, { slug: 'joiner' });
    const preview = await as(m.token).get(`/api/invites/${salon.salonId}/${link.body.code}`);
    expect(preview.body.invite.valid).toBe(true);
    expect(
      (await as(m.token).post(`/api/invites/${salon.salonId}/${link.body.code}/accept`)).status,
    ).toBe(200);
    expect((await prisma.master.findUniqueOrThrow({ where: { id: m.masterId } })).salonId).toBe(
      salon.salonId,
    );
    const masters = await as(salon.token).get('/api/salon/masters');
    expect(masters.body.map((x: { id: string }) => x.id)).toContain(m.masterId);
  });

  it('rejects expired invites', async () => {
    const salon = await createSalon(dict, { slug: 'old-invite-salon' });
    await prisma.salonInvite.create({
      data: {
        salonId: salon.salonId,
        inviteCode: 'OldCode123',
        expiresAt: addDays(new Date(), -1),
      },
    });
    const m = await createMaster(dict, { slug: 'late-joiner' });
    const res = await as(m.token).post(`/api/invites/${salon.salonId}/OldCode123/accept`);
    expect(res.body.error.code).toBe('inviteInvalid');
  });
});
