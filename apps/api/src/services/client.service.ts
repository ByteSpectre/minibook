import type { z } from 'zod';
import {
  computeLoyaltyProgress,
  isoDateToUtc,
  normalizePhone,
  normalizeUsername,
  toIsoDate,
  type AuthResponse,
  type ClientAppointmentDto,
  type ClientProfileDto,
  type clientOnboardingSchema,
  type clientProfilePatchSchema,
  type Language,
  type MyMasterDto,
  type reviewCreateSchema,
} from '@nail-crm/shared';
import { prisma } from '../db/prisma';
import { computeMasterAccess } from '../lib/access';
import { defer } from '../lib/deferred';
import { AppError, badRequest, conflict, NotFoundError } from '../lib/errors';
import { clientAppointmentInclude, toCategoryDto, toClientAppointmentDto } from '../lib/mappers';
import { miniAppLink } from '../lib/links';
import { addMinutes, localParts } from '../lib/time';
import { issueSession } from './auth.service';
import { createClientBooking, lockMaster } from './booking.service';
import { recomputeMasterRating } from './clientStats.service';
import { trackFunnel } from './funnel.service';
import {
  notifyMasterClientCancelled,
  notifyMasterClientConfirmed,
  notifyMasterClientRescheduled,
  notifyMasterNewReview,
} from './notifications/messages';
import { triggerSlotFreed } from './notifications/slotAlerts.service';
import { findNearestSlot, isSlotBookable } from './slots.service';

type OnboardingInput = z.output<typeof clientOnboardingSchema>;
type ProfilePatch = z.output<typeof clientProfilePatchSchema>;
type ReviewInput = z.output<typeof reviewCreateSchema>;

function toProfileDto(p: {
  id: string;
  firstName: string | null;
  gender: ClientProfileDto['gender'];
  birthday: Date;
  username: string | null;
  phone: string;
  phoneCountry: string | null;
  avatarUrl: string | null;
  slotAlertsEnabled: boolean;
  broadcastEnabled: boolean;
  language: string;
  onboardingCompleted: boolean;
}): ClientProfileDto {
  return {
    id: p.id,
    firstName: p.firstName,
    gender: p.gender,
    birthday: toIsoDate(p.birthday),
    username: p.username,
    phone: p.phone,
    phoneCountry: p.phoneCountry,
    avatarUrl: p.avatarUrl,
    slotAlertsEnabled: p.slotAlertsEnabled,
    broadcastEnabled: p.broadcastEnabled,
    language: (p.language === 'en' ? 'en' : 'ru') as Language,
    onboardingCompleted: p.onboardingCompleted,
  };
}

export async function getClientProfile(userId: string): Promise<ClientProfileDto> {
  const profile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError();
  return toProfileDto(profile);
}

export async function completeClientOnboarding(
  userId: string,
  input: OnboardingInput,
): Promise<AuthResponse> {
  const phone = normalizePhone(input.phone, input.phoneCountry);
  if (!phone) throw badRequest('invalidPhone');
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const language = input.language ?? (user.language === 'en' ? 'en' : 'ru');
  const data = {
    firstName: input.firstName,
    gender: input.gender,
    birthday: isoDateToUtc(input.birthday),
    phone,
    phoneCountry: input.phoneCountry,
    username: input.username ?? user.username,
    avatarUrl: user.photoUrl,
    onboardingCompleted: true,
    language,
  };
  await prisma.$transaction([
    prisma.clientProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data }),
    prisma.userRole.upsert({
      where: { userId_role: { userId, role: 'CLIENT' } },
      create: { userId, role: 'CLIENT' },
      update: {},
    }),
    prisma.user.update({ where: { id: userId }, data: { language } }),
  ]);
  await trackFunnel(userId, 'ONBOARDING_COMPLETED', 'CLIENT');
  return issueSession(userId);
}

export async function patchClientProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<ClientProfileDto> {
  const current = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!current) throw new NotFoundError();
  let phone: string | undefined;
  if (patch.phone !== undefined) {
    const normalized = normalizePhone(patch.phone, patch.phoneCountry ?? current.phoneCountry);
    if (!normalized) throw badRequest('invalidPhone');
    phone = normalized;
  }
  const updated = await prisma.clientProfile.update({
    where: { userId },
    data: {
      firstName: patch.firstName,
      gender: patch.gender,
      birthday: patch.birthday ? isoDateToUtc(patch.birthday) : undefined,
      phone,
      phoneCountry: patch.phoneCountry,
      username: patch.username === undefined ? undefined : normalizeUsername(patch.username),
      avatarUrl: patch.avatarUrl,
      slotAlertsEnabled: patch.slotAlertsEnabled,
      broadcastEnabled: patch.broadcastEnabled,
      language: patch.language,
    },
  });
  if (patch.language)
    await prisma.user.update({ where: { id: userId }, data: { language: patch.language } });
  return toProfileDto(updated);
}

export async function getMyMasters(userId: string, now: Date = new Date()): Promise<MyMasterDto[]> {
  const clients = await prisma.client.findMany({
    where: { userId },
    include: {
      master: {
        include: {
          categories: { include: { category: true } },
          loyaltyRules: { where: { isActive: true } },
          salon: {
            select: {
              name: true,
              status: true,
              trialEndsAt: true,
              subscriptionEndsAt: true,
              autoRenewEnabled: true,
            },
          },
        },
      },
    },
    orderBy: { lastVisitAt: { sort: 'desc', nulls: 'last' } },
  });
  return clients.map((c) => ({
    clientId: c.id,
    master: {
      id: c.master.id,
      slug: c.master.slug,
      name: c.master.name,
      avatarUrl: c.master.avatarUrl,
      categories: c.master.categories.map((x) => toCategoryDto(x.category)),
      ratingAvg: c.master.ratingAvg,
      ratingCount: c.master.ratingCount,
      isOnlineNow:
        c.master.isOnlineOpen && !!c.master.onlineOpenUntil && c.master.onlineOpenUntil > now,
      isAvailable: computeMasterAccess(c.master, c.master.salon, now).isPublic,
      salonName: c.master.salon?.name ?? null,
    },
    notificationsEnabled: c.slotAlertsEnabled && c.broadcastEnabled,
    completedVisits: c.visitsCount,
    lastVisitAt: c.lastVisitAt ? c.lastVisitAt.toISOString() : null,
    loyaltyProgress: computeLoyaltyProgress(c.master.loyaltyRules, c.visitsCount),
    referralLink: miniAppLink({ kind: 'master', slug: c.master.slug, referrerClientId: c.id }),
  }));
}

export async function patchMyMaster(
  userId: string,
  masterId: string,
  notificationsEnabled: boolean,
): Promise<void> {
  const result = await prisma.client.updateMany({
    where: { userId, masterId },
    data: { slotAlertsEnabled: notificationsEnabled, broadcastEnabled: notificationsEnabled },
  });
  if (result.count === 0) throw new NotFoundError();
}

export async function getMyAppointments(
  userId: string,
  now: Date = new Date(),
): Promise<{ upcoming: ClientAppointmentDto[]; past: ClientAppointmentDto[] }> {
  const rows = await prisma.appointment.findMany({
    where: { client: { userId } },
    include: clientAppointmentInclude,
    orderBy: { startAt: 'asc' },
    take: 300,
  });
  const dtos = rows.map((r) => toClientAppointmentDto(r, now));
  const isUpcoming = (a: ClientAppointmentDto) =>
    new Date(a.endAt) > now && (a.status === 'PENDING' || a.status === 'CONFIRMED');
  return { upcoming: dtos.filter(isUpcoming), past: dtos.filter((a) => !isUpcoming(a)).reverse() };
}

export type ClientOwnership = { userId: string } | { telegramId: bigint };

async function findOwnedAppointment(appointmentId: string, owner: ClientOwnership) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      client: 'userId' in owner ? { userId: owner.userId } : { telegramId: owner.telegramId },
    },
    include: {
      services: true,
      master: { select: { id: true, slug: true, timezone: true, autoConfirm: true } },
    },
  });
  if (!appointment) throw new NotFoundError();
  return appointment;
}

export async function cancelAppointmentByClient(
  appointmentId: string,
  owner: ClientOwnership,
  reason?: string,
  now: Date = new Date(),
): Promise<void> {
  const a = await findOwnedAppointment(appointmentId, owner);
  if (!['PENDING', 'CONFIRMED'].includes(a.status) || a.startAt <= now) {
    throw new AppError(409, 'cannotCancel', 'Appointment can no longer be cancelled');
  }
  await prisma.appointment.update({
    where: { id: a.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledBy: 'client',
      cancelReason: reason ?? null,
    },
  });
  defer('notify.clientCancelled', () => notifyMasterClientCancelled(a.id));
  defer('slotAlert.cancel', () =>
    triggerSlotFreed({
      masterId: a.masterId,
      startAt: a.startAt,
      endAt: a.endAt,
      appointmentId: a.id,
      excludeClientId: a.clientId,
    }),
  );
}

export async function rescheduleAppointmentByClient(
  appointmentId: string,
  userId: string,
  startAtIso: string,
  now: Date = new Date(),
): Promise<ClientAppointmentDto> {
  const a = await findOwnedAppointment(appointmentId, { userId });
  if (!['PENDING', 'CONFIRMED'].includes(a.status) || a.startAt <= now) {
    throw new AppError(409, 'cannotCancel', 'Appointment can no longer be changed');
  }
  const startAt = new Date(startAtIso);
  const duration = Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60000);
  const serviceIds = a.services.map((s) => s.serviceId);
  const oldStart = a.startAt;
  const oldEnd = a.endAt;
  await prisma.$transaction(async (tx) => {
    await lockMaster(tx, a.masterId);
    const ok = await isSlotBookable(a.masterId, serviceIds, startAt, {
      excludeAppointmentId: a.id,
      now,
      durationMin: duration,
    });
    if (!ok) throw conflict('slotTaken');
    await tx.appointment.update({
      where: { id: a.id },
      data: {
        startAt,
        endAt: addMinutes(startAt, duration),
        status: a.master.autoConfirm ? 'CONFIRMED' : 'PENDING',
        clientConfirmedAt: null,
      },
    });
  });
  defer('notify.clientRescheduled', () => notifyMasterClientRescheduled(a.id, oldStart));
  defer('slotAlert.reschedule', () =>
    triggerSlotFreed({
      masterId: a.masterId,
      startAt: oldStart,
      endAt: oldEnd,
      appointmentId: a.id,
      excludeClientId: a.clientId,
    }),
  );
  const row = await prisma.appointment.findUniqueOrThrow({
    where: { id: a.id },
    include: clientAppointmentInclude,
  });
  return toClientAppointmentDto(row, now);
}

export async function confirmVisit(
  appointmentId: string,
  owner: ClientOwnership,
  now: Date = new Date(),
): Promise<boolean> {
  const a = await findOwnedAppointment(appointmentId, owner);
  if (!['PENDING', 'CONFIRMED'].includes(a.status) || a.startAt <= now) return false;
  if (!a.clientConfirmedAt) {
    await prisma.appointment.update({ where: { id: a.id }, data: { clientConfirmedAt: now } });
    defer('notify.clientConfirmed', () => notifyMasterClientConfirmed(a.id));
  }
  return true;
}

/** Same services with the same master, nearest free slot. */
export async function repeatPreview(userId: string, appointmentId: string, now: Date = new Date()) {
  const a = await findOwnedAppointment(appointmentId, { userId });
  const activeServices = await prisma.service.findMany({
    where: {
      id: { in: a.services.map((s) => s.serviceId) },
      masterId: a.masterId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, name: true, price: true, duration: true },
  });
  if (activeServices.length === 0)
    throw new AppError(409, 'serviceUnavailable', 'Services are no longer offered');
  const serviceIds = activeServices.map((s) => s.id);
  const slot = await findNearestSlot(a.masterId, serviceIds, { now });
  return {
    masterSlug: a.master.slug,
    serviceIds,
    services: activeServices.map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
      duration: s.duration,
    })),
    slot: slot
      ? {
          startAt: slot.startAt.toISOString(),
          date: localParts(slot.startAt, a.master.timezone).day,
          time: localParts(slot.startAt, a.master.timezone).hhmm,
          discountPct: slot.discountPct,
        }
      : null,
    timezone: a.master.timezone,
  };
}

export async function repeatBooking(
  userId: string,
  appointmentId: string,
  startAt: string | undefined,
  now: Date = new Date(),
) {
  const preview = await repeatPreview(userId, appointmentId, now);
  const target = startAt ?? preview.slot?.startAt;
  if (!target) throw conflict('slotTaken', 'No free slots');
  const original = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { client: { select: { firstName: true, phone: true, username: true } } },
  });
  if (!original.client.phone) throw badRequest('invalidPhone');
  return createClientBooking(
    userId,
    preview.masterSlug,
    {
      serviceIds: preview.serviceIds,
      startAt: target,
      photos: [],
      contact: {
        firstName: original.client.firstName ?? '—',
        phone: original.client.phone,
        username: original.client.username,
      },
    },
    now,
  );
}

export async function reviewAppointment(userId: string, appointmentId: string, input: ReviewInput) {
  const a = await prisma.appointment.findFirst({
    where: { id: appointmentId, client: { userId } },
    include: { review: true, client: { select: { id: true, firstName: true } } },
  });
  if (!a) throw new NotFoundError();
  if (a.status !== 'COMPLETED')
    throw new AppError(409, 'cannotReview', 'Only completed visits can be reviewed');
  if (a.review) throw conflict('alreadyReviewed');
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { firstName: true },
  });
  const review = await prisma.review.create({
    data: {
      masterId: a.masterId,
      appointmentId: a.id,
      clientId: a.client.id,
      clientName: a.client.firstName ?? user.firstName ?? '—',
      rating: input.rating,
      comment: input.comment ?? null,
      photos: input.photos,
    },
  });
  await recomputeMasterRating(a.masterId);
  defer('notify.review', () => notifyMasterNewReview(review.id));
  return review;
}
