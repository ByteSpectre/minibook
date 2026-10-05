import type { z } from 'zod';
import {
  ageFromBirthday,
  daysFromBirthday,
  escapeHtml,
  LIMITS,
  type broadcastCreateSchema,
  type BroadcastDto,
  type BroadcastPreviewResponse,
  type broadcastPreviewSchema,
  type BroadcastSegment,
  type loyaltyRuleCreateSchema,
  type loyaltyRulePatchSchema,
  type LoyaltyRuleDto,
  type promotionCreateSchema,
  type PromotionDto,
  type promotionPatchSchema,
} from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import type { TenantDb } from '../../db/tenant';
import { defer } from '../../lib/deferred';
import { AppError, NotFoundError } from '../../lib/errors';
import { langOf, tr } from '../../lib/i18n';
import { toLoyaltyRuleDto, toPromotionDto } from '../../lib/mappers';
import { endOfLocalDay, localDay, startOfLocalDay } from '../../lib/time';
import { logger } from '../../logger';
import { canSendBroadcastTo } from '../notifications/antispam';
import { sendMessage } from '../notifications/notifier';
import { PERSONAL_SEGMENT } from './clients.service';

type RuleInput = z.output<typeof loyaltyRuleCreateSchema>;
type RulePatch = z.output<typeof loyaltyRulePatchSchema>;
type PromotionInput = z.output<typeof promotionCreateSchema>;
type PromotionPatch = z.output<typeof promotionPatchSchema>;
type PreviewInput = z.output<typeof broadcastPreviewSchema>;
type BroadcastInput = z.output<typeof broadcastCreateSchema>;

/* ───────────── Loyalty ───────────── */

export async function listLoyaltyRules(db: TenantDb): Promise<LoyaltyRuleDto[]> {
  const rows = await db.loyaltyRule.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map(toLoyaltyRuleDto);
}

export async function createLoyaltyRule(
  db: TenantDb,
  masterId: string,
  input: RuleInput,
): Promise<LoyaltyRuleDto> {
  const row = await db.loyaltyRule.create({
    data: {
      masterId,
      type: input.type,
      threshold:
        input.type === 'FIRST_VISIT' || input.type === 'REFERRAL'
          ? null
          : (input.threshold ?? (input.type === 'BIRTHDAY' ? 7 : null)),
      discountPct: input.discountPct,
      isActive: input.isActive ?? true,
    },
  });
  return toLoyaltyRuleDto(row);
}

export async function patchLoyaltyRule(
  db: TenantDb,
  id: string,
  patch: RulePatch,
): Promise<LoyaltyRuleDto> {
  const row = await db.loyaltyRule.update({ where: { id }, data: patch });
  return toLoyaltyRuleDto(row);
}

export async function deleteLoyaltyRule(db: TenantDb, id: string): Promise<void> {
  await db.loyaltyRule.delete({ where: { id } });
}

/* ───────────── Promotions ───────────── */

async function assertService(db: TenantDb, serviceId: string | null | undefined) {
  if (!serviceId) return;
  const s = await db.service.findFirst({
    where: { id: serviceId, deletedAt: null },
    select: { id: true },
  });
  if (!s) throw new NotFoundError();
}

export async function listPromotions(db: TenantDb): Promise<PromotionDto[]> {
  const rows = await db.promotion.findMany({
    include: { service: { select: { name: true } } },
    orderBy: { validFrom: 'desc' },
  });
  return rows.map(toPromotionDto);
}

export async function createPromotion(
  db: TenantDb,
  masterId: string,
  timezone: string,
  input: PromotionInput,
): Promise<PromotionDto> {
  await assertService(db, input.serviceId);
  const row = await db.promotion.create({
    data: {
      masterId,
      title: input.title,
      description: input.description ?? null,
      serviceId: input.serviceId ?? null,
      discountPct: input.discountPct,
      validFrom: startOfLocalDay(input.validFrom, timezone),
      validTo: new Date(endOfLocalDay(input.validTo, timezone).getTime() - 1),
      daysOfWeek: [...new Set(input.daysOfWeek)].sort(),
      timeFrom: input.timeFrom ?? null,
      timeTo: input.timeTo ?? null,
      isActive: input.isActive ?? true,
    },
    include: { service: { select: { name: true } } },
  });
  return toPromotionDto(row);
}

export async function patchPromotion(
  db: TenantDb,
  timezone: string,
  id: string,
  patch: PromotionPatch,
): Promise<PromotionDto> {
  await assertService(db, patch.serviceId);
  const row = await db.promotion.update({
    where: { id },
    data: {
      title: patch.title,
      description: patch.description,
      serviceId: patch.serviceId,
      discountPct: patch.discountPct,
      validFrom: patch.validFrom ? startOfLocalDay(patch.validFrom, timezone) : undefined,
      validTo: patch.validTo
        ? new Date(endOfLocalDay(patch.validTo, timezone).getTime() - 1)
        : undefined,
      daysOfWeek: patch.daysOfWeek ? [...new Set(patch.daysOfWeek)].sort() : undefined,
      timeFrom: patch.timeFrom,
      timeTo: patch.timeTo,
      isActive: patch.isActive,
    },
    include: { service: { select: { name: true } } },
  });
  return toPromotionDto(row);
}

export async function deletePromotion(db: TenantDb, id: string): Promise<void> {
  await db.promotion.delete({ where: { id } });
}

/* ───────────── Broadcasts ───────────── */

interface Candidate {
  id: string;
  masterId: string;
  firstName: string | null;
  telegramId: bigint | null;
  language: string | null;
  reachable: boolean;
}

async function resolveSegment(
  db: TenantDb,
  timezone: string,
  input: PreviewInput,
  now: Date,
): Promise<Candidate[]> {
  const params = input.params ?? {};
  const sleepingBefore = new Date(now.getTime() - LIMITS.sleepingClientDays * 86_400_000);
  const where: Record<string, unknown> = {};
  switch (input.segment as BroadcastSegment) {
    case 'sleeping':
      where.lastVisitAt = { lt: sleepingBefore };
      break;
    case 'birthday':
      where.birthday = { not: null };
      break;
    case 'service':
      if (!params.serviceId) return [];
      where.appointments = { some: { services: { some: { serviceId: params.serviceId } } } };
      break;
    case 'demographic':
      if (params.gender) where.gender = params.gender;
      if (params.ageFrom !== undefined || params.ageTo !== undefined)
        where.birthday = { not: null };
      break;
    case 'manual':
      where.id = { in: params.clientIds ?? [] };
      break;
    case 'all':
      break;
  }
  const [clients, blacklist] = await Promise.all([
    db.client.findMany({
      where,
      select: {
        id: true,
        masterId: true,
        firstName: true,
        telegramId: true,
        username: true,
        phone: true,
        birthday: true,
        broadcastEnabled: true,
        user: { select: { language: true, clientProfile: { select: { broadcastEnabled: true } } } },
      },
      take: 5000,
    }),
    db.blacklistEntry.findMany({ select: { masterId: true, username: true, phone: true } }),
  ]);
  const today = localDay(now, timezone);
  return clients
    .filter((c) => {
      if (input.segment === 'birthday')
        return !!c.birthday && daysFromBirthday(c.birthday, today) <= 7;
      if (
        input.segment === 'demographic' &&
        (params.ageFrom !== undefined || params.ageTo !== undefined)
      ) {
        if (!c.birthday) return false;
        const age = ageFromBirthday(c.birthday, now);
        return age >= (params.ageFrom ?? 0) && age <= (params.ageTo ?? 200);
      }
      return true;
    })
    .filter(
      (c) =>
        !blacklist.some(
          (b) =>
            b.masterId === c.masterId &&
            ((!!b.username && b.username === c.username) || (!!b.phone && b.phone === c.phone)),
        ),
    )
    .map((c) => ({
      id: c.id,
      masterId: c.masterId,
      firstName: c.firstName,
      telegramId: c.telegramId,
      language: c.user?.language ?? null,
      reachable:
        c.telegramId !== null &&
        c.broadcastEnabled &&
        c.user?.clientProfile?.broadcastEnabled !== false,
    }));
}

async function lastBroadcastAt(db: TenantDb, now: Date): Promise<Date | null> {
  const last = await db.broadcast.findFirst({
    where: {
      segment: { not: PERSONAL_SEGMENT },
      sentAt: { gt: new Date(now.getTime() - 86_400_000) },
    },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  });
  return last?.sentAt ?? null;
}

export async function previewBroadcast(
  db: TenantDb,
  timezone: string,
  input: PreviewInput,
  now: Date = new Date(),
): Promise<BroadcastPreviewResponse> {
  const candidates = await resolveSegment(db, timezone, input, now);
  const last = await lastBroadcastAt(db, now);
  return {
    total: candidates.length,
    reachable: candidates.filter((c) => c.reachable).length,
    sample: candidates.slice(0, 8).map((c) => ({ id: c.id, name: c.firstName ?? '—' })),
    canSendToday: !last,
    nextAvailableAt: last ? new Date(last.getTime() + 86_400_000).toISOString() : null,
  };
}

/** Mass broadcast: 1 per day per master, 1 marketing message per hour per client. */
export async function sendBroadcast(
  db: TenantDb,
  masterId: string,
  timezone: string,
  input: BroadcastInput,
  now: Date = new Date(),
): Promise<BroadcastDto> {
  if (await lastBroadcastAt(db, now))
    throw new AppError(429, 'broadcastLimit', 'One broadcast per day');
  const master = await prisma.master.findUniqueOrThrow({
    where: { id: masterId },
    select: { name: true, slug: true },
  });
  let promotion: { title: string; discountPct: number; description: string | null } | null = null;
  if (input.promotionId) {
    promotion = await db.promotion.findFirst({
      where: { id: input.promotionId },
      select: { title: true, discountPct: true, description: true },
    });
    if (!promotion) throw new NotFoundError();
  }
  const candidates = (await resolveSegment(db, timezone, input, now)).filter(
    (c) => c.reachable && c.masterId === masterId,
  );
  const broadcast = await db.broadcast.create({
    data: {
      masterId,
      segment: input.segment,
      segmentParams: input.params as object,
      text: input.text,
      imageUrl: input.imageUrl ?? null,
      sentAt: now,
      recipients: 0,
    },
  });

  defer('broadcast.send', async () => {
    let sent = 0;
    for (const c of candidates) {
      const telegramId = c.telegramId!;
      if (!(await canSendBroadcastTo(telegramId, now))) continue;
      const lang = langOf(c.language);
      const t = tr(lang);
      let text = escapeHtml(input.text);
      if (promotion) {
        text = `${t('bot.client_notify.promotion', { title: promotion.title, pct: promotion.discountPct, description: promotion.description ?? '' })}\n\n${text}`;
      }
      const ok = await sendMessage({
        chatId: telegramId,
        text: text + t('bot.client_notify.unsubscribeHint'),
        photo: input.imageUrl ?? null,
        buttons: [
          [
            {
              text: t('bot.buttons.book'),
              app: { path: `/m/${master.slug}`, startParam: `m_${master.slug}` },
            },
          ],
        ],
        kind: 'client.broadcast',
      });
      if (!ok) continue;
      await prisma.broadcastRecipient.create({
        data: { broadcastId: broadcast.id, clientId: c.id, telegramId, sentAt: new Date() },
      });
      sent += 1;
      // Telegram allows ~30 messages/second per bot.
      await new Promise((r) => setTimeout(r, 40));
    }
    await prisma.broadcast.update({ where: { id: broadcast.id }, data: { recipients: sent } });
    logger.info({ broadcastId: broadcast.id, sent }, 'Broadcast delivered');
  });

  return {
    id: broadcast.id,
    segment: input.segment,
    text: broadcast.text,
    imageUrl: broadcast.imageUrl,
    sentAt: broadcast.sentAt.toISOString(),
    recipients: candidates.length,
    masterId,
  };
}

export async function listBroadcasts(db: TenantDb): Promise<BroadcastDto[]> {
  const rows = await db.broadcast.findMany({
    where: { segment: { not: PERSONAL_SEGMENT } },
    orderBy: { sentAt: 'desc' },
    take: 50,
  });
  return rows.map((b) => ({
    id: b.id,
    segment: b.segment as BroadcastSegment,
    text: b.text,
    imageUrl: b.imageUrl,
    sentAt: b.sentAt.toISOString(),
    recipients: b.recipients,
    masterId: b.masterId,
  }));
}
