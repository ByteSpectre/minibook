import type { z } from 'zod';
import {
  normalizePhone,
  normalizeUsername,
  type AppointmentPatchInput,
  type AppointmentStatus,
  type masterAppointmentCreateSchema,
  type MasterAppointmentDto,
} from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import { defer } from '../../lib/deferred';
import { AppError, badRequest, conflict, NotFoundError } from '../../lib/errors';
import { appointmentInclude, toMasterAppointmentDto } from '../../lib/mappers';
import { addMinutes } from '../../lib/time';
import { lockMaster } from '../booking.service';
import { applyReferralOnCompletion, recomputeClientStats } from '../clientStats.service';
import { notifyClientBookingCreated, notifyClientStatusChange } from '../notifications/messages';
import { triggerSlotFreed } from '../notifications/slotAlerts.service';
import { computeQuote } from '../pricing.service';
import type { TenantScope } from '../scope';
import { hasOverlap } from '../slots.service';

type CreateInput = z.output<typeof masterAppointmentCreateSchema>;

export interface AppointmentListQuery {
  from?: Date;
  to?: Date;
  status?: AppointmentStatus;
  clientId?: string;
  masterId?: string;
}

export async function listAppointments(
  scope: TenantScope,
  q: AppointmentListQuery,
): Promise<MasterAppointmentDto[]> {
  const rows = await scope.db.appointment.findMany({
    where: {
      ...(q.masterId ? { masterId: q.masterId } : {}),
      ...(q.clientId ? { clientId: q.clientId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to
        ? { startAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } }
        : {}),
    },
    include: appointmentInclude,
    orderBy: { startAt: 'asc' },
    take: 500,
  });
  return rows.map(toMasterAppointmentDto);
}

export async function getAppointment(
  scope: TenantScope,
  id: string,
): Promise<MasterAppointmentDto> {
  const row = await scope.db.appointment.findUnique({ where: { id }, include: appointmentInclude });
  if (!row) throw new NotFoundError();
  return toMasterAppointmentDto(row);
}

/** Manual booking by the master/salon. The client and services must belong to the tenant. */
export async function createAppointmentByStaff(
  scope: TenantScope,
  masterId: string,
  input: CreateInput,
  createdBy: 'master' | 'salon',
): Promise<MasterAppointmentDto> {
  if (!scope.masterIds.includes(masterId)) throw new NotFoundError();
  const startAt = new Date(input.startAt);
  let clientId: string;
  if (input.clientId) {
    const client = await scope.db.client.findFirst({
      where: { id: input.clientId, masterId },
      select: { id: true },
    });
    if (!client) throw new NotFoundError();
    clientId = client.id;
  } else if (input.newClient) {
    const phone = input.newClient.phone
      ? normalizePhone(input.newClient.phone, input.newClient.phoneCountry ?? 'RU')
      : null;
    if (input.newClient.phone && !phone) throw badRequest('invalidPhone');
    const created = await scope.db.client.create({
      data: {
        masterId,
        firstName: input.newClient.firstName,
        phone,
        username: normalizeUsername(input.newClient.username ?? null),
      },
      select: { id: true },
    });
    clientId = created.id;
  } else {
    throw badRequest('validation');
  }

  const services = await scope.db.service.findMany({
    where: { id: { in: [...new Set(input.serviceIds)] }, masterId, deletedAt: null },
  });
  if (services.length !== new Set(input.serviceIds).size) throw new NotFoundError();
  const client = await scope.db.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { birthday: true },
  });
  const quote = await computeQuote(
    masterId,
    services.map((s) => s.id),
    startAt,
    { clientId, birthday: client.birthday },
  );
  const endAt = addMinutes(startAt, quote.durationMin);

  const id = await prisma.$transaction(async (tx) => {
    await lockMaster(tx, masterId);
    if (!input.force && (await hasOverlap(masterId, startAt, endAt))) throw conflict('slotTaken');
    const a = await scope.db.appointment.create({
      data: {
        masterId,
        clientId,
        startAt,
        endAt,
        status: input.status ?? 'CONFIRMED',
        price: input.price ?? quote.finalPrice,
        originalPrice: quote.totalPrice,
        discountPct: input.price === undefined ? quote.discountPct : null,
        discountSource: input.price === undefined ? quote.discountSourceKey : null,
        clientComment: input.comment ?? null,
        photos: [],
        createdBy,
        services: {
          create: services.map((s) => ({
            serviceId: s.id,
            name: s.name,
            duration: s.duration,
            price: s.price,
          })),
        },
      },
      select: { id: true },
    });
    return a.id;
  });
  defer('notify.staffBooking', () => notifyClientBookingCreated(id));
  return getAppointment(scope, id);
}

const TERMINAL: AppointmentStatus[] = ['CANCELLED'];

export async function patchAppointment(
  scope: TenantScope,
  id: string,
  patch: AppointmentPatchInput,
  actor: 'master' | 'salon',
  now: Date = new Date(),
): Promise<MasterAppointmentDto> {
  const current = await scope.db.appointment.findUnique({
    where: { id },
    include: { services: true },
  });
  if (!current) throw new NotFoundError();
  if (TERMINAL.includes(current.status) && patch.status && patch.status !== 'CANCELLED') {
    throw new AppError(409, 'conflict', 'Cancelled appointments cannot be reopened');
  }

  const data: Record<string, unknown> = {};
  let rescheduledFrom: { startAt: Date; endAt: Date } | null = null;
  let newRange: { startAt: Date; endAt: Date } | null = null;

  if (patch.startAt) {
    const startAt = new Date(patch.startAt);
    const duration = Math.round((current.endAt.getTime() - current.startAt.getTime()) / 60000);
    newRange = { startAt, endAt: addMinutes(startAt, duration) };
    data.startAt = newRange.startAt;
    data.endAt = newRange.endAt;
    data.clientConfirmedAt = null;
    rescheduledFrom = { startAt: current.startAt, endAt: current.endAt };
  }
  if (patch.price !== undefined) data.price = patch.price;
  if (patch.clientLate !== undefined) data.clientLate = patch.clientLate;
  if (patch.status && patch.status !== current.status) {
    data.status = patch.status;
    if (patch.status === 'COMPLETED') data.completedAt = now;
    if (patch.status === 'CANCELLED') {
      data.cancelledAt = now;
      data.cancelledBy = actor;
      data.cancelReason = patch.cancelReason ?? null;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await lockMaster(tx, current.masterId);
    if (
      newRange &&
      (await hasOverlap(current.masterId, newRange.startAt, newRange.endAt, current.id))
    ) {
      throw conflict('slotTaken');
    }
    return scope.db.appointment.update({ where: { id }, data });
  });
  const statusChanged = patch.status && patch.status !== current.status;
  if (statusChanged && (current.status === 'COMPLETED' || patch.status === 'COMPLETED')) {
    await recomputeClientStats(current.masterId, current.clientId);
  }
  if (statusChanged && patch.status === 'COMPLETED') {
    await applyReferralOnCompletion(current.masterId, {
      clientId: current.clientId,
      discountSource: current.discountSource,
      completedAt: updated.completedAt,
    });
  }

  if (statusChanged && patch.status === 'CONFIRMED' && current.status === 'PENDING') {
    defer('notify.confirmed', () => notifyClientStatusChange(id, 'confirmed'));
  }
  if (statusChanged && patch.status === 'CANCELLED') {
    defer('notify.cancelled', () => notifyClientStatusChange(id, 'cancelled'));
    defer('slotAlert.masterCancel', () =>
      triggerSlotFreed({
        masterId: current.masterId,
        startAt: current.startAt,
        endAt: current.endAt,
        appointmentId: id,
        excludeClientId: current.clientId,
      }),
    );
  }
  if (rescheduledFrom && (updated.status === 'PENDING' || updated.status === 'CONFIRMED')) {
    const from = rescheduledFrom;
    defer('notify.rescheduled', () => notifyClientStatusChange(id, 'rescheduled'));
    defer('slotAlert.masterReschedule', () =>
      triggerSlotFreed({
        masterId: current.masterId,
        startAt: from.startAt,
        endAt: from.endAt,
        appointmentId: id,
        excludeClientId: current.clientId,
      }),
    );
  }
  return getAppointment(scope, id);
}

export async function setAppointmentPhotos(
  scope: TenantScope,
  id: string,
  photos: { beforePhotoUrl?: string | null; afterPhotoUrl?: string | null },
): Promise<MasterAppointmentDto> {
  const current = await scope.db.appointment.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) throw new NotFoundError();
  if (current.status !== 'COMPLETED')
    throw new AppError(409, 'conflict', 'Photos can be added to completed visits only');
  await scope.db.appointment.update({
    where: { id },
    data: { beforePhotoUrl: photos.beforePhotoUrl, afterPhotoUrl: photos.afterPhotoUrl },
  });
  return getAppointment(scope, id);
}
