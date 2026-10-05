import type { z } from 'zod';
import {
  buildStartParam,
  LIMITS,
  type masterProfilePatchSchema,
  type MasterProfileDto,
  type ShareDto,
  type ThemeDto,
  type ThemePatchInput,
  type ThemePreset,
} from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import type { MasterTenant } from '../../middleware/auth';
import { defer } from '../../lib/deferred';
import { conflict, NotFoundError } from '../../lib/errors';
import { masterPublicLink, miniAppLink } from '../../lib/links';
import { themeDataForPreset, toCategoryDto, toThemeDto } from '../../lib/mappers';
import { addHours } from '../../lib/time';
import { announceOnlineOpen } from '../notifications/slotAlerts.service';
import { assertCategories, isSlugAvailable, resolveLocation } from './onboarding.service';

type ProfilePatch = z.output<typeof masterProfilePatchSchema>;

export async function getMasterProfile(t: MasterTenant): Promise<MasterProfileDto> {
  const m = await prisma.master.findUnique({
    where: { id: t.masterId },
    include: {
      categories: { include: { category: true } },
      salon: { select: { id: true, slug: true, name: true } },
    },
  });
  if (!m) throw new NotFoundError();
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    username: m.username,
    channelUsername: m.channelUsername,
    avatarUrl: m.avatarUrl,
    rules: m.rules,
    countryId: m.countryId,
    cityId: m.cityId,
    address: m.address,
    latitude: m.latitude,
    longitude: m.longitude,
    timezone: m.timezone,
    currency: m.currency,
    categoryIds: m.categories.map((c) => c.categoryId),
    categories: m.categories.map((c) => toCategoryDto(c.category)),
    autoConfirm: m.autoConfirm,
    allowMultiService: m.allowMultiService,
    postVisitMessage: m.postVisitMessage,
    isOnlineOpen: m.isOnlineOpen && !!m.onlineOpenUntil && m.onlineOpenUntil > new Date(),
    onlineOpenUntil: m.onlineOpenUntil ? m.onlineOpenUntil.toISOString() : null,
    ratingAvg: m.ratingAvg,
    ratingCount: m.ratingCount,
    salon: m.salon,
    access: t.access,
    publicLink: masterPublicLink(m.slug),
    createdAt: m.createdAt.toISOString(),
  };
}

export async function patchMasterProfile(
  t: MasterTenant,
  patch: ProfilePatch,
): Promise<MasterProfileDto> {
  if (
    patch.slug &&
    patch.slug !== t.master.slug &&
    !(await isSlugAvailable(patch.slug, { masterId: t.masterId }))
  ) {
    throw conflict('slugTaken', 'Slug is taken');
  }
  let location: { timezone: string; currency: string } | null = null;
  if (patch.cityId || patch.countryId) {
    const current = await prisma.master.findUniqueOrThrow({
      where: { id: t.masterId },
      select: { countryId: true, cityId: true },
    });
    const countryId = patch.countryId ?? current.countryId;
    const cityId = patch.cityId ?? current.cityId;
    if (countryId && cityId) location = await resolveLocation(countryId, cityId);
  }
  const categoryIds = patch.categoryIds ? await assertCategories(patch.categoryIds) : null;
  await prisma.$transaction(async (tx) => {
    await tx.master.update({
      where: { id: t.masterId },
      data: {
        name: patch.name,
        slug: patch.slug,
        username: patch.username === undefined ? undefined : patch.username,
        channelUsername: patch.channelUsername === undefined ? undefined : patch.channelUsername,
        avatarUrl: patch.avatarUrl,
        rules: patch.rules,
        countryId: patch.countryId,
        cityId: patch.cityId,
        address: patch.address,
        latitude: patch.latitude,
        longitude: patch.longitude,
        autoConfirm: patch.autoConfirm,
        allowMultiService: patch.allowMultiService,
        postVisitMessage: patch.postVisitMessage,
        ...(location ? { timezone: location.timezone, currency: location.currency } : {}),
      },
    });
    if (categoryIds) {
      await tx.masterCategory.deleteMany({
        where: { masterId: t.masterId, categoryId: { notIn: categoryIds } },
      });
      await tx.masterCategory.createMany({
        data: categoryIds.map((categoryId) => ({ masterId: t.masterId, categoryId })),
        skipDuplicates: true,
      });
    }
  });
  return getMasterProfile(t);
}

export async function getTheme(t: MasterTenant): Promise<ThemeDto> {
  const theme = await t.db.masterTheme.findFirst({});
  return toThemeDto(theme);
}

export async function patchTheme(t: MasterTenant, patch: ThemePatchInput): Promise<ThemeDto> {
  const existing = await t.db.masterTheme.findFirst({ select: { id: true } });
  const data = { ...patch, preset: null };
  const theme = existing
    ? await t.db.masterTheme.update({ where: { id: existing.id }, data })
    : await t.db.masterTheme.create({
        data: { ...themeDataForPreset('liquid_glass'), ...data, masterId: t.masterId },
      });
  return toThemeDto(theme);
}

export async function applyThemePreset(t: MasterTenant, preset: ThemePreset): Promise<ThemeDto> {
  const data = themeDataForPreset(preset);
  const existing = await t.db.masterTheme.findFirst({ select: { id: true } });
  const theme = existing
    ? await t.db.masterTheme.update({ where: { id: existing.id }, data })
    : await t.db.masterTheme.create({ data: { ...data, masterId: t.masterId } });
  return toThemeDto(theme);
}

export function getShare(t: MasterTenant, avatarUrl: string | null): ShareDto {
  const startParam = buildStartParam({ kind: 'master', slug: t.master.slug });
  return {
    link: miniAppLink(startParam),
    startParam,
    botUsername: miniAppLink().replace('https://t.me/', '').split(/[/?]/)[0] ?? '',
    name: t.master.name,
    avatarUrl,
  };
}

/** "Available right now": adds a bookable window for N hours and boosts the card in search. */
export async function openOnline(t: MasterTenant, hours?: number, now: Date = new Date()) {
  const settings = await t.db.masterSettings.findFirst({ select: { onlineDurationHours: true } });
  const duration = Math.min(hours ?? settings?.onlineDurationHours ?? 2, LIMITS.onlineOpenMaxHours);
  const until = addHours(now, duration);
  await prisma.master.update({
    where: { id: t.masterId },
    data: { isOnlineOpen: true, onlineOpenUntil: until },
  });
  defer('online.announce', () => announceOnlineOpen(t.masterId, until, now));
  return { isOnlineOpen: true, onlineOpenUntil: until.toISOString() };
}

export async function closeOnline(t: MasterTenant) {
  await prisma.master.update({
    where: { id: t.masterId },
    data: { isOnlineOpen: false, onlineOpenUntil: null },
  });
  return { isOnlineOpen: false, onlineOpenUntil: null };
}
