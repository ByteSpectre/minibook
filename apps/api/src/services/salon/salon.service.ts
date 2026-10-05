import type { z } from 'zod';
import {
  DEFAULT_THEME_PRESET,
  type AuthResponse,
  type salonOnboardingCompleteSchema,
  type SalonProfileDto,
  type salonProfilePatchSchema,
  type ServiceDto,
  type ThemeDto,
  type ThemePatchInput,
  type ThemePreset,
} from '@nail-crm/shared';
import { prisma } from '../../db/prisma';
import type { SalonTenant } from '../../middleware/auth';
import { conflict, NotFoundError } from '../../lib/errors';
import { salonPublicLink } from '../../lib/links';
import { themeDataForPreset, toCategoryDto, toServiceDto, toThemeDto } from '../../lib/mappers';
import { addDays } from '../../lib/time';
import { issueSession } from '../auth.service';
import { trackFunnel } from '../funnel.service';
import { assertCategories, isSlugAvailable, resolveLocation } from '../master/onboarding.service';
import { getPlatformSettings } from '../settings.service';

type SalonOnboarding = z.output<typeof salonOnboardingCompleteSchema>;
type SalonPatch = z.output<typeof salonProfilePatchSchema>;

export async function completeSalonOnboarding(
  userId: string,
  input: SalonOnboarding,
  now: Date = new Date(),
): Promise<AuthResponse> {
  const existing = await prisma.salon.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (existing) throw conflict('alreadyRegistered', 'Salon already exists');
  if (!(await isSlugAvailable(input.slug))) throw conflict('slugTaken', 'Slug is taken');
  const categoryIds = await assertCategories(input.categoryIds);
  const { timezone, currency } = await resolveLocation(input.countryId, input.cityId);
  const settings = await getPlatformSettings();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { username: true },
  });
  await prisma.$transaction(async (tx) => {
    const salon = await tx.salon.create({
      data: {
        ownerId: userId,
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
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        theme: { create: themeDataForPreset(input.themePreset ?? DEFAULT_THEME_PRESET) },
      },
    });
    await tx.userRole.upsert({
      where: { userId_role: { userId, role: 'SALON' } },
      create: { userId, role: 'SALON', salonId: salon.id },
      update: { salonId: salon.id },
    });
    await tx.onboardingDraft.deleteMany({ where: { userId, role: 'SALON' } });
  });
  await trackFunnel(userId, 'ONBOARDING_COMPLETED', 'SALON');
  return issueSession(userId);
}

export async function getSalonProfile(t: SalonTenant): Promise<SalonProfileDto> {
  const s = await prisma.salon.findUnique({
    where: { id: t.salonId },
    include: { categories: { include: { category: true } }, _count: { select: { masters: true } } },
  });
  if (!s) throw new NotFoundError();
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    username: s.username,
    channelUsername: s.channelUsername,
    avatarUrl: s.avatarUrl,
    rules: s.rules,
    countryId: s.countryId,
    cityId: s.cityId,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    timezone: s.timezone,
    currency: s.currency,
    categoryIds: s.categories.map((c) => c.categoryId),
    categories: s.categories.map((c) => toCategoryDto(c.category)),
    access: t.access,
    publicLink: salonPublicLink(s.slug),
    mastersCount: s._count.masters,
    createdAt: s.createdAt.toISOString(),
  };
}

export async function patchSalonProfile(
  t: SalonTenant,
  patch: SalonPatch,
): Promise<SalonProfileDto> {
  if (
    patch.slug &&
    patch.slug !== t.salon.slug &&
    !(await isSlugAvailable(patch.slug, { salonId: t.salonId }))
  ) {
    throw conflict('slugTaken', 'Slug is taken');
  }
  let location: { timezone: string; currency: string } | null = null;
  if (patch.cityId || patch.countryId) {
    const current = await prisma.salon.findUniqueOrThrow({
      where: { id: t.salonId },
      select: { countryId: true, cityId: true },
    });
    const countryId = patch.countryId ?? current.countryId;
    const cityId = patch.cityId ?? current.cityId;
    if (countryId && cityId) location = await resolveLocation(countryId, cityId);
  }
  const categoryIds = patch.categoryIds ? await assertCategories(patch.categoryIds) : null;
  await prisma.$transaction(async (tx) => {
    await tx.salon.update({
      where: { id: t.salonId },
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
        ...(location ? { timezone: location.timezone, currency: location.currency } : {}),
      },
    });
    if (categoryIds) {
      await tx.salonCategory.deleteMany({
        where: { salonId: t.salonId, categoryId: { notIn: categoryIds } },
      });
      await tx.salonCategory.createMany({
        data: categoryIds.map((categoryId) => ({ salonId: t.salonId, categoryId })),
        skipDuplicates: true,
      });
    }
  });
  return getSalonProfile(t);
}

export async function getSalonTheme(t: SalonTenant): Promise<ThemeDto> {
  return toThemeDto(await t.db.masterTheme.findFirst({}));
}

export async function patchSalonTheme(t: SalonTenant, patch: ThemePatchInput): Promise<ThemeDto> {
  const existing = await t.db.masterTheme.findFirst({ select: { id: true } });
  const data = { ...patch, preset: null };
  const theme = existing
    ? await t.db.masterTheme.update({ where: { id: existing.id }, data })
    : await t.db.masterTheme.create({
        data: { ...themeDataForPreset('liquid_glass'), ...data, salonId: t.salonId },
      });
  return toThemeDto(theme);
}

export async function applySalonThemePreset(
  t: SalonTenant,
  preset: ThemePreset,
): Promise<ThemeDto> {
  const data = themeDataForPreset(preset);
  const existing = await t.db.masterTheme.findFirst({ select: { id: true } });
  const theme = existing
    ? await t.db.masterTheme.update({ where: { id: existing.id }, data })
    : await t.db.masterTheme.create({ data: { ...data, salonId: t.salonId } });
  return toThemeDto(theme);
}

export async function listSalonServices(
  t: SalonTenant,
): Promise<(ServiceDto & { masterId: string; masterName: string })[]> {
  const rows = await t.db.service.findMany({
    where: { deletedAt: null },
    include: { master: { select: { name: true } } },
    orderBy: [{ masterId: 'asc' }, { sortOrder: 'asc' }],
  });
  return rows.map((s) => ({ ...toServiceDto(s), masterId: s.masterId, masterName: s.master.name }));
}
