import type { z } from 'zod';
import {
  computeLoyaltyProgress,
  daysFromBirthday,
  isoDateToUtc,
  LIMITS,
  normalizePhone,
  normalizeUsername,
  toIsoDate,
  type clientCreateSchema,
  type ClientPatchInput,
  type MasterClientDetailDto,
  type MasterClientDto,
  type Paginated,
} from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import { AppError, badRequest, NotFoundError, tooMany } from '../../lib/errors';
import { langOf, tr } from '../../lib/i18n';
import { appointmentInclude, toMasterAppointmentDto } from '../../lib/mappers';
import { localDay } from '../../lib/time';
import { canSendBroadcastTo } from '../notifications/antispam';
import { sendMessage } from '../notifications/notifier';
import type { TenantScope } from '../scope';

type ClientCreateInput = z.output<typeof clientCreateSchema>;

export type ClientFilter = 'all' | 'sleeping' | 'birthday' | 'new' | 'blacklisted';

export const PERSONAL_SEGMENT = 'personal';

const clientSelect = (now: Date) => ({
  id: true,
  masterId: true,
  firstName: true,
  phone: true,
  username: true,
  gender: true,
  birthday: true,
  notes: true,
  visitsCount: true,
  totalSpent: true,
  lastVisitAt: true,
  telegramId: true,
  createdAt: true,
  master: { select: { name: true } },
  appointments: {
    where: { status: { in: ['PENDING' as const, 'CONFIRMED' as const] }, startAt: { gt: now } },
    select: { startAt: true },
    orderBy: { startAt: 'asc' as const },
    take: 1,
  },
});

async function blacklistSets(scope: TenantScope) {
  const entries = await scope.db.blacklistEntry.findMany({
    select: { masterId: true, username: true, phone: true },
  });
  return {
    has: (c: { masterId: string; username: string | null; phone: string | null }) =>
      entries.some(
        (e) =>
          e.masterId === c.masterId &&
          ((!!e.username && e.username === c.username) || (!!e.phone && e.phone === c.phone)),
      ),
  };
}

function toClientDto(
  c: {
    id: string;
    masterId: string;
    firstName: string | null;
    phone: string | null;
    username: string | null;
    gender: MasterClientDto['gender'];
    birthday: Date | null;
    notes: string | null;
    visitsCount: number;
    totalSpent: unknown;
    lastVisitAt: Date | null;
    telegramId: bigint | null;
    createdAt: Date;
    master: { name: string };
    appointments: { startAt: Date }[];
  },
  blacklisted: boolean,
  now: Date,
): MasterClientDto {
  const next = c.appointments.find((a) => a.startAt > now);
  return {
    id: c.id,
    firstName: c.firstName,
    phone: c.phone,
    username: c.username,
    gender: c.gender,
    birthday: c.birthday ? toIsoDate(c.birthday) : null,
    notes: c.notes,
    visitsCount: c.visitsCount,
    totalSpent: Number(c.totalSpent),
    lastVisitAt: c.lastVisitAt ? c.lastVisitAt.toISOString() : null,
    nextAppointmentAt: next ? next.startAt.toISOString() : null,
    isBlacklisted: blacklisted,
    hasTelegram: c.telegramId !== null,
    createdAt: c.createdAt.toISOString(),
    masterId: c.masterId,
    masterName: c.master.name,
  };
}

export async function listClients(
  scope: TenantScope,
  q: { q?: string; filter?: ClientFilter; page: number; pageSize: number; masterId?: string },
  now: Date = new Date(),
): Promise<Paginated<MasterClientDto>> {
  const sleepingBefore = new Date(now.getTime() - LIMITS.sleepingClientDays * 86_400_000);
  const search = q.q?.trim();
  const phoneSearch = search?.replace(/[^\d+]/g, '');
  const where = {
    ...(q.masterId ? { masterId: q.masterId } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            {
              username: {
                contains: normalizeUsername(search) ?? search,
                mode: 'insensitive' as const,
              },
            },
            ...(phoneSearch && phoneSearch.length >= 3
              ? [{ phone: { contains: phoneSearch } }]
              : []),
          ],
        }
      : {}),
    ...(q.filter === 'sleeping' ? { lastVisitAt: { lt: sleepingBefore } } : {}),
    ...(q.filter === 'new' ? { visitsCount: 0 } : {}),
    ...(q.filter === 'birthday' ? { birthday: { not: null } } : {}),
  };
  const bl = await blacklistSets(scope);
  let rows = await scope.db.client.findMany({
    where,
    select: clientSelect(now),
    orderBy: [{ lastVisitAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 2000,
  });
  if (q.filter === 'birthday') {
    const today = localDay(now, scope.timezone);
    rows = rows.filter((c) => c.birthday && daysFromBirthday(c.birthday, today) <= 14);
  }
  if (q.filter === 'blacklisted') rows = rows.filter((c) => bl.has(c));
  const total = rows.length;
  const pageRows = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
  return {
    items: pageRows.map((c) => toClientDto(c, bl.has(c), now)),
    page: q.page,
    pageSize: q.pageSize,
    total,
    hasMore: q.page * q.pageSize < total,
  };
}

export async function getClientDetail(
  scope: TenantScope,
  id: string,
  now: Date = new Date(),
): Promise<MasterClientDetailDto> {
  const c = await scope.db.client.findUnique({ where: { id }, select: clientSelect(now) });
  if (!c) throw new NotFoundError();
  const [appointments, rules, bl] = await Promise.all([
    scope.db.appointment.findMany({
      where: { clientId: c.id },
      include: appointmentInclude,
      orderBy: { startAt: 'desc' },
      take: 100,
    }),
    scope.db.loyaltyRule.findMany({ where: { masterId: c.masterId, isActive: true } }),
    blacklistSets(scope),
  ]);
  return {
    ...toClientDto(c, bl.has(c), now),
    appointments: appointments.map(toMasterAppointmentDto),
    loyaltyProgress: computeLoyaltyProgress(rules, c.visitsCount),
    noShowCount: appointments.filter((a) => a.status === 'NO_SHOW').length,
    lateCount: appointments.filter((a) => a.clientLate).length,
  };
}

export async function createClient(
  scope: TenantScope,
  masterId: string,
  input: ClientCreateInput,
  now: Date = new Date(),
) {
  if (!scope.masterIds.includes(masterId)) throw new NotFoundError();
  const phone = input.phone ? normalizePhone(input.phone, input.phoneCountry ?? 'RU') : null;
  if (input.phone && !phone) throw badRequest('invalidPhone');
  const created = await scope.db.client.create({
    data: {
      masterId,
      firstName: input.firstName,
      phone,
      username: normalizeUsername(input.username ?? null),
      gender: input.gender ?? null,
      birthday: input.birthday ? isoDateToUtc(input.birthday) : null,
      notes: input.notes ?? null,
    },
  });
  return getClientDetail(scope, created.id, now);
}

export async function patchClient(scope: TenantScope, id: string, patch: ClientPatchInput) {
  const existing = await scope.db.client.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError();
  let phone: string | null | undefined;
  if (patch.phone !== undefined) {
    phone = patch.phone ? normalizePhone(patch.phone, patch.phoneCountry ?? 'RU') : null;
    if (patch.phone && !phone) throw badRequest('invalidPhone');
  }
  await scope.db.client.update({
    where: { id },
    data: {
      firstName: patch.firstName,
      phone,
      username: patch.username === undefined ? undefined : normalizeUsername(patch.username),
      gender: patch.gender,
      birthday:
        patch.birthday === undefined
          ? undefined
          : patch.birthday
            ? isoDateToUtc(patch.birthday)
            : null,
      notes: patch.notes,
    },
  });
  return getClientDetail(scope, id);
}

/** Personal "we miss you" message to a sleeping client (marketing anti-spam applies). */
export async function remindClient(
  scope: TenantScope,
  id: string,
  text: string | undefined,
  now: Date = new Date(),
) {
  const c = await scope.db.client.findUnique({
    where: { id },
    select: {
      id: true,
      masterId: true,
      firstName: true,
      telegramId: true,
      broadcastEnabled: true,
      master: { select: { name: true, slug: true } },
      user: { select: { language: true, clientProfile: { select: { broadcastEnabled: true } } } },
    },
  });
  if (!c) throw new NotFoundError();
  if (!c.telegramId) throw new AppError(409, 'noTelegram', 'Client has no Telegram');
  if (!c.broadcastEnabled || c.user?.clientProfile?.broadcastEnabled === false) {
    throw new AppError(409, 'unsubscribed', 'Client unsubscribed from messages');
  }
  if (!(await canSendBroadcastTo(c.telegramId, now)))
    throw tooMany('rateLimited', 'Client was messaged recently');
  const lang = langOf(c.user?.language);
  const t = tr(lang);
  const body = text?.trim()
    ? text.trim().replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[ch] ?? ch)
    : t('bot.client_notify.sleepingDefault', { name: c.firstName ?? '', master: c.master.name });
  const sent = await sendMessage({
    chatId: c.telegramId,
    text: body + t('bot.client_notify.unsubscribeHint'),
    buttons: [
      [
        {
          text: t('bot.buttons.book'),
          app: { path: `/m/${c.master.slug}`, startParam: `m_${c.master.slug}` },
        },
      ],
    ],
    kind: 'client.remind',
  });
  if (sent) {
    // Personal reminders are logged for anti-spam but don't count as a mass broadcast.
    const broadcast = await scope.db.broadcast.create({
      data: {
        masterId: c.masterId,
        segment: PERSONAL_SEGMENT,
        segmentParams: { clientIds: [c.id] },
        text: body,
        recipients: 1,
        sentAt: now,
      },
    });
    await prisma.broadcastRecipient.create({
      data: { broadcastId: broadcast.id, clientId: c.id, telegramId: c.telegramId, sentAt: now },
    });
  }
  return { ok: sent };
}
