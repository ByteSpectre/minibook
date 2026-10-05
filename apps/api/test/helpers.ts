import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { themeDataForPreset } from '../src/lib/mappers';
import { addDays, addHours } from '../src/lib/time';
import { buildAuthContext } from '../src/services/auth.service';

export const app = createApp();

export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

let telegramSeq = 500_000;
export const nextTelegramId = () => (telegramSeq += 1);

export async function tokenFor(userId: string): Promise<string> {
  return signAccessToken(await buildAuthContext(userId));
}

export function as(token: string) {
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => auth(request(app).get(url)),
    post: (url: string, body?: object) => auth(request(app).post(url)).send(body ?? {}),
    patch: (url: string, body?: object) => auth(request(app).patch(url)).send(body ?? {}),
    put: (url: string, body?: object) => auth(request(app).put(url)).send(body ?? {}),
    delete: (url: string) => auth(request(app).delete(url)),
  };
}

export interface Dictionaries {
  categoryId: string;
  category2Id: string;
  countryId: string;
  cityId: string;
}

export async function dictionaries(): Promise<Dictionaries> {
  const category = await prisma.category.upsert({
    where: { slug: 'manicure' },
    create: { slug: 'manicure', name: 'Маникюр', emoji: '💅' },
    update: {},
  });
  const category2 = await prisma.category.upsert({
    where: { slug: 'brows' },
    create: { slug: 'brows', name: 'Брови', emoji: '✨' },
    update: {},
  });
  const country = await prisma.country.upsert({
    where: { code: 'RU' },
    create: { code: 'RU', name: 'Россия', flag: '🇷🇺' },
    update: {},
  });
  const city =
    (await prisma.city.findFirst({ where: { countryId: country.id, name: 'Москва' } })) ??
    (await prisma.city.create({
      data: {
        countryId: country.id,
        name: 'Москва',
        timezone: 'Europe/Moscow',
        latitude: 55.75,
        longitude: 37.61,
      },
    }));
  return {
    categoryId: category.id,
    category2Id: category2.id,
    countryId: country.id,
    cityId: city.id,
  };
}

export async function createUser(
  data: { firstName?: string; username?: string | null; telegramId?: number } = {},
) {
  return prisma.user.create({
    data: {
      telegramId: BigInt(data.telegramId ?? nextTelegramId()),
      firstName: data.firstName ?? 'Test',
      username: data.username ?? null,
      language: 'ru',
    },
  });
}

export async function createClientUser(
  data: { firstName?: string; username?: string; phone?: string; birthday?: string } = {},
) {
  const user = await createUser({
    firstName: data.firstName ?? 'Клиент',
    username: data.username ?? null,
  });
  await prisma.clientProfile.create({
    data: {
      userId: user.id,
      firstName: data.firstName ?? 'Клиент',
      gender: 'FEMALE',
      birthday: new Date(`${data.birthday ?? '1995-06-15'}T00:00:00Z`),
      phone: data.phone ?? `+7916${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`,
      phoneCountry: 'RU',
      username: data.username ?? null,
      onboardingCompleted: true,
    },
  });
  await prisma.userRole.create({ data: { userId: user.id, role: 'CLIENT' } });
  return { user, token: await tokenFor(user.id) };
}

export interface MasterFixture {
  userId: string;
  masterId: string;
  slug: string;
  token: string;
  serviceIds: string[];
}

export async function createMaster(
  dict: Dictionaries,
  opts: {
    slug: string;
    name?: string;
    status?: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'BANNED';
    salonId?: string;
    username?: string;
    allowMultiService?: boolean;
    autoConfirm?: boolean;
  },
): Promise<MasterFixture> {
  const user = await createUser({
    firstName: opts.name ?? opts.slug,
    username: opts.username ?? opts.slug.replace(/-/g, '_'),
  });
  const status = opts.status ?? 'TRIAL';
  const now = new Date();
  const master = await prisma.master.create({
    data: {
      userId: user.id,
      slug: opts.slug,
      name: opts.name ?? `Master ${opts.slug}`,
      username: opts.username ?? opts.slug.replace(/-/g, '_'),
      countryId: dict.countryId,
      cityId: dict.cityId,
      address: 'Москва, Тестовая ул., 1',
      latitude: 55.75,
      longitude: 37.61,
      timezone: 'Europe/Moscow',
      status,
      trialEndsAt: status === 'EXPIRED' ? addDays(now, -1) : addDays(now, 14),
      subscriptionEndsAt: status === 'ACTIVE' || status === 'CANCELLED' ? addDays(now, 20) : null,
      salonId: opts.salonId ?? null,
      allowMultiService: opts.allowMultiService ?? true,
      autoConfirm: opts.autoConfirm ?? false,
      categories: { create: [{ categoryId: dict.categoryId }] },
      settings: { create: { minLeadMinutes: 0, bufferMinutes: 0 } },
      theme: { create: themeDataForPreset('classic') },
      blockedScreen: { create: { title: `Blocked ${opts.slug}` } },
      schedule: {
        create: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
          dayOfWeek: d,
          startTime: '09:00',
          endTime: '21:00',
          isWorking: true,
        })),
      },
      services: {
        create: [
          {
            name: `Маникюр ${opts.slug}`,
            price: 2000,
            duration: 60,
            categoryId: dict.categoryId,
            sortOrder: 0,
          },
          {
            name: `Дизайн ${opts.slug}`,
            price: 300,
            duration: 30,
            categoryId: dict.categoryId,
            sortOrder: 1,
          },
        ],
      },
    },
    include: { services: { orderBy: { sortOrder: 'asc' } } },
  });
  await prisma.userRole.create({ data: { userId: user.id, role: 'MASTER', masterId: master.id } });
  return {
    userId: user.id,
    masterId: master.id,
    slug: master.slug,
    token: await tokenFor(user.id),
    serviceIds: master.services.map((s) => s.id),
  };
}

export interface SalonFixture {
  userId: string;
  salonId: string;
  slug: string;
  token: string;
}

export async function createSalon(
  dict: Dictionaries,
  opts: { slug: string; status?: 'TRIAL' | 'ACTIVE' | 'EXPIRED' },
): Promise<SalonFixture> {
  const user = await createUser({ firstName: `Owner ${opts.slug}` });
  const salon = await prisma.salon.create({
    data: {
      ownerId: user.id,
      slug: opts.slug,
      name: `Salon ${opts.slug}`,
      countryId: dict.countryId,
      cityId: dict.cityId,
      timezone: 'Europe/Moscow',
      status: opts.status ?? 'TRIAL',
      trialEndsAt: opts.status === 'EXPIRED' ? addDays(new Date(), -1) : addDays(new Date(), 14),
      latitude: 55.76,
      longitude: 37.6,
      categories: { create: [{ categoryId: dict.categoryId }] },
      theme: { create: themeDataForPreset('liquid_glass') },
    },
  });
  await prisma.userRole.create({ data: { userId: user.id, role: 'SALON', salonId: salon.id } });
  return { userId: user.id, salonId: salon.id, slug: salon.slug, token: await tokenFor(user.id) };
}

export async function createClient(
  masterId: string,
  data: {
    firstName?: string;
    userId?: string;
    telegramId?: bigint;
    username?: string;
    phone?: string;
    birthday?: Date;
  } = {},
) {
  return prisma.client.create({
    data: {
      masterId,
      firstName: data.firstName ?? 'Клиентка',
      userId: data.userId ?? null,
      telegramId: data.telegramId ?? null,
      username: data.username ?? null,
      phone: data.phone ?? null,
      gender: 'FEMALE',
      birthday: data.birthday ?? null,
    },
  });
}

export async function createAppointment(
  masterId: string,
  clientId: string,
  serviceId: string,
  startAt: Date,
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' = 'CONFIRMED',
  extra: { createdAt?: Date; completedAt?: Date } = {},
) {
  const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
  return prisma.appointment.create({
    data: {
      masterId,
      clientId,
      startAt,
      endAt: addHours(startAt, service.duration / 60),
      status,
      price: service.price,
      originalPrice: service.price,
      createdBy: 'client',
      completedAt: status === 'COMPLETED' ? (extra.completedAt ?? startAt) : null,
      createdAt: extra.createdAt ?? addDays(startAt, -5),
      photos: [],
      services: {
        create: [
          { serviceId, name: service.name, duration: service.duration, price: service.price },
        ],
      },
    },
  });
}

/** A future time on a round hour inside the 09:00–21:00 schedule (Moscow). */
export function futureSlot(daysAhead: number, hourMsk: number): Date {
  const base = new Date();
  const day = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + daysAhead,
      hourMsk - 3,
      0,
      0,
    ),
  );
  return day;
}
