import type { z } from 'zod';
import {
  addDaysIso,
  countryFlag,
  effectiveStatus,
  SUB_STATUSES,
  type adminListQuerySchema,
  type AdminCategoryDto,
  type AdminCityDto,
  type AdminCountryDto,
  type AdminPaymentRowDto,
  type AdminStatsDto,
  type AdminTenantRowDto,
  type CategoryUpsertInput,
  type CityUpsertInput,
  type CountryUpsertInput,
  type ExperimentDto,
  type ExperimentUpsertInput,
  type FunnelDto,
  type Paginated,
  type PaymentStatus,
  type PlatformSettingsDto,
  type PromoCodeDto,
  type PromoCodeUpsertInput,
  type SubStatus,
  type TenantActionInput,
  type TenantKind,
} from '@nail-crm/shared';
import { config, env } from '../config';
import { prisma } from '../db/prisma';
import { conflict, NotFoundError } from '../lib/errors';
import { localDay, startOfLocalDay } from '../lib/time';
import { experimentResults } from './billing/experiments.service';
import { grantDays, loadTenant, updateTenant } from './billing/billing.service';
import { getPlatformSettings, updatePlatformSettings } from './settings.service';

type ListQuery = z.output<typeof adminListQuerySchema>;
const PTZ = env.PLATFORM_TIMEZONE;

const emptyStatusMap = (): Record<SubStatus, number> =>
  Object.fromEntries(SUB_STATUSES.map((s) => [s, 0])) as Record<SubStatus, number>;

export async function getAdminStats(now: Date = new Date()): Promise<AdminStatsDto> {
  const today = localDay(now, PTZ);
  const from30 = startOfLocalDay(addDaysIso(today, -29), PTZ);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const settings = await getPlatformSettings();
  const [
    users,
    clients,
    masters,
    salons,
    payments,
    appointments30d,
    newMasters7d,
    newSalons7d,
    completed,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.clientProfile.count({ where: { onboardingCompleted: true } }),
    prisma.master.findMany({
      select: { status: true, trialEndsAt: true, subscriptionEndsAt: true, salonId: true },
    }),
    prisma.salon.findMany({
      select: { status: true, trialEndsAt: true, subscriptionEndsAt: true },
    }),
    prisma.payment.findMany({
      where: { status: 'succeeded', paidAt: { gte: from30 } },
      select: { amountKopeks: true, paidAt: true },
    }),
    prisma.appointment.count({ where: { createdAt: { gte: from30 } } }),
    prisma.master.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.salon.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.appointment.groupBy({
      by: ['masterId'],
      where: { status: 'COMPLETED', startAt: { gte: from30 } },
      _sum: { price: true },
      _count: { _all: true },
      orderBy: { _sum: { price: 'desc' } },
      take: 5,
    }),
  ]);
  const byStatus = emptyStatusMap();
  let activeMasters = 0;
  for (const m of masters) {
    const s = effectiveStatus(m, now);
    byStatus[s] += 1;
    if (s === 'ACTIVE' && !m.salonId) activeMasters += 1;
  }
  const salonsByStatus = emptyStatusMap();
  let activeSalons = 0;
  for (const s of salons) {
    const st = effectiveStatus(s, now);
    salonsByStatus[st] += 1;
    if (st === 'ACTIVE') activeSalons += 1;
  }
  const revenueByDay = new Map<string, number>();
  for (let i = 0; i < 30; i += 1) revenueByDay.set(addDaysIso(today, -29 + i), 0);
  for (const p of payments) {
    if (!p.paidAt) continue;
    const day = localDay(p.paidAt, PTZ);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + p.amountKopeks / 100);
  }
  const topInfo = await prisma.master.findMany({
    where: { id: { in: completed.map((c) => c.masterId) } },
    select: { id: true, name: true, slug: true },
  });
  return {
    users,
    clients,
    masters: masters.length,
    salons: salons.length,
    byStatus,
    salonsByStatus,
    mrrRub: activeMasters * settings.masterPriceRub + activeSalons * settings.salonPriceRub,
    revenue30dRub: payments.reduce((sum, p) => sum + p.amountKopeks, 0) / 100,
    payments30d: payments.length,
    appointments30d,
    newMasters7d,
    newSalons7d,
    revenueByDay: [...revenueByDay.entries()].map(([date, amount]) => ({ date, amount })),
    topMasters: completed.map((c) => {
      const info = topInfo.find((m) => m.id === c.masterId);
      return {
        id: c.masterId,
        name: info?.name ?? '—',
        slug: info?.slug ?? '',
        revenue: Number(c._sum.price ?? 0),
        appointments: c._count._all,
      };
    }),
  };
}

export async function getFunnel(now: Date = new Date()): Promise<FunnelDto> {
  const countEvents = async (type: string, roles?: string[]) =>
    (
      await prisma.funnelEvent.findMany({
        where: { type, ...(roles ? { role: { in: roles } } : {}) },
        select: { userId: true },
        distinct: ['userId'],
      })
    ).length;
  const tenantRoles = ['MASTER', 'SALON'];
  const [users, botStart, appOpen, started, completed, firstAppointment, subscribed] =
    await Promise.all([
      prisma.user.count(),
      countEvents('BOT_START'),
      countEvents('APP_OPEN'),
      countEvents('ONBOARDING_STARTED', tenantRoles),
      countEvents('ONBOARDING_COMPLETED', tenantRoles),
      countEvents('FIRST_APPOINTMENT', ['MASTER']),
      countEvents('SUBSCRIBED', tenantRoles),
    ]);
  const [masters, salons] = await Promise.all([
    prisma.master.findMany({
      select: { status: true, trialEndsAt: true, subscriptionEndsAt: true, salonId: true },
    }),
    prisma.salon.findMany({
      select: { status: true, trialEndsAt: true, subscriptionEndsAt: true },
    }),
  ]);
  const churnedMasters = masters.filter(
    (m) => !m.salonId && effectiveStatus(m, now) === 'EXPIRED',
  ).length;
  const churnedSalons = salons.filter((s) => effectiveStatus(s, now) === 'EXPIRED').length;
  const raw: { key: FunnelDto['steps'][number]['key']; count: number }[] = [
    { key: 'USERS', count: users },
    { key: 'BOT_START', count: botStart },
    { key: 'APP_OPEN', count: appOpen },
    { key: 'ONBOARDING_STARTED', count: started },
    { key: 'ONBOARDING_COMPLETED', count: completed },
    { key: 'FIRST_APPOINTMENT', count: firstAppointment },
    { key: 'SUBSCRIBED', count: subscribed },
    { key: 'CHURNED', count: churnedMasters + churnedSalons },
  ];
  const steps = raw.map((s, i) => {
    const prev = i === 0 ? s.count : (raw[i - 1]?.count ?? 0);
    const base = s.key === 'CHURNED' ? completed : prev;
    return {
      ...s,
      label: s.key,
      conversionPct: base ? Math.round((s.count / base) * 1000) / 10 : 0,
    };
  });
  const byRole = await Promise.all(
    (['MASTER', 'SALON'] as const).map(async (role) => ({
      role,
      started: await countEvents('ONBOARDING_STARTED', [role]),
      completed: await countEvents('ONBOARDING_COMPLETED', [role]),
      firstAppointment: role === 'MASTER' ? firstAppointment : 0,
      subscribed: await countEvents('SUBSCRIBED', [role]),
      churned: role === 'MASTER' ? churnedMasters : churnedSalons,
    })),
  );
  const today = localDay(now, PTZ);
  const weekly: FunnelDto['weekly'] = [];
  for (let w = 7; w >= 0; w -= 1) {
    const from = startOfLocalDay(addDaysIso(today, -(w + 1) * 7 + 1), PTZ);
    const to = startOfLocalDay(addDaysIso(today, -w * 7 + 1), PTZ);
    const [newUsers, newMasters, subs] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: from, lt: to } } }),
      prisma.master.count({ where: { createdAt: { gte: from, lt: to } } }),
      prisma.funnelEvent.count({ where: { type: 'SUBSCRIBED', createdAt: { gte: from, lt: to } } }),
    ]);
    weekly.push({ week: localDay(from, PTZ), newUsers, newMasters, subscribed: subs });
  }
  return { steps, byRole, weekly };
}

export async function listTenants(
  kind: TenantKind,
  q: ListQuery,
  now: Date = new Date(),
): Promise<Paginated<AdminTenantRowDto>> {
  const search = q.q
    ? {
        OR: [
          { name: { contains: q.q, mode: 'insensitive' as const } },
          { slug: { contains: q.q.toLowerCase() } },
        ],
      }
    : {};
  const rows: AdminTenantRowDto[] = [];
  if (kind === 'master') {
    const masters = await prisma.master.findMany({
      where: search,
      orderBy: { createdAt: 'desc' },
      include: {
        city: { select: { name: true } },
        user: { select: { telegramId: true } },
        salon: { select: { name: true } },
        experiment: { select: { variant: true } },
        _count: { select: { appointments: true } },
        payments: { where: { status: 'succeeded' }, select: { amountKopeks: true } },
      },
      take: 1000,
    });
    for (const m of masters) {
      rows.push({
        id: m.id,
        kind: 'master',
        slug: m.slug,
        name: m.name,
        username: m.username,
        ownerTelegramId: m.user.telegramId.toString(),
        cityName: m.city?.name ?? null,
        status: m.status,
        effectiveStatus: effectiveStatus(m, now),
        trialEndsAt: m.trialEndsAt?.toISOString() ?? null,
        subscriptionEndsAt: m.subscriptionEndsAt?.toISOString() ?? null,
        autoRenewEnabled: m.autoRenewEnabled,
        bannedReason: m.bannedReason,
        createdAt: m.createdAt.toISOString(),
        appointmentsCount: m._count.appointments,
        paidTotalRub: m.payments.reduce((s, p) => s + p.amountKopeks, 0) / 100,
        mastersCount: null,
        salonName: m.salon?.name ?? null,
        experimentVariant: m.experiment?.variant ?? null,
      });
    }
  } else {
    const salons = await prisma.salon.findMany({
      where: search,
      orderBy: { createdAt: 'desc' },
      include: {
        city: { select: { name: true } },
        owner: { select: { telegramId: true } },
        _count: { select: { masters: true } },
        payments: { where: { status: 'succeeded' }, select: { amountKopeks: true } },
        masters: { select: { _count: { select: { appointments: true } } } },
      },
      take: 1000,
    });
    for (const s of salons) {
      rows.push({
        id: s.id,
        kind: 'salon',
        slug: s.slug,
        name: s.name,
        username: s.username,
        ownerTelegramId: s.owner.telegramId.toString(),
        cityName: s.city?.name ?? null,
        status: s.status,
        effectiveStatus: effectiveStatus(s, now),
        trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
        subscriptionEndsAt: s.subscriptionEndsAt?.toISOString() ?? null,
        autoRenewEnabled: s.autoRenewEnabled,
        bannedReason: s.bannedReason,
        createdAt: s.createdAt.toISOString(),
        appointmentsCount: s.masters.reduce((sum, m) => sum + m._count.appointments, 0),
        paidTotalRub: s.payments.reduce((sum, p) => sum + p.amountKopeks, 0) / 100,
        mastersCount: s._count.masters,
        salonName: null,
        experimentVariant: null,
      });
    }
  }
  const filtered = q.status ? rows.filter((r) => r.effectiveStatus === q.status) : rows;
  const items = filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
  return {
    items,
    page: q.page,
    pageSize: q.pageSize,
    total: filtered.length,
    hasMore: q.page * q.pageSize < filtered.length,
  };
}

export async function tenantAction(
  kind: TenantKind,
  id: string,
  input: TenantActionInput,
  now: Date = new Date(),
): Promise<{ ok: true; status: SubStatus }> {
  const t = await loadTenant(kind, id);
  if (input.action === 'ban') {
    await updateTenant(prisma, kind, id, {
      status: 'BANNED',
      bannedAt: now,
      bannedReason: input.reason ?? null,
    });
    if (kind === 'master')
      await prisma.master.update({
        where: { id },
        data: { isOnlineOpen: false, onlineOpenUntil: null },
      });
    return { ok: true, status: 'BANNED' };
  }
  if (input.action === 'unban') {
    const status: SubStatus =
      t.subscriptionEndsAt && t.subscriptionEndsAt > now
        ? t.autoRenewEnabled
          ? 'ACTIVE'
          : 'CANCELLED'
        : t.trialEndsAt && t.trialEndsAt > now
          ? 'TRIAL'
          : 'EXPIRED';
    await updateTenant(prisma, kind, id, { status, bannedAt: null, bannedReason: null });
    return { ok: true, status };
  }
  const days = input.days ?? 0;
  const tenant = t.status === 'EXPIRED' ? { ...t, status: 'ACTIVE' as const } : t;
  await grantDays(prisma, tenant, days, now);
  const fresh = await loadTenant(kind, id);
  return { ok: true, status: effectiveStatus(fresh, now) };
}

export async function listAdminPayments(q: {
  status?: string;
  page: number;
  pageSize: number;
}): Promise<Paginated<AdminPaymentRowDto>> {
  const where = q.status ? { status: q.status } : {};
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        master: { select: { id: true, name: true, slug: true } },
        salon: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);
  return {
    items: rows.map((p) => ({
      id: p.id,
      amountRub: p.amountKopeks / 100,
      periodDays: p.periodDays,
      status: p.status as PaymentStatus,
      isAutoPayment: p.isAutoPayment,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      description: p.description,
      provider: p.provider,
      externalId: p.externalId,
      tenant: p.master
        ? { kind: 'master' as const, ...p.master }
        : p.salon
          ? { kind: 'salon' as const, ...p.salon }
          : null,
    })),
    page: q.page,
    pageSize: q.pageSize,
    total,
    hasMore: q.page * q.pageSize < total,
  };
}

/* ───────────── Dictionaries ───────────── */

export async function adminListCategories(): Promise<AdminCategoryDto[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { masters: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    nameEn: c.nameEn,
    emoji: c.emoji,
    imageUrl: c.imageUrl,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    mastersCount: c._count.masters,
  }));
}

export async function upsertCategory(id: string | null, input: CategoryUpsertInput) {
  const data = {
    name: input.name,
    nameEn: input.nameEn ?? null,
    slug: input.slug,
    emoji: input.emoji ?? null,
    imageUrl: input.imageUrl ?? null,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };
  return id ? prisma.category.update({ where: { id }, data }) : prisma.category.create({ data });
}

export async function deleteCategory(id: string) {
  const used = await prisma.masterCategory.count({ where: { categoryId: id } });
  if (used > 0) throw conflict('inUse', 'Category is used by masters — deactivate it instead');
  await prisma.category.delete({ where: { id } });
}

export async function adminListCountries(): Promise<AdminCountryDto[]> {
  const rows = await prisma.country.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { cities: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    nameEn: c.nameEn,
    flag: c.flag ?? countryFlag(c.code),
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    citiesCount: c._count.cities,
  }));
}

export async function upsertCountry(id: string | null, input: CountryUpsertInput) {
  const data = {
    name: input.name,
    nameEn: input.nameEn ?? null,
    code: input.code,
    flag: input.flag ?? countryFlag(input.code),
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };
  return id ? prisma.country.update({ where: { id }, data }) : prisma.country.create({ data });
}

export async function deleteCountry(id: string) {
  const used =
    (await prisma.master.count({ where: { countryId: id } })) +
    (await prisma.salon.count({ where: { countryId: id } }));
  if (used > 0) throw conflict('inUse', 'Country is used — deactivate it instead');
  await prisma.country.delete({ where: { id } });
}

export async function adminListCities(countryId?: string): Promise<AdminCityDto[]> {
  const rows = await prisma.city.findMany({
    where: countryId ? { countryId } : {},
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { masters: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    countryId: c.countryId,
    name: c.name,
    nameEn: c.nameEn,
    timezone: c.timezone,
    latitude: c.latitude,
    longitude: c.longitude,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    mastersCount: c._count.masters,
  }));
}

export async function upsertCity(id: string | null, input: CityUpsertInput) {
  const country = await prisma.country.findUnique({
    where: { id: input.countryId },
    select: { id: true },
  });
  if (!country) throw new NotFoundError();
  const data = {
    name: input.name,
    nameEn: input.nameEn ?? null,
    countryId: input.countryId,
    timezone: input.timezone,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };
  return id ? prisma.city.update({ where: { id }, data }) : prisma.city.create({ data });
}

export async function deleteCity(id: string) {
  const used =
    (await prisma.master.count({ where: { cityId: id } })) +
    (await prisma.salon.count({ where: { cityId: id } }));
  if (used > 0) throw conflict('inUse', 'City is used — deactivate it instead');
  await prisma.city.delete({ where: { id } });
}

/* ───────────── Promo codes & experiments ───────────── */

const toPromoDto = (p: {
  id: string;
  code: string;
  type: PromoCodeDto['type'];
  value: number;
  maxUsages: number | null;
  usedCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}): PromoCodeDto => ({
  id: p.id,
  code: p.code,
  type: p.type,
  value: p.value,
  maxUsages: p.maxUsages,
  usedCount: p.usedCount,
  expiresAt: p.expiresAt?.toISOString() ?? null,
  isActive: p.isActive,
  createdAt: p.createdAt.toISOString(),
});

export async function listPromoCodes(): Promise<PromoCodeDto[]> {
  return (await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })).map(toPromoDto);
}

export async function upsertPromoCode(
  id: string | null,
  input: PromoCodeUpsertInput,
): Promise<PromoCodeDto> {
  const data = {
    code: input.code.toUpperCase(),
    type: input.type,
    value: input.value,
    maxUsages: input.maxUsages ?? null,
    expiresAt: input.expiresAt ? new Date(`${input.expiresAt}T23:59:59.999Z`) : null,
    isActive: input.isActive ?? true,
  };
  const row = id
    ? await prisma.promoCode.update({ where: { id }, data })
    : await prisma.promoCode.create({ data });
  return toPromoDto(row);
}

export async function deletePromoCode(id: string) {
  await prisma.promoCode.delete({ where: { id } });
}

async function toExperimentDto(e: {
  id: string;
  name: string;
  hypothesis: string | null;
  variantA: unknown;
  variantB: unknown;
  splitPercent: number;
  isActive: boolean;
  createdAt: Date;
}): Promise<ExperimentDto> {
  return {
    id: e.id,
    name: e.name,
    hypothesis: e.hypothesis,
    variantA: (e.variantA ?? {}) as Record<string, unknown>,
    variantB: (e.variantB ?? {}) as Record<string, unknown>,
    splitPercent: e.splitPercent,
    isActive: e.isActive,
    createdAt: e.createdAt.toISOString(),
    results: await experimentResults(e.id),
  };
}

export async function listExperiments(): Promise<ExperimentDto[]> {
  const rows = await prisma.experiment.findMany({ orderBy: { createdAt: 'desc' } });
  return Promise.all(rows.map(toExperimentDto));
}

/** Only one experiment can run at a time (a master has a single assignment). */
export async function upsertExperiment(
  id: string | null,
  input: ExperimentUpsertInput,
): Promise<ExperimentDto> {
  const data = {
    name: input.name,
    hypothesis: input.hypothesis ?? null,
    variantA: input.variantA,
    variantB: input.variantB,
    splitPercent: input.splitPercent ?? 50,
    isActive: input.isActive ?? false,
  };
  const row = await prisma.$transaction(async (tx) => {
    if (data.isActive)
      await tx.experiment.updateMany({
        where: { isActive: true, ...(id ? { id: { not: id } } : {}) },
        data: { isActive: false },
      });
    return id ? tx.experiment.update({ where: { id }, data }) : tx.experiment.create({ data });
  });
  return toExperimentDto(row);
}

export async function deleteExperiment(id: string) {
  await prisma.experiment.delete({ where: { id } });
}

export async function getAdminSettings(): Promise<PlatformSettingsDto> {
  const s = await getPlatformSettings();
  return {
    ...s,
    periodDays: env.SUBSCRIPTION_PERIOD_DAYS,
    paymentProvider: config.paymentProvider,
    botConnected: config.botEnabled,
    yandexMapsConfigured: false,
  };
}

export { updatePlatformSettings };
