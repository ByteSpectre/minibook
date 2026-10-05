import {
  computeLoyaltyProgress,
  isPromotionCurrent,
  type CheckAccessResponse,
  type Paginated,
  type PublicMasterDto,
  type PublicPageResponse,
  type PublicSalonDto,
  type ReviewDto,
  type ServiceGroupDto,
} from '@nail-crm/shared';
import { prisma } from '../db/prisma';
import { computeMasterAccess, computeSalonAccess } from '../lib/access';
import { NotFoundError } from '../lib/errors';
import {
  toBlockedScreenDto,
  toCategoryDto,
  toLoyaltyRuleDto,
  toPromotionDto,
  toReviewDto,
  toServiceDto,
  toThemeDto,
} from '../lib/mappers';
import { identityOf, isBlacklisted, loadUserAtMaster } from './blacklist.service';

const subscriptionSelect = {
  status: true,
  trialEndsAt: true,
  subscriptionEndsAt: true,
  autoRenewEnabled: true,
} as const;

export async function findMasterBySlug(slug: string) {
  return prisma.master.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      avatarUrl: true,
      salonId: true,
      allowMultiService: true,
      autoConfirm: true,
      timezone: true,
      ...subscriptionSelect,
      salon: { select: { id: true, slug: true, name: true, ...subscriptionSelect } },
    },
  });
}

export type PublicMasterRef = NonNullable<Awaited<ReturnType<typeof findMasterBySlug>>>;

export function masterIsPublic(master: PublicMasterRef, now: Date = new Date()): boolean {
  return computeMasterAccess(master, master.salon, now).isPublic;
}

/** Resolves a bookable master for public endpoints, enforcing subscription and blacklist. */
export async function requirePublicMaster(slug: string, userId: string): Promise<PublicMasterRef> {
  const master = await findMasterBySlug(slug);
  if (!master || !masterIsPublic(master)) throw new NotFoundError();
  const ctx = await loadUserAtMaster(userId, master.id);
  if (await isBlacklisted(master.id, identityOf(ctx))) throw new NotFoundError();
  return master;
}

function groupServices(
  services: Parameters<typeof toServiceDto>[0][],
  categories: Map<string, Parameters<typeof toCategoryDto>[0] & { sortOrder: number }>,
): ServiceGroupDto[] {
  const groups = new Map<string | null, ServiceGroupDto & { order: number }>();
  for (const s of services) {
    const cat = s.categoryId ? categories.get(s.categoryId) : undefined;
    const key = cat ? cat.id : null;
    if (!groups.has(key)) {
      groups.set(key, {
        category: cat ? toCategoryDto(cat) : null,
        services: [],
        order: cat ? cat.sortOrder : Number.MAX_SAFE_INTEGER,
      });
    }
    groups.get(key)!.services.push(toServiceDto(s));
  }
  return [...groups.values()].sort((a, b) => a.order - b.order).map(({ order: _o, ...g }) => g);
}

function sortReviews<T extends { photos: string[]; createdAt: Date }>(reviews: T[]): T[] {
  return [...reviews].sort((a, b) => {
    const pa = a.photos.length > 0 ? 1 : 0;
    const pb = b.photos.length > 0 ? 1 : 0;
    return pb - pa || b.createdAt.getTime() - a.createdAt.getTime();
  });
}

async function buildPublicMaster(
  masterId: string,
  userId: string,
  now: Date,
): Promise<PublicMasterDto> {
  const m = await prisma.master.findUniqueOrThrow({
    where: { id: masterId },
    include: {
      city: true,
      country: true,
      theme: true,
      salon: { select: { slug: true, name: true } },
      categories: { include: { category: true } },
      services: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      promotions: {
        where: { isActive: true, validTo: { gte: now } },
        include: { service: { select: { name: true } } },
      },
      loyaltyRules: { where: { isActive: true } },
      reviews: { where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 60 },
    },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { telegramId: true },
  });
  const client = await prisma.client.findUnique({
    where: { masterId_telegramId: { masterId, telegramId: user.telegramId } },
    select: { id: true },
  });
  const completedVisits = client
    ? await prisma.appointment.count({
        where: { masterId, clientId: client.id, status: 'COMPLETED' },
      })
    : 0;
  const categoryMap = new Map(m.categories.map((c) => [c.category.id, c.category]));
  for (const s of m.services) {
    if (s.categoryId && !categoryMap.has(s.categoryId)) {
      const cat = await prisma.category.findUnique({ where: { id: s.categoryId } });
      if (cat) categoryMap.set(cat.id, cat);
    }
  }
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    username: m.username,
    channelUsername: m.channelUsername,
    avatarUrl: m.avatarUrl,
    rules: m.rules,
    address: m.address,
    latitude: m.latitude,
    longitude: m.longitude,
    cityName: m.city?.name ?? null,
    countryName: m.country?.name ?? null,
    timezone: m.timezone,
    currency: m.currency,
    categories: m.categories
      .map((c) => c.category)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toCategoryDto),
    ratingAvg: m.ratingAvg,
    ratingCount: m.ratingCount,
    isOnlineNow: m.isOnlineOpen && !!m.onlineOpenUntil && m.onlineOpenUntil > now,
    onlineOpenUntil: m.isOnlineOpen && m.onlineOpenUntil ? m.onlineOpenUntil.toISOString() : null,
    allowMultiService: m.allowMultiService,
    theme: toThemeDto(m.theme),
    promotions: m.promotions.filter((p) => isPromotionCurrent(p, now)).map(toPromotionDto),
    serviceGroups: groupServices(m.services, categoryMap),
    loyaltyRules: m.loyaltyRules.map(toLoyaltyRuleDto),
    loyaltyProgress: computeLoyaltyProgress(m.loyaltyRules, completedVisits),
    reviews: sortReviews(m.reviews).slice(0, 20).map(toReviewDto),
    salon: m.salon ? { slug: m.salon.slug, name: m.salon.name } : null,
  };
}

async function buildPublicSalon(salonId: string, now: Date): Promise<PublicSalonDto> {
  const s = await prisma.salon.findUniqueOrThrow({
    where: { id: salonId },
    include: {
      city: true,
      country: true,
      theme: true,
      categories: { include: { category: true } },
      masters: {
        where: { status: { not: 'BANNED' } },
        include: {
          categories: { include: { category: true } },
          services: { where: { isActive: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } },
          promotions: {
            where: { isActive: true, validTo: { gte: now } },
            include: { service: { select: { name: true } } },
          },
          reviews: { where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        },
        orderBy: { ratingAvg: 'desc' },
      },
    },
  });
  const totalCount = s.masters.reduce((sum, m) => sum + m.ratingCount, 0);
  const weighted = s.masters.reduce((sum, m) => sum + m.ratingAvg * m.ratingCount, 0);
  const categories = new Map(s.categories.map((c) => [c.category.id, c.category]));
  for (const m of s.masters)
    for (const c of m.categories) categories.set(c.category.id, c.category);
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    username: s.username,
    channelUsername: s.channelUsername,
    avatarUrl: s.avatarUrl,
    rules: s.rules,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    cityName: s.city?.name ?? null,
    countryName: s.country?.name ?? null,
    timezone: s.timezone,
    currency: s.currency,
    categories: [...categories.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toCategoryDto),
    ratingAvg: totalCount > 0 ? Math.round((weighted / totalCount) * 10) / 10 : 0,
    ratingCount: totalCount,
    isOnlineNow: s.masters.some(
      (m) => m.isOnlineOpen && !!m.onlineOpenUntil && m.onlineOpenUntil > now,
    ),
    theme: toThemeDto(s.theme),
    masters: s.masters.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      avatarUrl: m.avatarUrl,
      categories: m.categories.map((c) => toCategoryDto(c.category)),
      ratingAvg: m.ratingAvg,
      ratingCount: m.ratingCount,
      isOnlineNow: m.isOnlineOpen && !!m.onlineOpenUntil && m.onlineOpenUntil > now,
      servicesCount: m.services.length,
      priceFrom: m.services.length ? Math.min(...m.services.map((x) => Number(x.price))) : null,
    })),
    services: s.masters.flatMap((m) =>
      m.services.map((svc) => ({ ...toServiceDto(svc), masterId: m.id, masterName: m.name })),
    ),
    promotions: s.masters.flatMap((m) =>
      m.promotions
        .filter((p) => isPromotionCurrent(p, now))
        .map((p) => ({
          ...toPromotionDto(p),
          masterId: m.id,
          masterSlug: m.slug,
          masterName: m.name,
        })),
    ),
    reviews: sortReviews(s.masters.flatMap((m) => m.reviews))
      .slice(0, 20)
      .map(toReviewDto),
  };
}

export async function getPublicPage(
  slug: string,
  userId: string,
  now: Date = new Date(),
): Promise<PublicPageResponse> {
  const master = await findMasterBySlug(slug);
  if (master) {
    if (!masterIsPublic(master, now))
      return { kind: 'expired', name: master.name, avatarUrl: master.avatarUrl };
    const ctx = await loadUserAtMaster(userId, master.id);
    if (await isBlacklisted(master.id, identityOf(ctx))) {
      const screen = await prisma.blockedScreen.findUnique({ where: { masterId: master.id } });
      return { kind: 'blocked', screen: toBlockedScreenDto(screen) };
    }
    return { kind: 'master', master: await buildPublicMaster(master.id, userId, now) };
  }
  const salon = await prisma.salon.findUnique({
    where: { slug },
    select: { id: true, name: true, avatarUrl: true, ...subscriptionSelect },
  });
  if (!salon) throw new NotFoundError();
  if (!computeSalonAccess(salon, now).isPublic)
    return { kind: 'expired', name: salon.name, avatarUrl: salon.avatarUrl };
  return { kind: 'salon', salon: await buildPublicSalon(salon.id, now) };
}

export async function getPublicReviews(
  slug: string,
  page: number,
  pageSize: number,
): Promise<Paginated<ReviewDto>> {
  const master = await findMasterBySlug(slug);
  let masterIds: string[];
  if (master) {
    if (!masterIsPublic(master)) throw new NotFoundError();
    masterIds = [master.id];
  } else {
    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { masters: { select: { id: true } } },
    });
    if (!salon) throw new NotFoundError();
    masterIds = salon.masters.map((m) => m.id);
  }
  const where = { masterId: { in: masterIds }, isPublished: true };
  const [total, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 }),
  ]);
  const sorted = sortReviews(rows).slice((page - 1) * pageSize, page * pageSize);
  return {
    items: sorted.map(toReviewDto),
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  };
}

/** Booking form prefill: master-local Client → global ClientProfile → Telegram initData. */
export async function checkAccess(slug: string, userId: string): Promise<CheckAccessResponse> {
  const master = await findMasterBySlug(slug);
  if (!master) throw new NotFoundError();
  const ctx = await loadUserAtMaster(userId, master.id);
  const contact = {
    firstName: ctx.client?.firstName ?? ctx.profile?.firstName ?? ctx.user.firstName ?? null,
    phone: ctx.client?.phone ?? ctx.profile?.phone ?? null,
    phoneCountry: ctx.profile?.phoneCountry ?? null,
    username: ctx.client?.username ?? ctx.profile?.username ?? ctx.user.username ?? null,
  };
  if (!masterIsPublic(master)) {
    return { allowed: false, reason: 'expired', screen: null, contact, clientId: null };
  }
  if (await isBlacklisted(master.id, identityOf(ctx))) {
    const screen = await prisma.blockedScreen.findUnique({ where: { masterId: master.id } });
    return {
      allowed: false,
      reason: 'blocked',
      screen: toBlockedScreenDto(screen),
      contact: { firstName: null, phone: null, phoneCountry: null, username: null },
      clientId: null,
    };
  }
  return { allowed: true, reason: null, screen: null, contact, clientId: ctx.client?.id ?? null };
}
