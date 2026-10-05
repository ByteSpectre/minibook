import 'dotenv/config';
import {
  addDaysIso,
  countryFlag,
  COUNTRY_CURRENCY,
  initials,
  type ThemePreset,
} from '@nail-crm/shared';
import { env } from '../config';
import { themeDataForPreset } from '../lib/mappers';
import { addDays, addHours, addMinutes, localParts, zonedToUtc } from '../lib/time';
import { recomputeClientStats, recomputeMasterRating } from '../services/clientStats.service';
import { uploadDir } from '../services/storage.service';
import { prisma } from './prisma';
import { CATEGORIES, CLIENT_NAMES_F, CLIENT_NAMES_M, COUNTRIES } from './seedData';
import { artImage, avatarImage } from './seedImages';

/* Deterministic PRNG so every seed produces the same demo. */
let state = 20261005;
function rand(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

const now = new Date();
const categoryIds = new Map<string, string>();
const cityIds = new Map<
  string,
  { id: string; countryId: string; timezone: string; currency: string }
>();

async function seedDictionaries() {
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, nameEn: c.nameEn, emoji: c.emoji, sortOrder: i },
      update: { name: c.name, nameEn: c.nameEn, emoji: c.emoji, sortOrder: i },
    });
    categoryIds.set(c.slug, row.id);
  }
  for (const [i, country] of COUNTRIES.entries()) {
    const row = await prisma.country.upsert({
      where: { code: country.code },
      create: {
        code: country.code,
        name: country.name,
        nameEn: country.nameEn,
        flag: countryFlag(country.code),
        sortOrder: i,
      },
      update: {
        name: country.name,
        nameEn: country.nameEn,
        flag: countryFlag(country.code),
        sortOrder: i,
      },
    });
    for (const [j, city] of country.cities.entries()) {
      const existing = await prisma.city.findFirst({
        where: { countryId: row.id, name: city.name },
      });
      const data = {
        name: city.name,
        nameEn: city.nameEn,
        countryId: row.id,
        timezone: city.timezone,
        latitude: city.lat,
        longitude: city.lng,
        sortOrder: j,
      };
      const saved = existing
        ? await prisma.city.update({ where: { id: existing.id }, data })
        : await prisma.city.create({ data });
      cityIds.set(city.name, {
        id: saved.id,
        countryId: row.id,
        timezone: city.timezone,
        currency: COUNTRY_CURRENCY[country.code] ?? 'RUB',
      });
    }
  }
}

async function cleanDemo() {
  const demo = {
    OR: [
      { telegramId: { gte: 100000, lt: 100100 } },
      { telegramId: { gte: 200000, lt: 200100 } },
      { telegramId: { gte: 300000, lt: 300100 } },
    ],
  };
  const users = await prisma.user.findMany({ where: demo, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.salon.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.master.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.promoCode.deleteMany({
    where: { code: { in: ['WELCOME30', 'SALE20', 'SUMMER10'] } },
  });
  await prisma.experiment.deleteMany({ where: { name: 'Цена подписки: 449 ₽ vs 399 ₽' } });
  await prisma.notificationLog.deleteMany({});
}

interface UserSeed {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  language?: 'ru' | 'en';
  avatar?: boolean;
}

async function createUser(u: UserSeed) {
  const photoUrl =
    u.avatar === false
      ? null
      : await avatarImage(
          uploadDir,
          `u${u.telegramId}`,
          initials(`${u.firstName} ${u.lastName ?? ''}`),
        );
  return prisma.user.create({
    data: {
      telegramId: BigInt(u.telegramId),
      firstName: u.firstName,
      lastName: u.lastName ?? null,
      username: u.username ?? null,
      photoUrl,
      languageCode: u.language ?? 'ru',
      language: u.language ?? 'ru',
      botStartedAt: now,
      lastSeenAt: now,
      createdAt: addDays(now, -between(20, 90)),
    },
  });
}

async function funnel(userId: string, types: string[], role = 'ANY') {
  await prisma.funnelEvent.createMany({
    data: types.map((type) => ({
      userId,
      type,
      role: ['BOT_START', 'APP_OPEN'].includes(type) ? 'ANY' : role,
    })),
    skipDuplicates: true,
  });
}

interface ServiceSeed {
  name: string;
  price: number;
  duration: number;
  category: string;
  description?: string;
  image?: boolean;
}

interface MasterSeed {
  user: UserSeed;
  slug: string;
  name: string;
  city: string;
  categories: string[];
  address: string;
  lat: number;
  lng: number;
  services: ServiceSeed[];
  status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  trialDaysLeft?: number;
  paidDaysLeft?: number;
  salonId?: string;
  rules?: string;
  channel?: string;
  preset?: ThemePreset;
  autoConfirm?: boolean;
  allowMultiService?: boolean;
  onlineHours?: number;
  postVisitMessage?: string;
  createdDaysAgo?: number;
}

async function createMaster(s: MasterSeed) {
  const user = await createUser(s.user);
  const city = cityIds.get(s.city)!;
  const createdAt = addDays(now, -(s.createdDaysAgo ?? 60));
  const avatarUrl = await avatarImage(uploadDir, `m-${s.slug}`, initials(s.name));
  const services = await Promise.all(
    s.services.map(async (svc, i) => ({
      ...svc,
      imageUrl: svc.image === false ? null : await artImage(uploadDir, `${s.slug}-${i}`, 'service'),
      sortOrder: i,
    })),
  );
  const master = await prisma.master.create({
    data: {
      userId: user.id,
      slug: s.slug,
      name: s.name,
      username: s.user.username ?? null,
      channelUsername: s.channel ?? null,
      avatarUrl,
      rules: s.rules ?? null,
      autoConfirm: s.autoConfirm ?? false,
      allowMultiService: s.allowMultiService ?? true,
      postVisitMessage: s.postVisitMessage ?? null,
      countryId: city.countryId,
      cityId: city.id,
      address: s.address,
      latitude: s.lat,
      longitude: s.lng,
      timezone: city.timezone,
      currency: city.currency,
      status: s.status,
      trialEndsAt:
        s.status === 'TRIAL' ? addDays(now, s.trialDaysLeft ?? 10) : addDays(createdAt, 14),
      subscriptionEndsAt:
        s.status === 'ACTIVE' || s.status === 'CANCELLED'
          ? addDays(now, s.paidDaysLeft ?? 18)
          : s.status === 'EXPIRED'
            ? addDays(now, -3)
            : null,
      isOnlineOpen: !!s.onlineHours,
      onlineOpenUntil: s.onlineHours ? addHours(now, s.onlineHours) : null,
      salonId: s.salonId ?? null,
      salonJoinedAt: s.salonId ? addDays(now, -30) : null,
      createdAt,
      categories: { create: s.categories.map((slug) => ({ categoryId: categoryIds.get(slug)! })) },
      settings: { create: { bufferMinutes: 10, slotStep: 10, minLeadMinutes: 60 } },
      theme: { create: themeDataForPreset(s.preset ?? 'liquid_glass') },
      blockedScreen: { create: {} },
      schedule: {
        create: [1, 2, 3, 4, 5, 6].map((d) => ({
          dayOfWeek: d,
          startTime: d === 6 ? '11:00' : '10:00',
          endTime: d === 6 ? '18:00' : '20:00',
          isWorking: true,
        })),
      },
      services: {
        create: services.map((svc) => ({
          name: svc.name,
          description: svc.description ?? null,
          imageUrl: svc.imageUrl,
          price: svc.price,
          duration: svc.duration,
          categoryId: categoryIds.get(svc.category) ?? null,
          sortOrder: svc.sortOrder,
        })),
      },
    },
    include: { services: { orderBy: { sortOrder: 'asc' } } },
  });
  await prisma.userRole.create({ data: { userId: user.id, role: 'MASTER', masterId: master.id } });
  await funnel(
    user.id,
    ['BOT_START', 'APP_OPEN', 'ONBOARDING_STARTED', 'ONBOARDING_COMPLETED'],
    'MASTER',
  );
  return { user, master };
}

async function createClientProfile(
  userId: string,
  p: {
    firstName: string;
    gender: 'MALE' | 'FEMALE';
    birthday: string;
    phone: string;
    username?: string;
  },
) {
  await prisma.clientProfile.create({
    data: {
      userId,
      firstName: p.firstName,
      gender: p.gender,
      birthday: new Date(`${p.birthday}T00:00:00Z`),
      phone: p.phone,
      phoneCountry: 'RU',
      username: p.username ?? null,
      onboardingCompleted: true,
    },
  });
  await prisma.userRole.create({ data: { userId, role: 'CLIENT' } });
  await funnel(userId, ['BOT_START', 'APP_OPEN', 'ONBOARDING_COMPLETED'], 'CLIENT');
}

type MasterRow = Awaited<ReturnType<typeof createMaster>>['master'];

async function manualClients(master: MasterRow, count: number) {
  const clients = [];
  for (let i = 0; i < count; i += 1) {
    const female = rand() > 0.15;
    const name = female ? pick(CLIENT_NAMES_F) : pick(CLIENT_NAMES_M);
    const year = between(1972, 2005);
    const month = String(between(1, 12)).padStart(2, '0');
    const day = String(between(1, 28)).padStart(2, '0');
    clients.push(
      await prisma.client.create({
        data: {
          masterId: master.id,
          firstName: name,
          phone: `+7916${String(between(1000000, 9999999))}`,
          gender: female ? 'FEMALE' : 'MALE',
          birthday: new Date(`${year}-${month}-${day}T00:00:00Z`),
          createdAt: addDays(now, -between(30, 120)),
        },
      }),
    );
  }
  return clients;
}

async function appointment(
  master: MasterRow,
  clientId: string,
  serviceIdx: number[],
  startAt: Date,
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW',
  extra: {
    discountPct?: number;
    photos?: { before: string; after: string };
    createdBy?: string;
  } = {},
) {
  const services = serviceIdx.map((i) => master.services[i % master.services.length]!);
  const duration = services.reduce((s, x) => s + x.duration, 0);
  const total = services.reduce((s, x) => s + Number(x.price), 0);
  const price = extra.discountPct ? Math.round(total * (100 - extra.discountPct)) / 100 : total;
  const endAt = addMinutes(startAt, duration);
  return prisma.appointment.create({
    data: {
      masterId: master.id,
      clientId,
      startAt,
      endAt,
      status,
      price,
      originalPrice: total,
      discountPct: extra.discountPct ?? null,
      discountSource: extra.discountPct ? 'loyalty:EVERY_N_VISIT' : null,
      createdBy: extra.createdBy ?? 'client',
      completedAt: status === 'COMPLETED' ? endAt : null,
      cancelledAt: status === 'CANCELLED' ? addHours(startAt, -20) : null,
      cancelledBy: status === 'CANCELLED' ? 'client' : null,
      clientConfirmedAt: status === 'CONFIRMED' ? addHours(now, -2) : null,
      beforePhotoUrl: extra.photos?.before ?? null,
      afterPhotoUrl: extra.photos?.after ?? null,
      photos: [],
      createdAt: addDays(startAt, -between(2, 10)),
      services: {
        create: services.map((s) => ({
          serviceId: s.id,
          name: s.name,
          duration: s.duration,
          price: s.price,
        })),
      },
    },
  });
}

/** Past visits (for analytics) and upcoming bookings on a realistic grid. */
async function generateHistory(
  master: MasterRow,
  clientIds: string[],
  opts: { pastDays: number; futureDays: number; density: number },
) {
  const tz = master.timezone;
  const today = localParts(now, tz).day;
  const busy: [number, number][] = [];
  const free = (s: Date, e: Date) => !busy.some(([a, b]) => s.getTime() < b && e.getTime() > a);
  for (let d = -opts.pastDays; d <= opts.futureDays; d += 1) {
    const day = addDaysIso(today, d);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0) continue;
    const slots = between(0, opts.density);
    for (let k = 0; k < slots; k += 1) {
      const hour = between(10, 17);
      const minute = pick([0, 30]);
      const startAt = zonedToUtc(day, hour * 60 + minute, tz);
      const serviceIdx = [between(0, master.services.length - 1)];
      const duration = master.services[serviceIdx[0]! % master.services.length]!.duration;
      const endAt = addMinutes(startAt, duration);
      if (!free(startAt, addMinutes(endAt, 10))) continue;
      const isPast = endAt < now;
      if (!isPast && startAt < addHours(now, 1)) continue;
      const roll = rand();
      const status = isPast
        ? roll < 0.86
          ? 'COMPLETED'
          : roll < 0.94
            ? 'CANCELLED'
            : 'NO_SHOW'
        : roll < 0.65
          ? 'CONFIRMED'
          : 'PENDING';
      busy.push([startAt.getTime(), addMinutes(endAt, 10).getTime()]);
      await appointment(master, pick(clientIds), serviceIdx, startAt, status);
    }
  }
}

const REVIEW_TEXTS = [
  'Всё очень аккуратно и быстро, покрытие держится отлично! Обязательно приду ещё.',
  'Мастер — золото. Уютно, чисто, кофе вкусный 🙂',
  'Сделали ровно то, что я хотела по референсу. Спасибо!',
  'Отличный сервис, записалась сразу на следующий месяц.',
  'Очень приятная атмосфера и внимательный подход.',
  'Хорошо, но немного задержали начало. В целом рекомендую.',
];

async function seedReviews(master: MasterRow, limit: number, withPhotos: number) {
  const completed = await prisma.appointment.findMany({
    where: { masterId: master.id, status: 'COMPLETED', review: null },
    include: { client: { select: { id: true, firstName: true } } },
    orderBy: { startAt: 'desc' },
    take: limit,
  });
  for (const [i, a] of completed.entries()) {
    const photos =
      i < withPhotos ? [await artImage(uploadDir, `${master.slug}-review-${i}`, 'review')] : [];
    await prisma.review.create({
      data: {
        masterId: master.id,
        appointmentId: a.id,
        clientId: a.client.id,
        clientName: a.client.firstName ?? 'Клиент',
        rating: rand() > 0.15 ? 5 : 4,
        comment: pick(REVIEW_TEXTS),
        photos,
        createdAt: addHours(a.endAt, between(2, 30)),
      },
    });
  }
  await recomputeMasterRating(master.id);
}

async function refreshClientStats(masterId: string) {
  const clients = await prisma.client.findMany({ where: { masterId }, select: { id: true } });
  for (const c of clients) await recomputeClientStats(masterId, c.id);
}

async function payments(kind: 'master' | 'salon', id: string, count: number, amountRub: number) {
  for (let i = 0; i < count; i += 1) {
    const paidAt = addDays(now, -30 * i - between(1, 10));
    await prisma.payment.create({
      data: {
        masterId: kind === 'master' ? id : null,
        salonId: kind === 'salon' ? id : null,
        provider: 'mock',
        externalId: `seed_${kind}_${id}_${i}`,
        amountKopeks: amountRub * 100,
        periodDays: 30,
        status: 'succeeded',
        isAutoPayment: i > 0,
        savePaymentMethod: true,
        paymentMethodId: `mock_pm_${id}`,
        description:
          kind === 'master' ? 'Подписка мастера на 30 дней' : 'Подписка салона на 30 дней',
        paidAt,
        createdAt: paidAt,
      },
    });
  }
}

async function main() {
  console.info('Seeding dictionaries…');
  await seedDictionaries();
  console.info('Cleaning previous demo data…');
  await cleanDemo();

  console.info('Creating demo tenants…');
  const ownerId = Number(env.PLATFORM_OWNER_TELEGRAM_ID || 100000);
  const owner = await createUser({
    telegramId: ownerId,
    firstName: 'Алексей',
    lastName: 'Платформов',
    username: 'glow_owner',
  });
  await funnel(owner.id, ['BOT_START', 'APP_OPEN']);

  // Maria — standalone manicure master in Moscow, paid subscription.
  const maria = await createMaster({
    user: { telegramId: 100002, firstName: 'Мария', lastName: 'Иванова', username: 'maria_nails' },
    slug: 'maria-nails',
    name: 'Мария Иванова · Nails',
    city: 'Москва',
    categories: ['manicure', 'pedicure'],
    address: 'Москва, Малая Бронная ул., 15, студия 4',
    lat: 55.7629,
    lng: 37.5969,
    status: 'ACTIVE',
    paidDaysLeft: 18,
    channel: 'maria_nails_channel',
    preset: 'pink',
    createdDaysAgo: 75,
    rules:
      'Пожалуйста, предупреждайте об отмене минимум за 6 часов. При опоздании более чем на 15 минут запись может быть сокращена или перенесена. Оплата — картой, наличными или по СБП.',
    postVisitMessage:
      '{name}, спасибо, что выбрали меня! 💖 Буду рада видеть вас снова — уход за кутикулой маслом 2 раза в день продлит жизнь покрытию.',
    services: [
      {
        name: 'Маникюр с покрытием гель-лак',
        price: 2500,
        duration: 90,
        category: 'manicure',
        description: 'Комбинированный маникюр, выравнивание, покрытие в один тон.',
      },
      { name: 'Маникюр без покрытия', price: 1500, duration: 60, category: 'manicure' },
      {
        name: 'Наращивание ногтей',
        price: 4200,
        duration: 150,
        category: 'manicure',
        description: 'Гель, любая длина и форма.',
      },
      { name: 'Дизайн (1 ноготь)', price: 150, duration: 10, category: 'manicure', image: false },
      { name: 'Педикюр с покрытием', price: 3000, duration: 100, category: 'pedicure' },
      { name: 'SMART-педикюр', price: 2700, duration: 80, category: 'pedicure' },
    ],
  });
  await prisma.master.update({
    where: { id: maria.master.id },
    data: { autoRenewEnabled: true, yookassaPaymentMethodId: `mock_pm_${maria.master.id}` },
  });
  await payments('master', maria.master.id, 2, 449);
  await funnel(maria.user.id, ['FIRST_APPOINTMENT', 'SUBSCRIBED'], 'MASTER');
  await prisma.loyaltyRule.createMany({
    data: [
      { masterId: maria.master.id, type: 'EVERY_N_VISIT', threshold: 5, discountPct: 20 },
      { masterId: maria.master.id, type: 'FIRST_VISIT', threshold: null, discountPct: 10 },
      { masterId: maria.master.id, type: 'BIRTHDAY', threshold: 7, discountPct: 15 },
      { masterId: maria.master.id, type: 'REFERRAL', threshold: null, discountPct: 15 },
    ],
  });
  const today = localParts(now, 'Europe/Moscow').day;
  await prisma.promotion.createMany({
    data: [
      {
        masterId: maria.master.id,
        title: 'Скидка 20% на педикюр в будни до 14:00',
        description: 'Действует на педикюр с покрытием с понедельника по пятницу.',
        serviceId: maria.master.services[4]!.id,
        discountPct: 20,
        validFrom: zonedToUtc(addDaysIso(today, -5), 0, 'Europe/Moscow'),
        validTo: zonedToUtc(addDaysIso(today, 40), 0, 'Europe/Moscow'),
        daysOfWeek: [1, 2, 3, 4, 5],
        timeFrom: null,
        timeTo: '14:00',
      },
      {
        masterId: maria.master.id,
        title: 'Осенний френч −15%',
        description: 'Маникюр с покрытием в оттенках сезона.',
        serviceId: maria.master.services[0]!.id,
        discountPct: 15,
        validFrom: zonedToUtc(addDaysIso(today, -2), 0, 'Europe/Moscow'),
        validTo: zonedToUtc(addDaysIso(today, 25), 0, 'Europe/Moscow'),
        daysOfWeek: [],
      },
    ],
  });
  await prisma.blacklistEntry.createMany({
    data: [
      { masterId: maria.master.id, username: 'blocked_client', reason: 'Три неявки подряд' },
      { masterId: maria.master.id, phone: '+79990001122', reason: 'Грубость' },
    ],
  });
  await prisma.blockedScreen.update({
    where: { masterId: maria.master.id },
    data: {
      title: 'Запись временно недоступна',
      text: 'К сожалению, сейчас я не могу принять вашу запись. Спасибо за понимание!',
    },
  });
  const mariaClients = await manualClients(maria.master, 18);

  // Anna — an onboarded client with history at Maria.
  const anna = await createUser({
    telegramId: 100001,
    firstName: 'Анна',
    lastName: 'Смирнова',
    username: 'anna_smirnova',
  });
  await createClientProfile(anna.id, {
    firstName: 'Анна',
    gender: 'FEMALE',
    birthday: '1994-10-11',
    phone: '+79161234567',
    username: 'anna_smirnova',
  });
  const annaAtMaria = await prisma.client.create({
    data: {
      masterId: maria.master.id,
      userId: anna.id,
      telegramId: anna.telegramId,
      firstName: 'Анна',
      phone: '+79161234567',
      username: 'anna_smirnova',
      gender: 'FEMALE',
      birthday: new Date('1994-10-11T00:00:00Z'),
      createdAt: addDays(now, -70),
    },
  });
  for (const daysAgo of [62, 41, 20]) {
    const day = addDaysIso(today, -daysAgo);
    const isLast = daysAgo === 20;
    await appointment(
      maria.master,
      annaAtMaria.id,
      [0],
      zonedToUtc(day, 12 * 60, 'Europe/Moscow'),
      'COMPLETED',
      {
        photos: isLast
          ? {
              before: await artImage(uploadDir, 'anna-1', 'before'),
              after: await artImage(uploadDir, 'anna-1', 'after'),
            }
          : undefined,
      },
    );
  }
  await appointment(
    maria.master,
    annaAtMaria.id,
    [0, 3],
    zonedToUtc(addDaysIso(today, 2), 15 * 60, 'Europe/Moscow'),
    'CONFIRMED',
  );

  // Ksenia — Anna's friend who came by referral.
  const ksenia = await createUser({
    telegramId: 100010,
    firstName: 'Ксения',
    lastName: 'Орлова',
    username: 'ksenia_orlova',
  });
  await createClientProfile(ksenia.id, {
    firstName: 'Ксения',
    gender: 'FEMALE',
    birthday: '1998-03-22',
    phone: '+79035556677',
    username: 'ksenia_orlova',
  });
  const kseniaAtMaria = await prisma.client.create({
    data: {
      masterId: maria.master.id,
      userId: ksenia.id,
      telegramId: ksenia.telegramId,
      firstName: 'Ксения',
      phone: '+79035556677',
      username: 'ksenia_orlova',
      gender: 'FEMALE',
      birthday: new Date('1998-03-22T00:00:00Z'),
    },
  });
  await appointment(
    maria.master,
    kseniaAtMaria.id,
    [1],
    zonedToUtc(addDaysIso(today, -9), 16 * 60, 'Europe/Moscow'),
    'COMPLETED',
    { discountPct: 15 },
  );
  await prisma.referral.create({
    data: {
      masterId: maria.master.id,
      referrerId: annaAtMaria.id,
      referredId: kseniaAtMaria.id,
      appliedAt: addDays(now, -12),
      referredRewardUsedAt: addDays(now, -9),
    },
  });

  // A client blacklisted by Maria (to demo the custom blocked screen).
  const blocked = await createUser({
    telegramId: 100011,
    firstName: 'Игорь',
    lastName: 'Б.',
    username: 'blocked_client',
  });
  await createClientProfile(blocked.id, {
    firstName: 'Игорь',
    gender: 'MALE',
    birthday: '1990-05-05',
    phone: '+79265550000',
    username: 'blocked_client',
  });

  await generateHistory(
    maria.master,
    mariaClients.map((c) => c.id),
    { pastDays: 50, futureDays: 12, density: 4 },
  );
  await refreshClientStats(maria.master.id);
  await seedReviews(maria.master, 14, 4);

  // Salon «Лаванда» with three masters.
  const olga = await createUser({
    telegramId: 100003,
    firstName: 'Ольга',
    lastName: 'Лаврова',
    username: 'olga_lavanda',
  });
  const moscow = cityIds.get('Москва')!;
  const salon = await prisma.salon.create({
    data: {
      ownerId: olga.id,
      slug: 'lavanda',
      name: 'Салон «Лаванда»',
      username: 'olga_lavanda',
      channelUsername: 'lavanda_beauty',
      avatarUrl: await avatarImage(uploadDir, 's-lavanda', 'Л'),
      rules: 'Отмена записи — не позднее чем за 4 часа. Опоздание более 15 минут — перенос записи.',
      address: 'Москва, Патриарший пер., 7',
      latitude: 55.7647,
      longitude: 37.5912,
      countryId: moscow.countryId,
      cityId: moscow.id,
      timezone: moscow.timezone,
      currency: moscow.currency,
      status: 'TRIAL',
      trialEndsAt: addDays(now, 10),
      createdAt: addDays(now, -4),
      categories: {
        create: ['brows', 'lashes', 'makeup', 'haircut', 'coloring'].map((slug) => ({
          categoryId: categoryIds.get(slug)!,
        })),
      },
      theme: { create: themeDataForPreset('liquid_glass') },
    },
  });
  await prisma.userRole.create({ data: { userId: olga.id, role: 'SALON', salonId: salon.id } });
  await funnel(
    olga.id,
    ['BOT_START', 'APP_OPEN', 'ONBOARDING_STARTED', 'ONBOARDING_COMPLETED'],
    'SALON',
  );

  const salonMasters = await Promise.all([
    createMaster({
      user: {
        telegramId: 100004,
        firstName: 'Екатерина',
        lastName: 'Соколова',
        username: 'katya_brows',
      },
      slug: 'katya-brows',
      name: 'Екатерина Соколова',
      city: 'Москва',
      categories: ['brows', 'lashes'],
      address: 'Москва, Патриарший пер., 7',
      lat: 55.7647,
      lng: 37.5912,
      status: 'TRIAL',
      salonId: salon.id,
      services: [
        { name: 'Архитектура бровей', price: 1800, duration: 45, category: 'brows' },
        { name: 'Окрашивание бровей хной', price: 1500, duration: 40, category: 'brows' },
        { name: 'Ламинирование ресниц', price: 2600, duration: 75, category: 'lashes' },
      ],
    }),
    createMaster({
      user: {
        telegramId: 100005,
        firstName: 'Дарья',
        lastName: 'Морозова',
        username: 'darya_makeup',
      },
      slug: 'darya-makeup',
      name: 'Дарья Морозова',
      city: 'Москва',
      categories: ['makeup'],
      address: 'Москва, Патриарший пер., 7',
      lat: 55.7647,
      lng: 37.5912,
      status: 'TRIAL',
      salonId: salon.id,
      onlineHours: 3,
      services: [
        { name: 'Дневной макияж', price: 3500, duration: 60, category: 'makeup' },
        { name: 'Вечерний макияж', price: 4500, duration: 80, category: 'makeup' },
        { name: 'Свадебный макияж', price: 8000, duration: 120, category: 'makeup' },
      ],
    }),
    createMaster({
      user: {
        telegramId: 100006,
        firstName: 'Ирина',
        lastName: 'Ковалёва',
        username: 'irina_hair',
      },
      slug: 'irina-hair',
      name: 'Ирина Ковалёва',
      city: 'Москва',
      categories: ['haircut', 'coloring'],
      address: 'Москва, Патриарший пер., 7',
      lat: 55.7647,
      lng: 37.5912,
      status: 'TRIAL',
      salonId: salon.id,
      services: [
        { name: 'Женская стрижка', price: 3200, duration: 60, category: 'haircut' },
        { name: 'Окрашивание в один тон', price: 6500, duration: 150, category: 'coloring' },
        { name: 'AirTouch', price: 14000, duration: 300, category: 'coloring' },
      ],
    }),
  ]);
  for (const m of salonMasters) {
    const clients = await manualClients(m.master, 8);
    await generateHistory(
      m.master,
      clients.map((c) => c.id),
      { pastDays: 25, futureDays: 7, density: 2 },
    );
    await refreshClientStats(m.master.id);
    await seedReviews(m.master, 5, 1);
  }
  const annaAtKatya = await prisma.client.create({
    data: {
      masterId: salonMasters[0]!.master.id,
      userId: anna.id,
      telegramId: anna.telegramId,
      firstName: 'Анна',
      phone: '+79161234567',
      username: 'anna_smirnova',
      gender: 'FEMALE',
    },
  });
  await appointment(
    salonMasters[0]!.master,
    annaAtKatya.id,
    [0],
    zonedToUtc(addDaysIso(today, -15), 18 * 60, 'Europe/Moscow'),
    'COMPLETED',
  );
  await refreshClientStats(salonMasters[0]!.master.id);
  await prisma.salonInvite.createMany({
    data: [
      { salonId: salon.id, inviteCode: 'LavandaTeam1', expiresAt: addDays(now, 6) },
      {
        salonId: salon.id,
        inviteCode: 'NailsKate77x',
        invitedUsername: 'kate_nails_msk',
        expiresAt: addDays(now, 5),
      },
    ],
  });

  // Viktor — tattoo artist in Saint Petersburg, trial ends in 3 days, available right now.
  const viktor = await createMaster({
    user: { telegramId: 100007, firstName: 'Виктор', lastName: 'Ли', username: 'viktor_ink' },
    slug: 'viktor-ink',
    name: 'Viktor Ink',
    city: 'Санкт-Петербург',
    categories: ['tattoo', 'piercing'],
    address: 'Санкт-Петербург, ул. Рубинштейна, 12',
    lat: 59.9297,
    lng: 30.3449,
    status: 'TRIAL',
    trialDaysLeft: 3,
    onlineHours: 2,
    preset: 'dark',
    createdDaysAgo: 11,
    services: [
      { name: 'Мини-тату', price: 5000, duration: 60, category: 'tattoo' },
      { name: 'Тату (сеанс 3 часа)', price: 15000, duration: 180, category: 'tattoo' },
      { name: 'Пирсинг (мочка)', price: 2500, duration: 30, category: 'piercing' },
    ],
  });
  const viktorClients = await manualClients(viktor.master, 6);
  await generateHistory(
    viktor.master,
    viktorClients.map((c) => c.id),
    { pastDays: 10, futureDays: 5, density: 2 },
  );
  await refreshClientStats(viktor.master.id);
  await seedReviews(viktor.master, 3, 1);
  await funnel(viktor.user.id, ['FIRST_APPOINTMENT'], 'MASTER');

  // Alina — Almaty, paid, prices in KZT.
  const alina = await createMaster({
    user: {
      telegramId: 100008,
      firstName: 'Алина',
      lastName: 'Ким',
      username: 'alina_almaty_nails',
    },
    slug: 'alina-almaty',
    name: 'Alina Nails Almaty',
    city: 'Алматы',
    categories: ['manicure', 'pedicure'],
    address: 'Алматы, пр. Абая, 52',
    lat: 43.2381,
    lng: 76.9286,
    status: 'ACTIVE',
    paidDaysLeft: 9,
    preset: 'minimal',
    services: [
      { name: 'Маникюр + гель-лак', price: 9000, duration: 90, category: 'manicure' },
      { name: 'Педикюр', price: 11000, duration: 90, category: 'pedicure' },
    ],
  });
  await payments('master', alina.master.id, 1, 449);
  const alinaClients = await manualClients(alina.master, 5);
  await generateHistory(
    alina.master,
    alinaClients.map((c) => c.id),
    { pastDays: 20, futureDays: 5, density: 2 },
  );
  await refreshClientStats(alina.master.id);
  await seedReviews(alina.master, 3, 0);
  await funnel(alina.user.id, ['FIRST_APPOINTMENT', 'SUBSCRIBED'], 'MASTER');

  // Sofia — subscription expired: hidden from search, public page shows the stub.
  await createMaster({
    user: { telegramId: 100009, firstName: 'София', lastName: 'Белова', username: 'sofia_lashes' },
    slug: 'sofia-lashes',
    name: 'Sofia Lashes',
    city: 'Москва',
    categories: ['lashes'],
    address: 'Москва, ул. Покровка, 20',
    lat: 55.7593,
    lng: 37.6476,
    status: 'EXPIRED',
    createdDaysAgo: 40,
    services: [{ name: 'Наращивание ресниц 2D', price: 3000, duration: 120, category: 'lashes' }],
  });

  // More Moscow masters for search & map.
  const extra: Omit<MasterSeed, 'status'>[] = [
    {
      user: { telegramId: 200001, firstName: 'Полина', username: 'polina_brows' },
      slug: 'polina-brows',
      name: 'Полина · Brow Bar',
      city: 'Москва',
      categories: ['brows'],
      address: 'Москва, Тверская ул., 18',
      lat: 55.7667,
      lng: 37.6037,
      services: [
        { name: 'Коррекция и окрашивание бровей', price: 1700, duration: 50, category: 'brows' },
      ],
    },
    {
      user: { telegramId: 200002, firstName: 'Евгения', username: 'zhenya_makeup' },
      slug: 'zhenya-makeup',
      name: 'Евгения — визажист',
      city: 'Москва',
      categories: ['makeup'],
      address: 'Москва, ул. Арбат, 24',
      lat: 55.7503,
      lng: 37.5922,
      services: [{ name: 'Макияж на мероприятие', price: 4000, duration: 70, category: 'makeup' }],
    },
    {
      user: { telegramId: 200003, firstName: 'Марат', username: 'marat_barber' },
      slug: 'marat-barber',
      name: 'Marat Barber',
      city: 'Москва',
      categories: ['barber', 'haircut'],
      address: 'Москва, Новослободская ул., 31',
      lat: 55.7858,
      lng: 37.5992,
      onlineHours: 2,
      services: [
        { name: 'Мужская стрижка', price: 2200, duration: 45, category: 'barber' },
        { name: 'Стрижка + борода', price: 3200, duration: 75, category: 'barber' },
      ],
    },
    {
      user: { telegramId: 200004, firstName: 'Светлана', username: 'sveta_massage' },
      slug: 'sveta-massage',
      name: 'Светлана · массаж',
      city: 'Москва',
      categories: ['massage'],
      address: 'Москва, ул. Пятницкая, 41',
      lat: 55.7365,
      lng: 37.6291,
      services: [
        { name: 'Классический массаж спины', price: 3000, duration: 60, category: 'massage' },
      ],
    },
    {
      user: { telegramId: 200005, firstName: 'Диана', username: 'diana_cosmo' },
      slug: 'diana-cosmo',
      name: 'Диана — косметолог',
      city: 'Москва',
      categories: ['cosmetology'],
      address: 'Москва, Ленинский пр., 32',
      lat: 55.7093,
      lng: 37.5803,
      services: [{ name: 'Чистка лица', price: 4500, duration: 90, category: 'cosmetology' }],
    },
    {
      user: { telegramId: 200006, firstName: 'Карина', username: 'karina_nails' },
      slug: 'karina-nails',
      name: 'Karina Nail Studio',
      city: 'Москва',
      categories: ['manicure'],
      address: 'Москва, Бауманская ул., 6',
      lat: 55.7724,
      lng: 37.6787,
      services: [
        { name: 'Маникюр + покрытие', price: 2200, duration: 80, category: 'manicure' },
        { name: 'Японский маникюр', price: 1800, duration: 60, category: 'manicure' },
      ],
    },
    {
      user: { telegramId: 200007, firstName: 'Лиана', username: 'liana_sugar' },
      slug: 'liana-sugar',
      name: 'Лиана · шугаринг',
      city: 'Москва',
      categories: ['depilation'],
      address: 'Москва, Кутузовский пр., 22',
      lat: 55.7425,
      lng: 37.5467,
      services: [{ name: 'Шугаринг ног', price: 2500, duration: 60, category: 'depilation' }],
    },
    {
      user: { telegramId: 200008, firstName: 'Олеся', username: 'olesya_color' },
      slug: 'olesya-color',
      name: 'Олеся — колорист',
      city: 'Москва',
      categories: ['coloring', 'haircut'],
      address: 'Москва, Профсоюзная ул., 56',
      lat: 55.6703,
      lng: 37.5531,
      services: [{ name: 'Тонирование', price: 4800, duration: 120, category: 'coloring' }],
    },
  ];
  for (const e of extra) {
    const m = await createMaster({
      ...e,
      status: 'TRIAL',
      trialDaysLeft: between(4, 13),
      createdDaysAgo: between(3, 12),
    });
    const clients = await manualClients(m.master, 4);
    await generateHistory(
      m.master,
      clients.map((c) => c.id),
      { pastDays: 10, futureDays: 4, density: 2 },
    );
    await refreshClientStats(m.master.id);
    await seedReviews(m.master, between(1, 4), 0);
  }
  await prisma.promotion.create({
    data: {
      masterId: (await prisma.master.findUniqueOrThrow({ where: { slug: 'karina-nails' } })).id,
      title: 'Японский маникюр −25% до конца недели',
      discountPct: 25,
      validFrom: addDays(now, -1),
      validTo: addDays(now, 6),
      daysOfWeek: [],
    },
  });

  // Users who started the bot but never finished onboarding (for the funnel).
  for (let i = 0; i < 24; i += 1) {
    const u = await createUser({
      telegramId: 300001 + i,
      firstName: pick(CLIENT_NAMES_F),
      avatar: false,
    });
    const steps = ['BOT_START'];
    if (i < 18) steps.push('APP_OPEN');
    await funnel(u.id, steps);
    if (i < 9) await funnel(u.id, ['ONBOARDING_STARTED'], i % 3 === 0 ? 'SALON' : 'MASTER');
  }

  // Platform: promo codes and an A/B experiment.
  await prisma.promoCode.createMany({
    data: [
      { code: 'WELCOME30', type: 'FREE_DAYS', value: 30, maxUsages: 500 },
      { code: 'SALE20', type: 'DISCOUNT_PERCENT', value: 20, maxUsages: 100 },
      {
        code: 'SUMMER10',
        type: 'DISCOUNT_PERCENT',
        value: 10,
        expiresAt: addDays(now, -20),
        isActive: true,
      },
    ],
  });
  const experiment = await prisma.experiment.create({
    data: {
      name: 'Цена подписки: 449 ₽ vs 399 ₽',
      hypothesis: 'Снижение цены до 399 ₽ увеличит конверсию из триала в оплату на 20%.',
      variantA: { priceRub: 449 },
      variantB: {
        priceRub: 399,
        paywallTitle: 'Специальная цена — 399 ₽',
        paywallText: 'Только для первых мастеров платформы.',
      },
      splitPercent: 50,
      isActive: false,
    },
  });
  const masters = await prisma.master.findMany({ select: { id: true } });
  await prisma.masterExperiment.createMany({
    data: masters.map((m, i) => ({
      experimentId: experiment.id,
      masterId: m.id,
      variant: i % 2 === 0 ? 'A' : 'B',
    })),
  });

  const counts = {
    users: await prisma.user.count(),
    masters: await prisma.master.count(),
    salons: await prisma.salon.count(),
    appointments: await prisma.appointment.count(),
    reviews: await prisma.review.count(),
  };
  console.info('Seed complete:', counts);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
