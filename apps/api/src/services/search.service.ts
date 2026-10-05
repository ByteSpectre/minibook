import {
  countryFlag,
  LIMITS,
  type MapPointDto,
  type MapQuery,
  type SearchCardDto,
  type SearchQuery,
  type SearchResponse,
} from '@nail-crm/shared';
import { prisma, type Prisma } from '../db/prisma';
import { activeSubscriptionWhere } from '../lib/access';
import { toCategoryDto } from '../lib/mappers';

interface Filters {
  categoryIds?: string[];
  countryId?: string;
  cityId?: string;
  onlineNow?: boolean;
  q?: string;
}

function onlineWhere(now: Date) {
  return { isOnlineOpen: true, onlineOpenUntil: { gt: now } };
}

/** Standalone masters with an active subscription. Salon members are shown via their salon. */
function masterWhere(f: Filters, now: Date): Prisma.MasterWhereInput {
  return {
    AND: [
      activeSubscriptionWhere(now),
      { salonId: null },
      f.categoryIds?.length ? { categories: { some: { categoryId: { in: f.categoryIds } } } } : {},
      f.countryId ? { countryId: f.countryId } : {},
      f.cityId ? { cityId: f.cityId } : {},
      f.onlineNow ? onlineWhere(now) : {},
      f.q ? { name: { contains: f.q, mode: 'insensitive' as const } } : {},
      { services: { some: { isActive: true, deletedAt: null } } },
    ],
  };
}

function salonWhere(f: Filters, now: Date): Prisma.SalonWhereInput {
  const memberFilter: Prisma.MasterWhereInput = {
    status: { not: 'BANNED' },
    services: { some: { isActive: true, deletedAt: null } },
    ...(f.onlineNow ? onlineWhere(now) : {}),
  };
  return {
    AND: [
      activeSubscriptionWhere(now),
      { masters: { some: memberFilter } },
      f.categoryIds?.length
        ? {
            OR: [
              { categories: { some: { categoryId: { in: f.categoryIds } } } },
              {
                masters: { some: { categories: { some: { categoryId: { in: f.categoryIds } } } } },
              },
            ],
          }
        : {},
      f.countryId ? { countryId: f.countryId } : {},
      f.cityId ? { cityId: f.cityId } : {},
      f.q ? { name: { contains: f.q, mode: 'insensitive' as const } } : {},
    ],
  };
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const masterCardInclude = (now: Date) =>
  ({
    city: { select: { name: true } },
    country: { select: { code: true, flag: true } },
    categories: { include: { category: true } },
    promotions: {
      where: { isActive: true, validFrom: { lte: now }, validTo: { gte: now } },
      select: { discountPct: true },
    },
    services: { where: { isActive: true, deletedAt: null }, select: { price: true } },
  }) as const;

const salonCardInclude = (now: Date) =>
  ({
    city: { select: { name: true } },
    country: { select: { code: true, flag: true } },
    categories: { include: { category: true } },
    masters: {
      where: { status: { not: 'BANNED' as const } },
      select: {
        ratingAvg: true,
        ratingCount: true,
        isOnlineOpen: true,
        onlineOpenUntil: true,
        currency: true,
        categories: { include: { category: true } },
        promotions: {
          where: { isActive: true, validFrom: { lte: now }, validTo: { gte: now } },
          select: { discountPct: true },
        },
        services: { where: { isActive: true, deletedAt: null }, select: { price: true } },
      },
    },
  }) as const;

interface SortKey {
  type: 'master' | 'salon';
  id: string;
  online: boolean;
  rating: number;
  ratingCount: number;
  createdAt: Date;
  distance: number | null;
}

export async function searchTenants(
  query: SearchQuery,
  now: Date = new Date(),
): Promise<SearchResponse> {
  const [masterKeys, salonKeys] = await Promise.all([
    prisma.master.findMany({
      where: masterWhere(query, now),
      select: {
        id: true,
        ratingAvg: true,
        ratingCount: true,
        createdAt: true,
        isOnlineOpen: true,
        onlineOpenUntil: true,
        latitude: true,
        longitude: true,
      },
      take: 2000,
    }),
    prisma.salon.findMany({
      where: salonWhere(query, now),
      select: {
        id: true,
        createdAt: true,
        latitude: true,
        longitude: true,
        masters: {
          select: { ratingAvg: true, ratingCount: true, isOnlineOpen: true, onlineOpenUntil: true },
        },
      },
      take: 1000,
    }),
  ]);

  const hasGeo = query.lat !== undefined && query.lng !== undefined;
  const geo = (lat: number | null, lng: number | null) =>
    hasGeo && lat !== null && lng !== null ? distanceKm(query.lat!, query.lng!, lat, lng) : null;

  const keys: SortKey[] = [
    ...masterKeys.map((m) => ({
      type: 'master' as const,
      id: m.id,
      online: m.isOnlineOpen && !!m.onlineOpenUntil && m.onlineOpenUntil > now,
      rating: m.ratingAvg,
      ratingCount: m.ratingCount,
      createdAt: m.createdAt,
      distance: geo(m.latitude, m.longitude),
    })),
    ...salonKeys.map((s) => {
      const count = s.masters.reduce((sum, m) => sum + m.ratingCount, 0);
      const weighted = s.masters.reduce((sum, m) => sum + m.ratingAvg * m.ratingCount, 0);
      return {
        type: 'salon' as const,
        id: s.id,
        online: s.masters.some(
          (m) => m.isOnlineOpen && !!m.onlineOpenUntil && m.onlineOpenUntil > now,
        ),
        rating: count ? weighted / count : 0,
        ratingCount: count,
        createdAt: s.createdAt,
        distance: geo(s.latitude, s.longitude),
      };
    }),
  ];

  // "Available now" cards go first, then nearest (when geo is known) or best rated.
  keys.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    if (hasGeo && a.distance !== null && b.distance !== null && a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const pageSize = query.pageSize ?? LIMITS.searchPageSize;
  const page = query.page ?? 1;
  const slice = keys.slice((page - 1) * pageSize, page * pageSize);
  const masterIds = slice.filter((k) => k.type === 'master').map((k) => k.id);
  const salonIds = slice.filter((k) => k.type === 'salon').map((k) => k.id);

  const [masters, salons] = await Promise.all([
    masterIds.length
      ? prisma.master.findMany({
          where: { id: { in: masterIds } },
          include: masterCardInclude(now),
        })
      : Promise.resolve([]),
    salonIds.length
      ? prisma.salon.findMany({ where: { id: { in: salonIds } }, include: salonCardInclude(now) })
      : Promise.resolve([]),
  ]);

  const items: SearchCardDto[] = [];
  for (const key of slice) {
    if (key.type === 'master') {
      const m = masters.find((x) => x.id === key.id);
      if (!m) continue;
      const prices = m.services.map((s) => Number(s.price));
      const discounts = m.promotions.map((p) => p.discountPct);
      items.push({
        type: 'master',
        id: m.id,
        slug: m.slug,
        name: m.name,
        avatarUrl: m.avatarUrl,
        categories: m.categories.map((c) => toCategoryDto(c.category)),
        cityName: m.city?.name ?? null,
        countryFlag: m.country?.flag ?? (m.country ? countryFlag(m.country.code) : null),
        address: m.address,
        ratingAvg: m.ratingAvg,
        ratingCount: m.ratingCount,
        isOnlineNow: key.online,
        maxDiscountPct: discounts.length ? Math.max(...discounts) : null,
        latitude: m.latitude,
        longitude: m.longitude,
        mastersCount: null,
        distanceKm: key.distance !== null ? Math.round(key.distance * 10) / 10 : null,
        priceFrom: prices.length ? Math.min(...prices) : null,
        currency: m.currency,
      });
    } else {
      const s = salons.find((x) => x.id === key.id);
      if (!s) continue;
      const categories = new Map(s.categories.map((c) => [c.category.id, c.category]));
      for (const m of s.masters)
        for (const c of m.categories) categories.set(c.category.id, c.category);
      const prices = s.masters.flatMap((m) => m.services.map((x) => Number(x.price)));
      const discounts = s.masters.flatMap((m) => m.promotions.map((p) => p.discountPct));
      items.push({
        type: 'salon',
        id: s.id,
        slug: s.slug,
        name: s.name,
        avatarUrl: s.avatarUrl,
        categories: [...categories.values()]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(toCategoryDto),
        cityName: s.city?.name ?? null,
        countryFlag: s.country?.flag ?? (s.country ? countryFlag(s.country.code) : null),
        address: s.address,
        ratingAvg: Math.round(key.rating * 10) / 10,
        ratingCount: key.ratingCount,
        isOnlineNow: key.online,
        maxDiscountPct: discounts.length ? Math.max(...discounts) : null,
        latitude: s.latitude,
        longitude: s.longitude,
        mastersCount: s.masters.length,
        distanceKm: key.distance !== null ? Math.round(key.distance * 10) / 10 : null,
        priceFrom: prices.length ? Math.min(...prices) : null,
        currency: s.currency,
      });
    }
  }

  return { items, page, pageSize, total: keys.length, hasMore: page * pageSize < keys.length };
}

export async function searchMap(query: MapQuery, now: Date = new Date()): Promise<MapPointDto[]> {
  const [masters, salons] = await Promise.all([
    prisma.master.findMany({
      where: {
        AND: [masterWhere(query, now), { latitude: { not: null }, longitude: { not: null } }],
      },
      include: {
        categories: { include: { category: true } },
        promotions: {
          where: { isActive: true, validFrom: { lte: now }, validTo: { gte: now } },
          select: { discountPct: true },
        },
      },
      take: LIMITS.mapMaxPoints,
    }),
    prisma.salon.findMany({
      where: {
        AND: [salonWhere(query, now), { latitude: { not: null }, longitude: { not: null } }],
      },
      include: salonCardInclude(now),
      take: LIMITS.mapMaxPoints,
    }),
  ]);
  const points: MapPointDto[] = masters.map((m) => ({
    type: 'master',
    id: m.id,
    slug: m.slug,
    name: m.name,
    avatarUrl: m.avatarUrl,
    latitude: m.latitude!,
    longitude: m.longitude!,
    isOnlineNow: m.isOnlineOpen && !!m.onlineOpenUntil && m.onlineOpenUntil > now,
    ratingAvg: m.ratingAvg,
    ratingCount: m.ratingCount,
    maxDiscountPct: m.promotions.length
      ? Math.max(...m.promotions.map((p) => p.discountPct))
      : null,
    categories: m.categories.map((c) => toCategoryDto(c.category)),
  }));
  for (const s of salons) {
    const count = s.masters.reduce((sum, m) => sum + m.ratingCount, 0);
    const weighted = s.masters.reduce((sum, m) => sum + m.ratingAvg * m.ratingCount, 0);
    const discounts = s.masters.flatMap((m) => m.promotions.map((p) => p.discountPct));
    points.push({
      type: 'salon',
      id: s.id,
      slug: s.slug,
      name: s.name,
      avatarUrl: s.avatarUrl,
      latitude: s.latitude!,
      longitude: s.longitude!,
      isOnlineNow: s.masters.some(
        (m) => m.isOnlineOpen && !!m.onlineOpenUntil && m.onlineOpenUntil > now,
      ),
      ratingAvg: count ? Math.round((weighted / count) * 10) / 10 : 0,
      ratingCount: count,
      maxDiscountPct: discounts.length ? Math.max(...discounts) : null,
      categories: s.categories.map((c) => toCategoryDto(c.category)),
    });
  }
  return points;
}

export async function listCategories() {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toCategoryDto);
}

export async function listCountries() {
  const rows = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    nameEn: c.nameEn,
    flag: c.flag ?? countryFlag(c.code),
  }));
}

export async function listCities(countryId?: string) {
  const rows = await prisma.city.findMany({
    where: { isActive: true, ...(countryId ? { countryId } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map((c) => ({
    id: c.id,
    countryId: c.countryId,
    name: c.name,
    nameEn: c.nameEn,
    timezone: c.timezone,
    latitude: c.latitude,
    longitude: c.longitude,
  }));
}
