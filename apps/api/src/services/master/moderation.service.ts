import type { z } from 'zod';
import {
  normalizePhone,
  normalizeUsername,
  type BlacklistCreateInput,
  type BlacklistEntryDto,
  type BlockedScreenDto,
  type blockedScreenSchema,
  type ReviewDto,
} from '@nail-crm/shared';
import type { TenantDb } from '../../db/tenant';
import { badRequest, conflict } from '../../lib/errors';
import { toBlockedScreenDto, toReviewDto } from '../../lib/mappers';
import { recomputeMasterRating } from '../clientStats.service';

type BlockedScreenInput = z.output<typeof blockedScreenSchema>;

/* ───────────── Reviews ───────────── */

export async function listReviews(db: TenantDb): Promise<ReviewDto[]> {
  const rows = await db.review.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  return rows.map(toReviewDto);
}

export async function setReviewPublished(
  db: TenantDb,
  id: string,
  isPublished: boolean,
): Promise<ReviewDto> {
  const row = await db.review.update({ where: { id }, data: { isPublished } });
  await recomputeMasterRating(row.masterId);
  return toReviewDto(row);
}

export async function deleteReview(db: TenantDb, id: string): Promise<void> {
  const row = await db.review.delete({ where: { id } });
  await recomputeMasterRating(row.masterId);
}

/* ───────────── Blacklist ───────────── */
// Entries are matched by normalized username/phone. Attempts are never logged.

const toEntryDto = (e: {
  id: string;
  username: string | null;
  phone: string | null;
  reason: string | null;
  createdAt: Date;
}): BlacklistEntryDto => ({
  id: e.id,
  username: e.username,
  phone: e.phone,
  reason: e.reason,
  createdAt: e.createdAt.toISOString(),
});

export async function listBlacklist(db: TenantDb): Promise<BlacklistEntryDto[]> {
  const rows = await db.blacklistEntry.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toEntryDto);
}

export async function addToBlacklist(
  db: TenantDb,
  masterId: string,
  input: BlacklistCreateInput,
): Promise<BlacklistEntryDto> {
  const username = normalizeUsername(input.username ?? null);
  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(input.phone, input.phoneCountry ?? 'RU');
    if (!phone) throw badRequest('invalidPhone');
  }
  const duplicate = await db.blacklistEntry.findFirst({
    where: { OR: [...(username ? [{ username }] : []), ...(phone ? [{ phone }] : [])] },
    select: { id: true },
  });
  if (duplicate) throw conflict('conflict', 'Already in the blacklist');
  const row = await db.blacklistEntry.create({
    data: { masterId, username, phone, reason: input.reason ?? null },
  });
  return toEntryDto(row);
}

export async function removeFromBlacklist(db: TenantDb, id: string): Promise<void> {
  await db.blacklistEntry.delete({ where: { id } });
}

export async function getBlockedScreen(db: TenantDb, masterId: string): Promise<BlockedScreenDto> {
  const row = await db.blockedScreen.upsert({
    where: { masterId },
    create: { masterId },
    update: {},
  });
  return toBlockedScreenDto(row);
}

export async function putBlockedScreen(
  db: TenantDb,
  masterId: string,
  input: BlockedScreenInput,
): Promise<BlockedScreenDto> {
  const data = {
    title: input.title,
    text: input.text,
    imageUrl: input.imageUrl ?? null,
    buttonText: input.buttonText ?? null,
    buttonUrl: input.buttonUrl ?? null,
  };
  const row = await db.blockedScreen.upsert({
    where: { masterId },
    create: { ...data, masterId },
    update: data,
  });
  return toBlockedScreenDto(row);
}
