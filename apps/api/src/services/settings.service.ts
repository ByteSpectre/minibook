import type { PlatformSettingsPatchInput } from '@nail-crm/shared';
import { env } from '../config';
import { prisma } from '../db/prisma';

export interface PlatformSettings {
  masterPriceRub: number;
  salonPriceRub: number;
  trialDays: number;
  referralBonusDays: number;
  weeklyDigestEnabled: boolean;
}

const defaults = (): PlatformSettings => ({
  masterPriceRub: env.MASTER_PRICE_RUB,
  salonPriceRub: env.SALON_PRICE_RUB,
  trialDays: env.TRIAL_DAYS,
  referralBonusDays: env.REFERRAL_BONUS_DAYS,
  weeklyDigestEnabled: true,
});

let cache: { value: PlatformSettings; at: number } | null = null;
const TTL_MS = 30_000;

/** Prices and trial length: owner overrides from the DB, falling back to env. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await prisma.platformSetting.findMany();
  const value = defaults();
  for (const row of rows) {
    const key = row.key as keyof PlatformSettings;
    if (!(key in value)) continue;
    if (key === 'weeklyDigestEnabled' && typeof row.value === 'boolean') value[key] = row.value;
    else if (key !== 'weeklyDigestEnabled' && typeof row.value === 'number') value[key] = row.value;
  }
  cache = { value, at: Date.now() };
  return value;
}

export async function updatePlatformSettings(
  patch: PlatformSettingsPatchInput,
): Promise<PlatformSettings> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: value as number | boolean },
        update: { value: value as number | boolean },
      }),
    ),
  );
  cache = null;
  return getPlatformSettings();
}

export function resetSettingsCache(): void {
  cache = null;
}
