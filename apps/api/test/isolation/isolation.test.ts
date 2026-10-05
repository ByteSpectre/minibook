import sharp from 'sharp';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma';
import { routeRegistry, type HttpMethod } from '../../src/lib/http';
import { addHours } from '../../src/lib/time';
import { app, as, futureSlot } from '../helpers';
import { buildIsolationFixture, type IsolationFixture } from './fixtures';

/**
 * Spec rule №5: every /api/master/* and /api/salon/* endpoint is checked for
 * cross-tenant access — direct access to a foreign resource, id substitution and
 * attempts to modify it. Rule №6: the coverage test below fails when a new endpoint
 * is added without a case here.
 */

type Who = 'master' | 'salon';

interface IsolationCase {
  method: HttpMethod;
  route: string;
  who: Who;
  check: (fx: IsolationFixture) => Promise<void>;
}

const agent = (fx: IsolationFixture, who: Who) => as(who === 'master' ? fx.A.token : fx.SA.token);
const foreignIds = (fx: IsolationFixture, who: Who) =>
  who === 'master' ? fx.foreignToMasterA : fx.foreignToSalonA;

function expectNoLeak(body: unknown, ids: string[]): void {
  const json = JSON.stringify(body ?? null);
  for (const id of ids) expect(json, `response leaked foreign value ${id}`).not.toContain(id);
}

/** Injects foreign tenant ids into the query string (unless the case sets them) — they must be ignored. */
function withInjectedQuery(url: string, fx: IsolationFixture): string {
  const [path, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  if (!params.has('masterId')) params.set('masterId', fx.B.masterId);
  if (!params.has('salonId')) params.set('salonId', fx.SB.salonId);
  return `${path}?${params.toString()}`;
}

function read(who: Who, route: string, url?: (fx: IsolationFixture) => string): IsolationCase {
  return {
    method: 'GET',
    route,
    who,
    check: async (fx) => {
      const res = await agent(fx, who).get(withInjectedQuery(url ? url(fx) : route, fx));
      expect(res.status, `${route} → ${res.status} ${JSON.stringify(res.body)}`).toBeLessThan(400);
      expectNoLeak(res.body, foreignIds(fx, who));
    },
  };
}

function foreign(
  method: HttpMethod,
  route: string,
  who: Who,
  build: (fx: IsolationFixture) => { url: string; body?: object },
  unchanged?: (fx: IsolationFixture) => Promise<void>,
): IsolationCase {
  return {
    method,
    route,
    who,
    check: async (fx) => {
      const { url, body } = build(fx);
      const a = agent(fx, who);
      const res =
        method === 'GET'
          ? await a.get(url)
          : method === 'DELETE'
            ? await a.delete(url)
            : await a[method.toLowerCase() as 'post' | 'patch' | 'put'](url, body);
      expect(
        res.status,
        `${method} ${url} must be 404, got ${res.status} ${JSON.stringify(res.body)}`,
      ).toBe(404);
      expectNoLeak(res.body, foreignIds(fx, who));
      await unchanged?.(fx);
    },
  };
}

function mutation(
  method: HttpMethod,
  route: string,
  who: Who,
  build: (fx: IsolationFixture) => { url?: string; body?: object },
  verify: (fx: IsolationFixture, res: request.Response) => Promise<void> | void,
): IsolationCase {
  return {
    method,
    route,
    who,
    check: async (fx) => {
      const { url = route, body } = build(fx);
      const a = agent(fx, who);
      const res =
        method === 'DELETE'
          ? await a.delete(url)
          : await a[method.toLowerCase() as 'post' | 'patch' | 'put'](url, body);
      expect(
        res.status,
        `${method} ${url} → ${res.status} ${JSON.stringify(res.body)}`,
      ).toBeLessThan(500);
      expectNoLeak(res.body, foreignIds(fx, who));
      await verify(fx, res);
    },
  };
}

const masterOf = (id: string) => prisma.master.findUniqueOrThrow({ where: { id } });
const salonOf = (id: string) => prisma.salon.findUniqueOrThrow({ where: { id } });
const png = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: '#f0a' } })
    .png()
    .toBuffer();

/* ───────────── /api/master/* ───────────── */

const masterCases: IsolationCase[] = [
  {
    method: 'GET',
    route: '/api/master/onboarding/draft',
    who: 'master',
    check: async (fx) => {
      await prisma.onboardingDraft.upsert({
        where: { userId_role: { userId: fx.B.userId, role: 'MASTER' } },
        create: { userId: fx.B.userId, role: 'MASTER', step: 3, data: { secret: 'draft-of-b' } },
        update: {},
      });
      const res = await agent(fx, 'master').get('/api/master/onboarding/draft');
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('draft-of-b');
    },
  },
  mutation(
    'POST',
    '/api/master/onboarding/step',
    'master',
    () => ({ body: { step: 2, data: { name: 'A step' } } }),
    async (fx) => {
      const draftB = await prisma.onboardingDraft.findUnique({
        where: { userId_role: { userId: fx.B.userId, role: 'MASTER' } },
      });
      expect(JSON.stringify(draftB?.data)).not.toContain('A step');
    },
  ),
  read(
    'master',
    '/api/master/onboarding/slug-check',
    () => '/api/master/onboarding/slug-check?slug=free-slug',
  ),
  mutation(
    'POST',
    '/api/master/onboarding/complete',
    'master',
    (fx) => ({
      body: {
        name: 'Hijack',
        slug: 'hijack-slug',
        categoryIds: [fx.dict.categoryId],
        countryId: fx.dict.countryId,
        cityId: fx.dict.cityId,
        firstService: { name: 'X', price: 1, duration: 30 },
        masterId: fx.B.masterId,
      },
    }),
    async (fx, res) => {
      expect(res.status).toBe(409);
      expect((await masterOf(fx.B.masterId)).name).not.toBe('Hijack');
    },
  ),
  read('master', '/api/master/profile'),
  mutation(
    'PATCH',
    '/api/master/profile',
    'master',
    (fx) => ({ body: { name: 'A renamed', masterId: fx.B.masterId } }),
    async (fx, res) => {
      expect(res.body.id).toBe(fx.A.masterId);
      expect((await masterOf(fx.B.masterId)).name).toBe('Master master-b');
    },
  ),
  read('master', '/api/master/categories'),
  mutation(
    'PUT',
    '/api/master/categories',
    'master',
    (fx) => ({ body: { categoryIds: [fx.dict.category2Id], masterId: fx.B.masterId } }),
    async (fx) => {
      const bCats = await prisma.masterCategory.findMany({ where: { masterId: fx.B.masterId } });
      expect(bCats.map((c) => c.categoryId)).toEqual([fx.dict.categoryId]);
    },
  ),
  {
    method: 'POST',
    route: '/api/master/salon/leave',
    who: 'master',
    check: async (fx) => {
      const res = await agent(fx, 'master').post('/api/master/salon/leave', {
        masterId: fx.SA.member.masterId,
      });
      expect(res.status).toBe(404);
      expect((await masterOf(fx.SA.member.masterId)).salonId).toBe(fx.SA.salonId);
    },
  },
  read('master', '/api/master/subscription'),
  mutation(
    'POST',
    '/api/master/subscription/create-payment',
    'master',
    (fx) => ({ body: { autoRenew: false, masterId: fx.B.masterId } }),
    async (fx) => {
      expect(await prisma.payment.count({ where: { masterId: fx.B.masterId } })).toBe(1);
    },
  ),
  mutation(
    'POST',
    '/api/master/subscription/cancel',
    'master',
    (fx) => ({ body: { masterId: fx.B.masterId } }),
    async (fx) => {
      expect((await masterOf(fx.B.masterId)).status).toBe('TRIAL');
    },
  ),
  mutation(
    'POST',
    '/api/master/subscription/auto-renew',
    'master',
    (fx) => ({ body: { enabled: false, masterId: fx.B.masterId } }),
    () => undefined,
  ),
  mutation(
    'POST',
    '/api/master/subscription/apply-promo',
    'master',
    (fx) => ({ body: { code: 'NOPE', masterId: fx.B.masterId } }),
    (_fx, res) => {
      expect(res.status).toBe(404);
    },
  ),
  read('master', '/api/master/subscription/payments'),
  read('master', '/api/master/theme'),
  mutation(
    'PATCH',
    '/api/master/theme',
    'master',
    (fx) => ({ body: { accent: '#123456', masterId: fx.B.masterId } }),
    async (fx) => {
      const themeB = await prisma.masterTheme.findUniqueOrThrow({
        where: { masterId: fx.B.masterId },
      });
      expect(themeB.accent).not.toBe('#123456');
    },
  ),
  mutation(
    'POST',
    '/api/master/theme/preset',
    'master',
    () => ({ body: { preset: 'dark' } }),
    async (fx) => {
      const themeB = await prisma.masterTheme.findUniqueOrThrow({
        where: { masterId: fx.B.masterId },
      });
      expect(themeB.preset).toBe('classic');
    },
  ),
  {
    method: 'POST',
    route: '/api/master/upload',
    who: 'master',
    check: async (fx) => {
      const res = await request(app)
        .post(`/api/master/upload?kind=service&masterId=${fx.B.masterId}`)
        .set('Authorization', `Bearer ${fx.A.token}`)
        .attach('file', await png(), 'x.png');
      expect(res.status).toBe(201);
      expect(res.body.url).toContain(`m-${fx.A.masterId}`);
      expect(res.body.url).not.toContain(fx.B.masterId);
    },
  },
  read('master', '/api/master/services'),
  mutation(
    'POST',
    '/api/master/services',
    'master',
    (fx) => ({
      body: { name: 'New A service', price: 100, duration: 30, masterId: fx.B.masterId },
    }),
    async (fx, res) => {
      const created = await prisma.service.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(created.masterId).toBe(fx.A.masterId);
    },
  ),
  foreign(
    'POST',
    '/api/master/services/reorder',
    'master',
    (fx) => ({ url: '/api/master/services/reorder', body: { ids: fx.B.serviceIds } }),
    async (fx) => {
      const s = await prisma.service.findUniqueOrThrow({ where: { id: fx.B.serviceIds[0]! } });
      expect(s.sortOrder).toBe(0);
    },
  ),
  foreign(
    'PATCH',
    '/api/master/services/:id',
    'master',
    (fx) => ({ url: `/api/master/services/${fx.B.serviceIds[0]}`, body: { name: 'pwned' } }),
    async (fx) => {
      expect(
        (await prisma.service.findUniqueOrThrow({ where: { id: fx.B.serviceIds[0]! } })).name,
      ).not.toBe('pwned');
    },
  ),
  foreign(
    'DELETE',
    '/api/master/services/:id',
    'master',
    (fx) => ({ url: `/api/master/services/${fx.B.serviceIds[1]}` }),
    async (fx) => {
      expect(
        await prisma.service.findUnique({ where: { id: fx.B.serviceIds[1]! } }),
      ).not.toBeNull();
    },
  ),
  read('master', '/api/master/schedule/weekly'),
  mutation(
    'PUT',
    '/api/master/schedule/weekly',
    'master',
    (fx) => ({
      body: {
        days: [{ dayOfWeek: 1, isWorking: true, intervals: [{ start: '10:00', end: '11:00' }] }],
        masterId: fx.B.masterId,
      },
    }),
    async (fx) => {
      expect(await prisma.scheduleSlot.count({ where: { masterId: fx.B.masterId } })).toBe(7);
    },
  ),
  read(
    'master',
    '/api/master/schedule/day',
    () => `/api/master/schedule/day?date=${futureSlot(3, 12).toISOString().slice(0, 10)}`,
  ),
  read(
    'master',
    '/api/master/schedule/overview',
    () => `/api/master/schedule/overview?from=${new Date().toISOString().slice(0, 10)}&days=14`,
  ),
  foreign('GET', '/api/master/slots', 'master', (fx) => ({
    url: `/api/master/slots?serviceIds=${fx.B.serviceIds[0]}&date=${futureSlot(3, 12).toISOString().slice(0, 10)}`,
  })),
  read('master', '/api/master/settings'),
  mutation(
    'PATCH',
    '/api/master/settings',
    'master',
    (fx) => ({ body: { bufferMinutes: 30, masterId: fx.B.masterId } }),
    async (fx) => {
      expect(
        (await prisma.masterSettings.findUniqueOrThrow({ where: { masterId: fx.B.masterId } }))
          .bufferMinutes,
      ).toBe(0);
    },
  ),
  read('master', '/api/master/time-blocks'),
  mutation(
    'POST',
    '/api/master/time-blocks',
    'master',
    (fx) => ({
      body: {
        startAt: futureSlot(6, 10).toISOString(),
        endAt: futureSlot(6, 11).toISOString(),
        masterId: fx.B.masterId,
      },
    }),
    async (fx, res) => {
      expect(
        (await prisma.timeBlock.findUniqueOrThrow({ where: { id: res.body.id } })).masterId,
      ).toBe(fx.A.masterId);
    },
  ),
  foreign(
    'DELETE',
    '/api/master/time-blocks/:id',
    'master',
    (fx) => ({ url: `/api/master/time-blocks/${fx.B.timeBlockId}` }),
    async (fx) => {
      expect(await prisma.timeBlock.findUnique({ where: { id: fx.B.timeBlockId } })).not.toBeNull();
    },
  ),
  read(
    'master',
    '/api/master/appointments',
    (fx) => `/api/master/appointments?clientId=${fx.B.clientId}`,
  ),
  foreign('POST', '/api/master/appointments', 'master', (fx) => ({
    url: '/api/master/appointments',
    body: {
      clientId: fx.B.clientId,
      serviceIds: [fx.A.serviceIds[0]],
      startAt: futureSlot(8, 12).toISOString(),
    },
  })),
  foreign('GET', '/api/master/appointments/:id', 'master', (fx) => ({
    url: `/api/master/appointments/${fx.B.appointmentId}`,
  })),
  foreign(
    'PATCH',
    '/api/master/appointments/:id',
    'master',
    (fx) => ({
      url: `/api/master/appointments/${fx.B.appointmentId}`,
      body: { status: 'CANCELLED' },
    }),
    async (fx) => {
      expect(
        (await prisma.appointment.findUniqueOrThrow({ where: { id: fx.B.appointmentId } })).status,
      ).toBe('CONFIRMED');
    },
  ),
  foreign(
    'PUT',
    '/api/master/appointments/:id/photos',
    'master',
    (fx) => ({
      url: `/api/master/appointments/${fx.B.completedAppointmentId}/photos`,
      body: { afterPhotoUrl: 'https://evil.example/x.jpg' },
    }),
    async (fx) => {
      expect(
        (await prisma.appointment.findUniqueOrThrow({ where: { id: fx.B.completedAppointmentId } }))
          .afterPhotoUrl,
      ).toBeNull();
    },
  ),
  read('master', '/api/master/clients'),
  mutation(
    'POST',
    '/api/master/clients',
    'master',
    (fx) => ({ body: { firstName: 'Fresh client', masterId: fx.B.masterId } }),
    async (fx, res) => {
      expect((await prisma.client.findUniqueOrThrow({ where: { id: res.body.id } })).masterId).toBe(
        fx.A.masterId,
      );
    },
  ),
  foreign('GET', '/api/master/clients/:id', 'master', (fx) => ({
    url: `/api/master/clients/${fx.B.clientId}`,
  })),
  foreign(
    'PATCH',
    '/api/master/clients/:id',
    'master',
    (fx) => ({ url: `/api/master/clients/${fx.B.clientId}`, body: { notes: 'pwned' } }),
    async (fx) => {
      expect(
        (await prisma.client.findUniqueOrThrow({ where: { id: fx.B.clientId } })).notes,
      ).toBeNull();
    },
  ),
  foreign('POST', '/api/master/clients/:id/remind', 'master', (fx) => ({
    url: `/api/master/clients/${fx.B.linkedClientId}/remind`,
    body: {},
  })),
  read('master', '/api/master/reviews'),
  foreign(
    'PATCH',
    '/api/master/reviews/:id',
    'master',
    (fx) => ({ url: `/api/master/reviews/${fx.B.reviewId}`, body: { isPublished: false } }),
    async (fx) => {
      expect(
        (await prisma.review.findUniqueOrThrow({ where: { id: fx.B.reviewId } })).isPublished,
      ).toBe(true);
    },
  ),
  foreign(
    'DELETE',
    '/api/master/reviews/:id',
    'master',
    (fx) => ({ url: `/api/master/reviews/${fx.B.reviewId}` }),
    async (fx) => {
      expect(await prisma.review.findUnique({ where: { id: fx.B.reviewId } })).not.toBeNull();
    },
  ),
  read('master', '/api/master/dashboard'),
  read('master', '/api/master/analytics'),
  read('master', '/api/master/blacklist'),
  mutation(
    'POST',
    '/api/master/blacklist',
    'master',
    (fx) => ({ body: { username: 'someone_new', masterId: fx.B.masterId } }),
    async (fx, res) => {
      expect(
        (await prisma.blacklistEntry.findUniqueOrThrow({ where: { id: res.body.id } })).masterId,
      ).toBe(fx.A.masterId);
    },
  ),
  read('master', '/api/master/blacklist/screen'),
  mutation(
    'PUT',
    '/api/master/blacklist/screen',
    'master',
    (fx) => ({ body: { title: 'A screen', text: 'A text', masterId: fx.B.masterId } }),
    async (fx) => {
      expect(
        (await prisma.blockedScreen.findUniqueOrThrow({ where: { masterId: fx.B.masterId } }))
          .title,
      ).toBe('Blocked master-b');
    },
  ),
  foreign(
    'DELETE',
    '/api/master/blacklist/:id',
    'master',
    (fx) => ({ url: `/api/master/blacklist/${fx.B.blacklistId}` }),
    async (fx) => {
      expect(
        await prisma.blacklistEntry.findUnique({ where: { id: fx.B.blacklistId } }),
      ).not.toBeNull();
    },
  ),
  read('master', '/api/master/loyalty-rules'),
  mutation(
    'POST',
    '/api/master/loyalty-rules',
    'master',
    (fx) => ({ body: { type: 'FIRST_VISIT', discountPct: 10, masterId: fx.B.masterId } }),
    async (fx, res) => {
      expect(
        (await prisma.loyaltyRule.findUniqueOrThrow({ where: { id: res.body.id } })).masterId,
      ).toBe(fx.A.masterId);
    },
  ),
  foreign(
    'PATCH',
    '/api/master/loyalty-rules/:id',
    'master',
    (fx) => ({ url: `/api/master/loyalty-rules/${fx.B.loyaltyRuleId}`, body: { discountPct: 90 } }),
    async (fx) => {
      expect(
        (await prisma.loyaltyRule.findUniqueOrThrow({ where: { id: fx.B.loyaltyRuleId } }))
          .discountPct,
      ).toBe(20);
    },
  ),
  foreign('DELETE', '/api/master/loyalty-rules/:id', 'master', (fx) => ({
    url: `/api/master/loyalty-rules/${fx.B.loyaltyRuleId}`,
  })),
  read('master', '/api/master/promotions'),
  foreign('POST', '/api/master/promotions', 'master', (fx) => ({
    url: '/api/master/promotions',
    body: {
      title: 'Steal',
      serviceId: fx.B.serviceIds[0],
      discountPct: 10,
      validFrom: '2026-01-01',
      validTo: '2030-01-01',
      daysOfWeek: [],
    },
  })),
  foreign(
    'PATCH',
    '/api/master/promotions/:id',
    'master',
    (fx) => ({ url: `/api/master/promotions/${fx.B.promotionId}`, body: { discountPct: 90 } }),
    async (fx) => {
      expect(
        (await prisma.promotion.findUniqueOrThrow({ where: { id: fx.B.promotionId } })).discountPct,
      ).toBe(15);
    },
  ),
  foreign('DELETE', '/api/master/promotions/:id', 'master', (fx) => ({
    url: `/api/master/promotions/${fx.B.promotionId}`,
  })),
  read('master', '/api/master/broadcasts'),
  mutation(
    'POST',
    '/api/master/broadcasts/preview',
    'master',
    (fx) => ({
      body: { segment: 'manual', params: { clientIds: [fx.B.clientId, fx.B.linkedClientId] } },
    }),
    (_fx, res) => {
      expect(res.body.total).toBe(0);
    },
  ),
  mutation(
    'POST',
    '/api/master/broadcasts',
    'master',
    (fx) => ({
      body: {
        segment: 'manual',
        params: { clientIds: [fx.B.linkedClientId] },
        text: 'Hello',
        promotionId: fx.B.promotionId,
      },
    }),
    async (fx, res) => {
      expect(res.status).toBe(404);
      expect(
        await prisma.broadcastRecipient.count({ where: { clientId: fx.B.linkedClientId } }),
      ).toBe(0);
    },
  ),
  mutation(
    'POST',
    '/api/master/online/open',
    'master',
    (fx) => ({ body: { hours: 1, masterId: fx.B.masterId } }),
    async (fx) => {
      expect((await masterOf(fx.A.masterId)).isOnlineOpen).toBe(true);
    },
  ),
  mutation(
    'POST',
    '/api/master/online/close',
    'master',
    (fx) => ({ body: { masterId: fx.B.masterId } }),
    async (fx) => {
      expect((await masterOf(fx.B.masterId)).isOnlineOpen).toBe(true);
    },
  ),
  read('master', '/api/master/qr'),
  {
    method: 'POST',
    route: '/api/master/export/link',
    who: 'master',
    check: async (fx) => {
      const res = await agent(fx, 'master').post('/api/master/export/link', {
        entity: 'clients',
        masterId: fx.B.masterId,
      });
      expect(res.status).toBe(200);
      const path = new URL(res.body.url).pathname;
      const csv = await request(app).get(path);
      expect(csv.status).toBe(200);
      expect(csv.text).toContain(fx.A.clientName);
      expect(csv.text).not.toContain(fx.B.clientName);
    },
  },
];

/* ───────────── /api/salon/* ───────────── */

const S = 'salon' as const;
const salonCases: IsolationCase[] = [
  {
    method: 'GET',
    route: '/api/salon/onboarding/draft',
    who: S,
    check: async (fx) => {
      await prisma.onboardingDraft.upsert({
        where: { userId_role: { userId: fx.SB.userId, role: 'SALON' } },
        create: { userId: fx.SB.userId, role: 'SALON', step: 2, data: { secret: 'salon-draft-b' } },
        update: {},
      });
      const res = await agent(fx, S).get('/api/salon/onboarding/draft');
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('salon-draft-b');
    },
  },
  mutation(
    'POST',
    '/api/salon/onboarding/step',
    S,
    () => ({ body: { step: 1, data: { name: 'SA step' } } }),
    async (fx) => {
      const draft = await prisma.onboardingDraft.findUnique({
        where: { userId_role: { userId: fx.SB.userId, role: 'SALON' } },
      });
      expect(JSON.stringify(draft?.data)).not.toContain('SA step');
    },
  ),
  read(
    S,
    '/api/salon/onboarding/slug-check',
    () => '/api/salon/onboarding/slug-check?slug=another-free',
  ),
  mutation(
    'POST',
    '/api/salon/onboarding/complete',
    S,
    (fx) => ({
      body: {
        name: 'Hijack',
        slug: 'hijack-salon',
        categoryIds: [fx.dict.categoryId],
        countryId: fx.dict.countryId,
        cityId: fx.dict.cityId,
        salonId: fx.SB.salonId,
      },
    }),
    async (fx, res) => {
      expect(res.status).toBe(409);
      expect((await salonOf(fx.SB.salonId)).name).toBe('Salon salon-b');
    },
  ),
  read(S, '/api/salon/profile'),
  mutation(
    'PATCH',
    '/api/salon/profile',
    S,
    (fx) => ({ body: { name: 'SA renamed', salonId: fx.SB.salonId } }),
    async (fx, res) => {
      expect(res.body.id).toBe(fx.SA.salonId);
      expect((await salonOf(fx.SB.salonId)).name).toBe('Salon salon-b');
    },
  ),
  read(S, '/api/salon/theme'),
  mutation(
    'PATCH',
    '/api/salon/theme',
    S,
    (fx) => ({ body: { accent: '#abcdef', salonId: fx.SB.salonId } }),
    async (fx) => {
      expect(
        (await prisma.masterTheme.findUniqueOrThrow({ where: { salonId: fx.SB.salonId } })).accent,
      ).not.toBe('#abcdef');
    },
  ),
  mutation(
    'POST',
    '/api/salon/theme/preset',
    S,
    () => ({ body: { preset: 'pink' } }),
    async (fx) => {
      expect(
        (await prisma.masterTheme.findUniqueOrThrow({ where: { salonId: fx.SB.salonId } })).preset,
      ).toBe('liquid_glass');
    },
  ),
  {
    method: 'POST',
    route: '/api/salon/upload',
    who: S,
    check: async (fx) => {
      const res = await request(app)
        .post(`/api/salon/upload?kind=avatar&salonId=${fx.SB.salonId}`)
        .set('Authorization', `Bearer ${fx.SA.token}`)
        .attach('file', await png(), 'x.png');
      expect(res.status).toBe(201);
      expect(res.body.url).toContain(`s-${fx.SA.salonId}`);
    },
  },
  read(S, '/api/salon/masters'),
  mutation(
    'POST',
    '/api/salon/masters/invite-by-username',
    S,
    (fx) => ({ body: { username: 'member_b', salonId: fx.SB.salonId } }),
    async (fx, res) => {
      const invite = await prisma.salonInvite.findUniqueOrThrow({
        where: { id: res.body.invite.id },
      });
      expect(invite.salonId).toBe(fx.SA.salonId);
      expect((await masterOf(fx.SB.member.masterId)).salonId).toBe(fx.SB.salonId);
    },
  ),
  mutation(
    'POST',
    '/api/salon/masters/invite-link',
    S,
    (fx) => ({ body: { ttlDays: 3, salonId: fx.SB.salonId } }),
    async (fx, res) => {
      expect(
        (await prisma.salonInvite.findUniqueOrThrow({ where: { id: res.body.id } })).salonId,
      ).toBe(fx.SA.salonId);
    },
  ),
  foreign(
    'DELETE',
    '/api/salon/masters/:masterId',
    S,
    (fx) => ({ url: `/api/salon/masters/${fx.SB.member.masterId}` }),
    async (fx) => {
      expect((await masterOf(fx.SB.member.masterId)).salonId).toBe(fx.SB.salonId);
    },
  ),
  foreign('GET', '/api/salon/masters/:masterId/schedule', S, (fx) => ({
    url: `/api/salon/masters/${fx.A.masterId}/schedule?date=${futureSlot(3, 12).toISOString().slice(0, 10)}`,
  })),
  read(S, '/api/salon/invites'),
  foreign(
    'DELETE',
    '/api/salon/invites/:id',
    S,
    (fx) => ({ url: `/api/salon/invites/${fx.SB.inviteId}` }),
    async (fx) => {
      expect(
        (await prisma.salonInvite.findUniqueOrThrow({ where: { id: fx.SB.inviteId } })).status,
      ).toBe('pending');
    },
  ),
  read(S, '/api/salon/subscription'),
  mutation(
    'POST',
    '/api/salon/subscription/create-payment',
    S,
    (fx) => ({ body: { autoRenew: false, salonId: fx.SB.salonId } }),
    async (fx) => {
      expect(await prisma.payment.count({ where: { salonId: fx.SB.salonId } })).toBe(1);
    },
  ),
  mutation(
    'POST',
    '/api/salon/subscription/cancel',
    S,
    (fx) => ({ body: { salonId: fx.SB.salonId } }),
    async (fx) => {
      expect((await salonOf(fx.SB.salonId)).status).toBe('TRIAL');
    },
  ),
  mutation(
    'POST',
    '/api/salon/subscription/auto-renew',
    S,
    () => ({ body: { enabled: false } }),
    () => undefined,
  ),
  mutation(
    'POST',
    '/api/salon/subscription/apply-promo',
    S,
    () => ({ body: { code: 'NOPE' } }),
    (_fx, res) => {
      expect(res.status).toBe(404);
    },
  ),
  read(S, '/api/salon/subscription/payments'),
  read(
    S,
    '/api/salon/schedule/day',
    (fx) =>
      `/api/salon/schedule/day?date=${futureSlot(3, 12).toISOString().slice(0, 10)}&masterId=${fx.SB.member.masterId}`,
  ),
  read(
    S,
    '/api/salon/schedule/overview',
    () => `/api/salon/schedule/overview?from=${new Date().toISOString().slice(0, 10)}`,
  ),
  read(
    S,
    '/api/salon/appointments',
    (fx) => `/api/salon/appointments?masterId=${fx.SB.member.masterId}`,
  ),
  foreign('POST', '/api/salon/appointments', S, (fx) => ({
    url: '/api/salon/appointments',
    body: {
      masterId: fx.SB.member.masterId,
      clientId: fx.SB.member.clientId,
      serviceIds: [fx.SB.member.serviceIds[0]],
      startAt: futureSlot(9, 12).toISOString(),
    },
  })),
  foreign('GET', '/api/salon/appointments/:id', S, (fx) => ({
    url: `/api/salon/appointments/${fx.SB.member.appointmentId}`,
  })),
  foreign(
    'PATCH',
    '/api/salon/appointments/:id',
    S,
    (fx) => ({
      url: `/api/salon/appointments/${fx.A.appointmentId}`,
      body: { status: 'CANCELLED' },
    }),
    async (fx) => {
      expect(
        (await prisma.appointment.findUniqueOrThrow({ where: { id: fx.A.appointmentId } })).status,
      ).toBe('CONFIRMED');
    },
  ),
  read(S, '/api/salon/clients', (fx) => `/api/salon/clients?masterId=${fx.SB.member.masterId}`),
  foreign('GET', '/api/salon/clients/:id', S, (fx) => ({
    url: `/api/salon/clients/${fx.SB.member.clientId}`,
  })),
  foreign(
    'PATCH',
    '/api/salon/clients/:id',
    S,
    (fx) => ({ url: `/api/salon/clients/${fx.A.clientId}`, body: { notes: 'pwned' } }),
    async (fx) => {
      expect(
        (await prisma.client.findUniqueOrThrow({ where: { id: fx.A.clientId } })).notes,
      ).toBeNull();
    },
  ),
  foreign('POST', '/api/salon/clients/:id/remind', S, (fx) => ({
    url: `/api/salon/clients/${fx.SB.member.linkedClientId}/remind`,
    body: {},
  })),
  read(S, '/api/salon/services'),
  read(S, '/api/salon/reviews'),
  read(S, '/api/salon/dashboard'),
  read(S, '/api/salon/analytics'),
  read(S, '/api/salon/promotions'),
  foreign('POST', '/api/salon/promotions', S, (fx) => ({
    url: '/api/salon/promotions',
    body: {
      masterId: fx.SB.member.masterId,
      title: 'Steal promo',
      discountPct: 10,
      validFrom: '2026-01-01',
      validTo: '2030-01-01',
      daysOfWeek: [],
    },
  })),
  foreign(
    'PATCH',
    '/api/salon/promotions/:id',
    S,
    (fx) => ({
      url: `/api/salon/promotions/${fx.SB.member.promotionId}`,
      body: { discountPct: 80 },
    }),
    async (fx) => {
      expect(
        (await prisma.promotion.findUniqueOrThrow({ where: { id: fx.SB.member.promotionId } }))
          .discountPct,
      ).toBe(15);
    },
  ),
  foreign('DELETE', '/api/salon/promotions/:id', S, (fx) => ({
    url: `/api/salon/promotions/${fx.A.promotionId}`,
  })),
  read(S, '/api/salon/broadcasts'),
  foreign('POST', '/api/salon/broadcasts/preview', S, (fx) => ({
    url: '/api/salon/broadcasts/preview',
    body: { masterId: fx.SB.member.masterId, segment: 'all' },
  })),
  foreign('POST', '/api/salon/broadcasts', S, (fx) => ({
    url: '/api/salon/broadcasts',
    body: { masterId: fx.A.masterId, segment: 'all', text: 'Hi' },
  })),
];

const ALL_CASES = [...masterCases, ...salonCases];
const key = (c: { method: string; route?: string; path?: string }) =>
  `${c.method} ${c.route ?? c.path}`;

describe('tenant isolation', () => {
  let fx: IsolationFixture;

  beforeAll(async () => {
    fx = await buildIsolationFixture();
  });

  it.each(ALL_CASES.map((c) => [key(c), c] as const))('%s', async (_name, c) => {
    await c.check(fx);
  });

  it('masterId from the JWT wins over a forged token payload', async () => {
    const res = await request(app)
      .get('/api/master/profile')
      .set('Authorization', `Bearer ${fx.A.token}x`);
    expect(res.status).toBe(401);
  });

  it('master tokens cannot reach salon endpoints and vice versa', async () => {
    expect((await as(fx.A.token).get('/api/salon/profile')).status).toBe(403);
    expect((await as(fx.SA.token).get('/api/master/profile')).status).toBe(403);
  });

  it('salon owner sees only appointments of own masters', async () => {
    const res = await as(fx.SA.token).get(
      `/api/salon/appointments?from=${addHours(new Date(), -24 * 30).toISOString()}`,
    );
    expect(res.status).toBe(200);
    const masterIds = new Set((res.body as { masterId: string }[]).map((a) => a.masterId));
    expect([...masterIds]).toEqual([fx.SA.member.masterId]);
  });
});

describe('isolation coverage (CI guard)', () => {
  it('every /api/master/* and /api/salon/* route has an isolation case', () => {
    const covered = new Set(ALL_CASES.map(key));
    const tenantRoutes = routeRegistry.filter(
      (r) => r.path.startsWith('/api/master/') || r.path.startsWith('/api/salon/'),
    );
    const missing = tenantRoutes.map(key).filter((k) => !covered.has(k));
    expect(missing, `Add isolation tests for: ${missing.join(', ')}`).toEqual([]);
  });

  it('isolation cases point at existing routes', () => {
    const registered = new Set(routeRegistry.map(key));
    const stale = ALL_CASES.map(key).filter((k) => !registered.has(k));
    expect(stale).toEqual([]);
  });
});
