import type { z } from 'zod';
import {
  defaultCountryForLocale,
  normalizePhone,
  normalizeUsername,
  type bookingCreateSchema,
  type BookingResponse,
} from '@nail-crm/shared';
import { prisma } from '../db/prisma';
import { defer } from '../lib/deferred';
import { AppError, badRequest, conflict, NotFoundError } from '../lib/errors';
import { icsUrlFor } from '../lib/links';
import { clientAppointmentInclude, toClientAppointmentDto } from '../lib/mappers';
import { addMinutes } from '../lib/time';
import { identityOf, isBlacklisted, loadUserAtMaster, mergeIdentity } from './blacklist.service';
import { trackFunnel } from './funnel.service';
import { notifyClientBookingCreated, notifyNewAppointment } from './notifications/messages';
import { computeQuote } from './pricing.service';
import { findMasterBySlug, masterIsPublic } from './public.service';
import { isSlotBookable, resolveServices } from './slots.service';

export type BookingInput = z.output<typeof bookingCreateSchema>;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Serializes bookings per master so two clients can't take the same slot. */
export async function lockMaster(tx: Tx, masterId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${masterId}))`;
}

export interface ResolvedContact {
  firstName: string;
  phone: string;
  username: string | null;
}

export function normalizeContact(
  contact: BookingInput['contact'],
  fallbackCountry: string | null | undefined,
  languageCode: string | null | undefined,
): ResolvedContact {
  const country = contact.phoneCountry ?? fallbackCountry ?? defaultCountryForLocale(languageCode);
  const phone = normalizePhone(contact.phone, country);
  if (!phone) throw badRequest('invalidPhone', 'Invalid phone number');
  return {
    firstName: contact.firstName,
    phone,
    username: normalizeUsername(contact.username ?? null),
  };
}

export async function createClientBooking(
  userId: string,
  slug: string,
  input: BookingInput,
  now: Date = new Date(),
): Promise<BookingResponse> {
  const master = await findMasterBySlug(slug);
  if (!master || !masterIsPublic(master, now)) throw new NotFoundError();

  const ctx = await loadUserAtMaster(userId, master.id);
  const contact = normalizeContact(input.contact, ctx.profile?.phoneCountry, ctx.user.languageCode);
  const identity = mergeIdentity(identityOf(ctx), {
    usernames: contact.username ? [contact.username] : [],
    phones: [contact.phone],
  });
  if (await isBlacklisted(master.id, identity))
    throw new AppError(403, 'blocked', 'Booking unavailable');

  const serviceIds = [...new Set(input.serviceIds)];
  if (serviceIds.length > 1 && !master.allowMultiService) throw badRequest('multiServiceDisabled');
  const { durationMin } = await resolveServices(master.id, serviceIds);
  const startAt = new Date(input.startAt);
  if (startAt <= now) throw badRequest('pastTime');

  const appointmentId = await prisma.$transaction(async (tx) => {
    await lockMaster(tx, master.id);
    if (!(await isSlotBookable(master.id, serviceIds, startAt, { now, durationMin }))) {
      throw conflict('slotTaken', 'Slot is no longer available');
    }

    let clientId = ctx.client?.id ?? null;
    let isNewClient = false;
    if (!clientId) {
      const claimable = await tx.client.findFirst({
        where: {
          masterId: master.id,
          telegramId: null,
          OR: [
            ...(contact.username ? [{ username: contact.username }] : []),
            { phone: contact.phone },
          ],
        },
        select: { id: true },
      });
      if (claimable) {
        clientId = claimable.id;
      } else {
        const created = await tx.client.create({
          data: {
            masterId: master.id,
            userId: ctx.user.id,
            telegramId: ctx.user.telegramId,
            firstName: contact.firstName,
            phone: contact.phone,
            username: contact.username,
            gender: ctx.profile?.gender ?? null,
            birthday: ctx.profile?.birthday ?? null,
          },
          select: { id: true },
        });
        clientId = created.id;
        isNewClient = true;
      }
    }
    // Contact edits on the booking form update only this master's Client record.
    await tx.client.update({
      where: { id: clientId },
      data: {
        userId: ctx.user.id,
        telegramId: ctx.user.telegramId,
        firstName: contact.firstName,
        phone: contact.phone,
        username: contact.username,
      },
    });

    let referrerClientId: string | null = null;
    if (isNewClient && input.referrerClientId && input.referrerClientId !== clientId) {
      const referrer = await tx.client.findFirst({
        where: {
          id: input.referrerClientId,
          masterId: master.id,
          NOT: { telegramId: ctx.user.telegramId },
        },
        select: { id: true },
      });
      if (referrer) {
        await tx.referral.createMany({
          data: [{ masterId: master.id, referrerId: referrer.id, referredId: clientId }],
          skipDuplicates: true,
        });
        referrerClientId = referrer.id;
      }
    }

    // The quote reads committed data, so a brand-new client is priced as "no history".
    const quote = await computeQuote(
      master.id,
      serviceIds,
      startAt,
      {
        clientId: isNewClient ? null : clientId,
        birthday: ctx.client?.birthday ?? ctx.profile?.birthday ?? null,
        referrerClientId,
      },
      now,
    );

    const appointment = await tx.appointment.create({
      data: {
        masterId: master.id,
        clientId,
        startAt,
        endAt: addMinutes(startAt, quote.durationMin),
        status: master.autoConfirm ? 'CONFIRMED' : 'PENDING',
        price: quote.finalPrice,
        originalPrice: quote.totalPrice,
        discountPct: quote.discountPct,
        discountSource: quote.discountSourceKey,
        clientComment: input.comment ?? null,
        photos: input.photos,
        createdBy: 'client',
        services: {
          create: quote.services.map((s) => ({
            serviceId: s.id,
            name: s.name,
            duration: s.duration,
            price: s.price,
          })),
        },
      },
      select: { id: true },
    });
    return appointment.id;
  });

  const masterUser = await prisma.master.findUnique({
    where: { id: master.id },
    select: { userId: true },
  });
  if (masterUser) await trackFunnel(masterUser.userId, 'FIRST_APPOINTMENT', 'MASTER');
  defer('notify.newAppointment', () => notifyNewAppointment(appointmentId));
  defer('notify.clientBooking', () => notifyClientBookingCreated(appointmentId));

  const row = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: clientAppointmentInclude,
  });
  return { appointment: toClientAppointmentDto(row, now), icsUrl: icsUrlFor(appointmentId) };
}
