import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma';
import { drainDeferred } from '../../src/lib/deferred';
import { signInitData } from '../../src/lib/telegram';
import { clearOutbox, getOutbox } from '../../src/services/notifications/notifier';
import {
  app,
  as,
  createClientUser,
  createMaster,
  dictionaries,
  futureSlot,
  resetDb,
  type Dictionaries,
  type MasterFixture,
} from '../helpers';

let dict: Dictionaries;
let master: MasterFixture;

beforeAll(async () => {
  await resetDb();
  dict = await dictionaries();
  master = await createMaster(dict, { slug: 'book-master', allowMultiService: false });
});

async function firstSlot(token: string, slug = master.slug, serviceId = master.serviceIds[0]!) {
  const date = futureSlot(2, 12).toISOString().slice(0, 10);
  const res = await as(token).get(`/api/public/${slug}/slots?serviceIds=${serviceId}&date=${date}`);
  expect(res.status).toBe(200);
  return res.body.periods[0].slots[0].startAt as string;
}

describe('auth', () => {
  it('logs in with signed initData and refuses tampered data', async () => {
    const initData = signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: 777001, first_name: 'Ира', username: 'Ira_TG' }),
      },
      '123456:TEST-BOT-TOKEN',
    );
    const ok = await request(app).post('/api/auth/init').send({ initData });
    expect(ok.status).toBe(200);
    expect(ok.body.me.user.username).toBe('ira_tg');
    const bad = await request(app)
      .post('/api/auth/init')
      .send({ initData: initData.replace('Ira_TG', 'root') });
    expect(bad.status).toBe(401);
  });

  it('marks the configured Telegram id as platform owner', async () => {
    const initData = signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: 999000, first_name: 'Owner' }),
      },
      '123456:TEST-BOT-TOKEN',
    );
    const res = await request(app).post('/api/auth/init').send({ initData });
    expect(res.body.me.isOwner).toBe(true);
    expect((await as(res.body.token).get('/api/admin/stats')).status).toBe(200);
  });

  it('keeps dev login disabled outside development', async () => {
    const res = await request(app).post('/api/auth/dev-login').send({ telegramId: 1 });
    expect(res.status).toBe(403);
  });
});

describe('booking', () => {
  it('creates a booking and saves form contacts only to the master-local client', async () => {
    const { user, token } = await createClientUser({ firstName: 'Анна', phone: '+79161112233' });
    const startAt = await firstSlot(token);
    clearOutbox();
    const res = await as(token).post(`/api/public/${master.slug}/appointments`, {
      serviceIds: [master.serviceIds[0]],
      startAt,
      contact: {
        firstName: 'Анечка',
        phone: '8 (916) 999-88-77',
        phoneCountry: 'RU',
        username: '@Anna_New',
      },
      comment: 'Нюд',
    });
    expect(res.status).toBe(201);
    expect(res.body.appointment.status).toBe('PENDING');
    expect(res.body.icsUrl).toContain('/api/files/ics/');

    const profile = await prisma.clientProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.firstName).toBe('Анна');
    expect(profile.phone).toBe('+79161112233');
    const client = await prisma.client.findFirstOrThrow({
      where: { masterId: master.masterId, userId: user.id },
    });
    expect(client.firstName).toBe('Анечка');
    expect(client.phone).toBe('+79169998877');
    expect(client.username).toBe('anna_new');

    await drainDeferred();
    const kinds = getOutbox().map((m) => m.kind);
    expect(kinds).toContain('master.newAppointment');
    expect(kinds).toContain('client.bookingCreated');

    const ics = await request(app).get(new URL(res.body.icsUrl).pathname);
    expect(ics.status).toBe(200);
    expect(ics.text).toContain('BEGIN:VEVENT');
  });

  it('prefills contacts from the local client first, then the global profile', async () => {
    const { token } = await createClientUser({ firstName: 'Глобальная', phone: '+79160000099' });
    const before = await as(token).post(`/api/public/${master.slug}/check-access`);
    expect(before.body.contact.firstName).toBe('Глобальная');
    const startAt = await firstSlot(token);
    await as(token).post(`/api/public/${master.slug}/appointments`, {
      serviceIds: [master.serviceIds[0]],
      startAt,
      contact: { firstName: 'Локальная', phone: '+79160000099' },
    });
    const after = await as(token).post(`/api/public/${master.slug}/check-access`);
    expect(after.body.contact.firstName).toBe('Локальная');
  });

  it('rejects a slot that was just taken', async () => {
    const one = await createClientUser();
    const two = await createClientUser();
    const startAt = await firstSlot(one.token);
    const body = {
      serviceIds: [master.serviceIds[0]],
      startAt,
      contact: { firstName: 'X', phone: '+79161230000' },
    };
    expect((await as(one.token).post(`/api/public/${master.slug}/appointments`, body)).status).toBe(
      201,
    );
    const second = await as(two.token).post(`/api/public/${master.slug}/appointments`, body);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('slotTaken');
  });

  it('refuses several services when the master disabled multi-service booking', async () => {
    const { token } = await createClientUser();
    const startAt = await firstSlot(token);
    const res = await as(token).post(`/api/public/${master.slug}/appointments`, {
      serviceIds: master.serviceIds,
      startAt,
      contact: { firstName: 'X', phone: '+79161230001' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('multiServiceDisabled');
  });

  it('requires a completed client onboarding', async () => {
    const res = await request(app)
      .post(`/api/public/${master.slug}/appointments`)
      .set('Authorization', `Bearer ${(await createClientUser()).token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('blacklist', () => {
  it('hides real content and blocks booking by case-insensitive username', async () => {
    const m = await createMaster(dict, { slug: 'bl-master' });
    await prisma.blacklistEntry.create({ data: { masterId: m.masterId, username: 'bad_guy' } });
    const { token } = await createClientUser({ username: 'Bad_Guy' });
    const page = await as(token).get(`/api/public/${m.slug}`);
    expect(page.body.kind).toBe('blocked');
    expect(JSON.stringify(page.body)).not.toContain(m.serviceIds[0]);
    expect(JSON.stringify(page.body)).not.toContain('bad_guy');
    const slots = await as(token).get(
      `/api/public/${m.slug}/slots?serviceIds=${m.serviceIds[0]}&date=2030-01-01`,
    );
    expect(slots.status).toBe(404);
  });

  it('blocks on submit by a normalized phone typed in the form', async () => {
    const m = await createMaster(dict, { slug: 'bl-phone' });
    await prisma.blacklistEntry.create({ data: { masterId: m.masterId, phone: '+79165554433' } });
    const { token } = await createClientUser({ phone: '+79160001111' });
    const startAt = await firstSlot(token, m.slug, m.serviceIds[0]!);
    const res = await as(token).post(`/api/public/${m.slug}/appointments`, {
      serviceIds: [m.serviceIds[0]],
      startAt,
      contact: { firstName: 'X', phone: '8 916 555 44 33', phoneCountry: 'RU' },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('blocked');
    expect(await prisma.appointment.count({ where: { masterId: m.masterId } })).toBe(0);
  });
});

describe('subscription status gating', () => {
  it('hides expired masters from search and shows the stub page', async () => {
    const m = await createMaster(dict, { slug: 'expired-master', status: 'EXPIRED' });
    const { token } = await createClientUser();
    const search = await as(token).get('/api/search/masters?pageSize=50');
    expect(search.body.items.map((i: { slug: string }) => i.slug)).not.toContain(m.slug);
    expect((await as(token).get(`/api/public/${m.slug}`)).body.kind).toBe('expired');
  });

  it('makes the cabinet read-only after expiry and keeps export available', async () => {
    const m = await createMaster(dict, { slug: 'readonly-master', status: 'EXPIRED' });
    expect((await as(m.token).get('/api/master/services')).status).toBe(200);
    const write = await as(m.token).post('/api/master/services', {
      name: 'New',
      price: 1,
      duration: 30,
    });
    expect(write.status).toBe(402);
    expect((await as(m.token).post('/api/master/export/link', { entity: 'clients' })).status).toBe(
      200,
    );
  });

  it('banned masters can only export and see the subscription', async () => {
    const m = await createMaster(dict, { slug: 'banned-master', status: 'BANNED' });
    expect((await as(m.token).get('/api/master/services')).status).toBe(403);
    expect((await as(m.token).get('/api/master/subscription')).status).toBe(200);
    expect(
      (await as(m.token).post('/api/master/export/link', { entity: 'appointments' })).status,
    ).toBe(200);
  });
});
