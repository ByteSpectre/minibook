import type { z } from 'zod';
import {
  COUNTRY_CURRENCY,
  DEFAULT_THEME_PRESET,
  isValidSlug,
  type AuthResponse,
  type masterOnboardingCompleteSchema,
  type OnboardingDraftDto,
  type Role,
  type WeeklyScheduleInput,
} from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import { defer } from '../../lib/deferred';
import { AppError, badRequest, conflict } from '../../lib/errors';
import { langOf, tr } from '../../lib/i18n';
import { themeDataForPreset } from '../../lib/mappers';
import { addDays } from '../../lib/time';
import { issueSession } from '../auth.service';
import { assignExperiment } from '../billing/experiments.service';
import { trackFunnel } from '../funnel.service';
import { sendMessage } from '../notifications/notifier';
import { getPlatformSettings } from '../settings.service';

type MasterOnboarding = z.output<typeof masterOnboardingCompleteSchema>;
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function saveOnboardingDraft(
  userId: string,
  role: Extract<Role, 'MASTER' | 'SALON'>,
  step: number,
  data: Record<string, unknown>,
): Promise<OnboardingDraftDto> {
  const existing = await prisma.onboardingDraft.findUnique({
    where: { userId_role: { userId, role } },
  });
  const merged = { ...((existing?.data as Record<string, unknown> | null) ?? {}), ...data };
  const draft = await prisma.onboardingDraft.upsert({
    where: { userId_role: { userId, role } },
    create: { userId, role, step, data: merged as object },
    update: { step: Math.max(step, existing?.step ?? 1), data: merged as object },
  });
  if (!existing) await trackFunnel(userId, 'ONBOARDING_STARTED', role);
  return { step: draft.step, data: draft.data as Record<string, unknown> };
}

export async function getOnboardingDraft(
  userId: string,
  role: Extract<Role, 'MASTER' | 'SALON'>,
): Promise<OnboardingDraftDto | null> {
  const draft = await prisma.onboardingDraft.findUnique({
    where: { userId_role: { userId, role } },
  });
  return draft ? { step: draft.step, data: draft.data as Record<string, unknown> } : null;
}

/** Slugs are unique across masters and salons because both live under one link space. */
export async function isSlugAvailable(
  slug: string,
  except?: { masterId?: string; salonId?: string },
): Promise<boolean> {
  if (!isValidSlug(slug)) return false;
  const [master, salon] = await Promise.all([
    prisma.master.findUnique({ where: { slug }, select: { id: true } }),
    prisma.salon.findUnique({ where: { slug }, select: { id: true } }),
  ]);
  if (master && master.id !== except?.masterId) return false;
  if (salon && salon.id !== except?.salonId) return false;
  return true;
}

export async function resolveLocation(countryId: string, cityId: string) {
  const city = await prisma.city.findFirst({
    where: { id: cityId, countryId },
    include: { country: { select: { code: true } } },
  });
  if (!city) throw badRequest('validation', 'City does not belong to the country');
  return { city, timezone: city.timezone, currency: COUNTRY_CURRENCY[city.country.code] ?? 'RUB' };
}

export async function assertCategories(categoryIds: string[]): Promise<string[]> {
  const unique = [...new Set(categoryIds)];
  const count = await prisma.category.count({ where: { id: { in: unique }, isActive: true } });
  if (count !== unique.length) throw badRequest('validation', 'Unknown category');
  return unique;
}

export const DEFAULT_SCHEDULE: WeeklyScheduleInput = {
  days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    dayOfWeek: d,
    isWorking: d <= 6,
    intervals: d <= 6 ? [{ start: '10:00', end: '20:00' }] : [],
  })),
};

export function scheduleRows(schedule: WeeklyScheduleInput) {
  return schedule.days.flatMap((d) =>
    d.isWorking
      ? d.intervals.map((i) => ({
          dayOfWeek: d.dayOfWeek,
          startTime: i.start,
          endTime: i.end,
          isWorking: true,
        }))
      : [],
  );
}

/** Accepts a salon invite for a master (shared by onboarding, Mini App and bot). */
export async function attachMasterToSalon(
  tx: Tx,
  masterId: string,
  salonId: string,
  code: string,
  now: Date,
): Promise<{
  salonName: string;
  ownerTelegramId: bigint;
  ownerLanguage: string;
  masterName: string;
}> {
  const invite = await tx.salonInvite.findFirst({
    where: { salonId, inviteCode: code, status: 'pending', expiresAt: { gt: now } },
    include: { salon: { include: { owner: { select: { telegramId: true, language: true } } } } },
  });
  if (!invite) throw new AppError(404, 'inviteInvalid', 'Invite is invalid or expired');
  const master = await tx.master.findUniqueOrThrow({
    where: { id: masterId },
    select: { salonId: true, name: true },
  });
  if (master.salonId && master.salonId !== salonId) throw conflict('alreadyInSalon');
  await tx.master.update({ where: { id: masterId }, data: { salonId, salonJoinedAt: now } });
  // Link invites stay reusable until they expire; username invites are single-use.
  if (invite.invitedUsername) {
    await tx.salonInvite.update({
      where: { id: invite.id },
      data: { status: 'accepted', masterId, respondedAt: now },
    });
  }
  return {
    salonName: invite.salon.name,
    ownerTelegramId: invite.salon.owner.telegramId,
    ownerLanguage: invite.salon.owner.language,
    masterName: master.name,
  };
}

export function notifySalonJoined(info: {
  ownerTelegramId: bigint;
  ownerLanguage: string;
  masterName: string;
}) {
  defer('salon.inviteAccepted', () =>
    sendMessage({
      chatId: info.ownerTelegramId,
      text: tr(langOf(info.ownerLanguage))('bot.salon_notify.inviteAccepted', {
        master: info.masterName,
      }),
      buttons: [
        [
          {
            text: tr(langOf(info.ownerLanguage))('bot.buttons.openSalon'),
            app: { path: '/salon/masters', startParam: 'go_salon_masters' },
          },
        ],
      ],
      kind: 'salon.inviteAccepted',
    }),
  );
}

export async function completeMasterOnboarding(
  userId: string,
  input: MasterOnboarding,
  now: Date = new Date(),
): Promise<AuthResponse> {
  const existing = await prisma.master.findUnique({ where: { userId }, select: { id: true } });
  if (existing) throw conflict('alreadyRegistered', 'Master profile already exists');
  if (!(await isSlugAvailable(input.slug))) throw conflict('slugTaken', 'Slug is taken');
  const categoryIds = await assertCategories(input.categoryIds);
  const { timezone, currency } = await resolveLocation(input.countryId, input.cityId);
  if (input.firstService.categoryId) await assertCategories([input.firstService.categoryId]);
  const settings = await getPlatformSettings();
  const preset = input.themePreset ?? DEFAULT_THEME_PRESET;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { username: true, language: true },
  });

  let salonInfo: Awaited<ReturnType<typeof attachMasterToSalon>> | null = null;
  const master = await prisma.$transaction(async (tx) => {
    const created = await tx.master.create({
      data: {
        userId,
        slug: input.slug,
        name: input.name,
        username: input.username ?? user.username,
        channelUsername: input.channelUsername,
        avatarUrl: input.avatarUrl ?? null,
        countryId: input.countryId,
        cityId: input.cityId,
        address: input.address ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        timezone,
        currency,
        status: 'TRIAL',
        trialEndsAt: addDays(now, settings.trialDays),
        postVisitMessage: null,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        settings: { create: {} },
        theme: { create: themeDataForPreset(preset) },
        blockedScreen: { create: {} },
        schedule: { create: scheduleRows(input.schedule ?? DEFAULT_SCHEDULE) },
        services: {
          create: {
            name: input.firstService.name,
            description: input.firstService.description ?? null,
            imageUrl: input.firstService.imageUrl ?? null,
            price: input.firstService.price,
            duration: input.firstService.duration,
            categoryId: input.firstService.categoryId ?? categoryIds[0] ?? null,
            sortOrder: 0,
          },
        },
      },
    });
    await tx.userRole.upsert({
      where: { userId_role: { userId, role: 'MASTER' } },
      create: { userId, role: 'MASTER', masterId: created.id },
      update: { masterId: created.id },
    });
    if (input.referrerMasterId && input.referrerMasterId !== created.id) {
      const referrer = await tx.master.findUnique({
        where: { id: input.referrerMasterId },
        select: { id: true },
      });
      if (referrer) {
        await tx.masterReferral.create({
          data: {
            referrerId: referrer.id,
            referredId: created.id,
            bonusDays: settings.referralBonusDays,
          },
        });
      }
    }
    if (input.joinSalon) {
      salonInfo = await attachMasterToSalon(
        tx,
        created.id,
        input.joinSalon.salonId,
        input.joinSalon.code,
        now,
      );
    }
    await tx.onboardingDraft.deleteMany({ where: { userId, role: 'MASTER' } });
    return created;
  });

  await assignExperiment(master.id);
  await trackFunnel(userId, 'ONBOARDING_COMPLETED', 'MASTER');
  if (salonInfo) notifySalonJoined(salonInfo);
  return issueSession(userId);
}
