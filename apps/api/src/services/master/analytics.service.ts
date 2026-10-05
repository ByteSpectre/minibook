import {
  addDaysIso,
  ageFromBirthday,
  isoWeekdayOf,
  LIMITS,
  toMinutes,
  type AnalyticsDto,
  type DashboardDto,
  type Gender,
} from '@nail-crm/shared';
import { appointmentInclude, toMasterAppointmentDto } from '../../lib/mappers';
import { localParts, startOfLocalDay } from '../../lib/time';
import type { TenantScope } from '../scope';

const AGE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '<18', min: 0, max: 17 },
  { label: '18–24', min: 18, max: 24 },
  { label: '25–34', min: 25, max: 34 },
  { label: '35–44', min: 35, max: 44 },
  { label: '45–54', min: 45, max: 54 },
  { label: '55+', min: 55, max: 200 },
];

const round2 = (v: number) => Math.round(v * 100) / 100;

async function demographics(scope: TenantScope, now: Date) {
  const clients = await scope.db.client.findMany({ select: { gender: true, birthday: true } });
  const genderCounts = new Map<Gender | 'UNKNOWN', number>();
  for (const c of clients) {
    const key = c.gender && c.gender !== 'UNSPECIFIED' ? c.gender : 'UNKNOWN';
    genderCounts.set(key, (genderCounts.get(key) ?? 0) + 1);
  }
  const ages = AGE_BUCKETS.map((b) => ({
    bucket: b.label,
    count: clients.filter((c) => {
      if (!c.birthday) return false;
      const age = ageFromBirthday(c.birthday, now);
      return age >= b.min && age <= b.max;
    }).length,
  }));
  return {
    gender: [...genderCounts.entries()].map(([gender, count]) => ({ gender, count })),
    ages,
  };
}

/** Booked minutes vs. working minutes from now until the end of the local month. */
async function monthLoad(scope: TenantScope, now: Date): Promise<number> {
  const today = localParts(now, scope.timezone);
  const [y, m] = today.day.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate();
  const monthEnd = `${today.day.slice(0, 8)}${String(lastDay).padStart(2, '0')}`;
  const end = startOfLocalDay(addDaysIso(monthEnd, 1), scope.timezone);
  const [schedule, appointments] = await Promise.all([
    scope.db.scheduleSlot.findMany({
      where: { isWorking: true },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
    scope.db.appointment.findMany({
      where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: now, lt: end } },
      select: { startAt: true, endAt: true },
    }),
  ]);
  let available = 0;
  for (let day = today.day; day <= monthEnd; day = addDaysIso(day, 1)) {
    const wd = isoWeekdayOf(day);
    for (const s of schedule.filter((x) => x.dayOfWeek === wd)) {
      let from = toMinutes(s.startTime);
      const to = toMinutes(s.endTime);
      if (day === today.day) from = Math.max(from, today.minutes);
      available += Math.max(0, to - from);
    }
  }
  const booked = appointments.reduce(
    (sum, a) => sum + (a.endAt.getTime() - a.startAt.getTime()) / 60000,
    0,
  );
  return available > 0 ? Math.min(100, Math.round((booked / available) * 100)) : 0;
}

export async function getDashboard(
  scope: TenantScope,
  now: Date = new Date(),
): Promise<DashboardDto> {
  const tz = scope.timezone;
  const today = localParts(now, tz).day;
  const todayStart = startOfLocalDay(today, tz);
  const tomorrowStart = startOfLocalDay(addDaysIso(today, 1), tz);
  const monthStart = startOfLocalDay(`${today.slice(0, 8)}01`, tz);
  const from30 = startOfLocalDay(addDaysIso(today, -29), tz);
  const from56 = startOfLocalDay(addDaysIso(today, -55), tz);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const sleepingBefore = new Date(now.getTime() - LIMITS.sleepingClientDays * 86_400_000);

  const [
    todayCount,
    weekRows,
    completed30,
    monthCompleted,
    recent,
    topClients,
    sleeping,
    upcoming,
    pendingCount,
    masters,
  ] = await Promise.all([
    scope.db.appointment.count({
      where: {
        startAt: { gte: todayStart, lt: tomorrowStart },
        status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
      },
    }),
    scope.db.appointment.findMany({
      where: {
        startAt: { gte: weekAgo, lt: now },
        status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] },
      },
      select: { clientId: true },
      distinct: ['clientId'],
    }),
    scope.db.appointment.findMany({
      where: { status: 'COMPLETED', startAt: { gte: from30, lt: tomorrowStart } },
      select: { startAt: true, price: true },
    }),
    scope.db.appointment.aggregate({
      where: { status: 'COMPLETED', startAt: { gte: monthStart, lt: tomorrowStart } },
      _sum: { price: true },
      _count: { _all: true },
    }),
    scope.db.appointment.findMany({
      where: {
        startAt: { gte: from56, lt: tomorrowStart },
        status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] },
      },
      select: {
        startAt: true,
        endAt: true,
        status: true,
        services: { select: { serviceId: true, name: true, price: true } },
        price: true,
      },
    }),
    scope.db.client.findMany({
      where: { visitsCount: { gt: 0 } },
      orderBy: { totalSpent: 'desc' },
      take: 3,
      select: { id: true, firstName: true, visitsCount: true, totalSpent: true },
    }),
    scope.db.client.findMany({
      where: {
        lastVisitAt: { lt: sleepingBefore },
        appointments: { none: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gt: now } } },
      },
      orderBy: { lastVisitAt: 'desc' },
      take: 10,
      select: { id: true, firstName: true, lastVisitAt: true, telegramId: true },
    }),
    scope.db.appointment.findMany({
      where: { startAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } },
      include: appointmentInclude,
      orderBy: { startAt: 'asc' },
      take: 5,
    }),
    scope.db.appointment.count({ where: { startAt: { gte: now }, status: 'PENDING' } }),
    scope.db.master.findMany({
      where: { id: { in: scope.masterIds } },
      select: { isOnlineOpen: true, onlineOpenUntil: true },
    }),
  ]);

  const revenueByDay = new Map<string, number>();
  for (let i = 0; i < 30; i += 1) revenueByDay.set(addDaysIso(today, -29 + i), 0);
  for (const a of completed30) {
    const day = localParts(a.startAt, tz).day;
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(a.price ?? 0));
  }

  const load = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, count: 0, minutes: 0 }));
  const serviceStats = new Map<
    string,
    { id: string; name: string; count: number; revenue: number }
  >();
  for (const a of recent) {
    const wd = localParts(a.startAt, tz).isoWeekday;
    const entry = load[wd - 1]!;
    entry.count += 1;
    entry.minutes += Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60000);
    for (const s of a.services) {
      const stat = serviceStats.get(s.serviceId) ?? {
        id: s.serviceId,
        name: s.name,
        count: 0,
        revenue: 0,
      };
      stat.count += 1;
      if (a.status === 'COMPLETED') stat.revenue += Number(s.price ?? 0);
      serviceStats.set(s.serviceId, stat);
    }
  }

  const monthRevenue = Number(monthCompleted._sum.price ?? 0);
  const monthCount = monthCompleted._count._all;
  const online = masters.find(
    (m) => m.isOnlineOpen && m.onlineOpenUntil && m.onlineOpenUntil > now,
  );

  return {
    todayCount,
    weekClients: weekRows.length,
    monthRevenue: round2(monthRevenue),
    avgCheck: monthCount ? round2(monthRevenue / monthCount) : 0,
    currency: scope.currency,
    timezone: tz,
    revenue30d: [...revenueByDay.entries()].map(([date, amount]) => ({
      date,
      amount: round2(amount),
    })),
    loadByWeekday: load,
    topClients: topClients.map((c) => ({
      id: c.id,
      name: c.firstName ?? '—',
      visits: c.visitsCount,
      spent: Number(c.totalSpent),
    })),
    topServices: [...serviceStats.values()].sort((a, b) => b.count - a.count).slice(0, 3),
    sleepingClients: sleeping.map((c) => ({
      id: c.id,
      name: c.firstName ?? '—',
      lastVisitAt: c.lastVisitAt!.toISOString(),
      daysSince: Math.floor((now.getTime() - c.lastVisitAt!.getTime()) / 86_400_000),
      hasTelegram: c.telegramId !== null,
    })),
    monthLoadPct: await monthLoad(scope, now),
    ...(await demographics(scope, now)),
    upcoming: upcoming.map(toMasterAppointmentDto),
    pendingCount,
    isOnlineOpen: !!online,
    onlineOpenUntil: online?.onlineOpenUntil ? online.onlineOpenUntil.toISOString() : null,
  };
}

export async function getAnalytics(
  scope: TenantScope,
  periodDays: number,
  now: Date = new Date(),
): Promise<AnalyticsDto> {
  const tz = scope.timezone;
  const today = localParts(now, tz).day;
  const firstDay = addDaysIso(today, -(periodDays - 1));
  const from = startOfLocalDay(firstDay, tz);
  const to = startOfLocalDay(addDaysIso(today, 1), tz);
  const [rows, masters] = await Promise.all([
    scope.db.appointment.findMany({
      where: { startAt: { gte: from, lt: to } },
      select: {
        startAt: true,
        status: true,
        price: true,
        masterId: true,
        clientId: true,
        services: { select: { serviceId: true, name: true, price: true } },
      },
    }),
    scope.db.master.findMany({
      where: { id: { in: scope.masterIds } },
      select: { id: true, name: true },
    }),
  ]);
  const firstVisits = await scope.db.appointment.groupBy({
    by: ['clientId'],
    where: { status: 'COMPLETED' },
    _min: { startAt: true },
  });
  const firstVisitOf = new Map(firstVisits.map((f) => [f.clientId, f._min.startAt]));

  const byDay = new Map<string, { amount: number; count: number }>();
  for (let d = firstDay; d <= today; d = addDaysIso(d, 1)) byDay.set(d, { amount: 0, count: 0 });
  const byService = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  const byWeekday = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, count: 0 }));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const byMaster = new Map(
    masters.map((m) => [m.id, { id: m.id, name: m.name, count: 0, revenue: 0 }]),
  );
  let revenue = 0;
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  const newClients = new Set<string>();
  const returningClients = new Set<string>();

  for (const a of rows) {
    if (a.status === 'CANCELLED') {
      cancelled += 1;
      continue;
    }
    if (a.status === 'NO_SHOW') {
      noShow += 1;
      continue;
    }
    const local = localParts(a.startAt, tz);
    byWeekday[local.isoWeekday - 1]!.count += 1;
    byHour[Math.floor(local.minutes / 60)]!.count += 1;
    const master = byMaster.get(a.masterId);
    if (master) master.count += 1;
    if (a.status === 'COMPLETED') {
      const price = Number(a.price ?? 0);
      revenue += price;
      completed += 1;
      const day = byDay.get(local.day);
      if (day) {
        day.amount += price;
        day.count += 1;
      }
      if (master) master.revenue += price;
      const first = firstVisitOf.get(a.clientId);
      if (first && first.getTime() === a.startAt.getTime()) newClients.add(a.clientId);
      else returningClients.add(a.clientId);
    }
    for (const s of a.services) {
      const stat = byService.get(s.serviceId) ?? {
        id: s.serviceId,
        name: s.name,
        count: 0,
        revenue: 0,
      };
      stat.count += 1;
      if (a.status === 'COMPLETED') stat.revenue += Number(s.price ?? 0);
      byService.set(s.serviceId, stat);
    }
  }
  const totalBooked = rows.length;
  return {
    periodDays,
    currency: scope.currency,
    timezone: tz,
    totals: {
      revenue: round2(revenue),
      completed,
      cancelled,
      noShow,
      avgCheck: completed ? round2(revenue / completed) : 0,
      newClients: newClients.size,
      returningClients: returningClients.size,
      cancellationRatePct: totalBooked ? Math.round((cancelled / totalBooked) * 100) : 0,
    },
    revenueByDay: [...byDay.entries()].map(([date, v]) => ({
      date,
      amount: round2(v.amount),
      count: v.count,
    })),
    byService: [...byService.values()]
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
      .slice(0, 10),
    byWeekday,
    byHour: byHour.filter((h) => h.count > 0 || (h.hour >= 8 && h.hour <= 21)),
    byMaster: [...byMaster.values()].sort((a, b) => b.revenue - a.revenue),
    ...(await demographics(scope, now)),
  };
}
