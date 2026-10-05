import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  isValidSlug,
  isValidUsername,
  normalizeUsername,
  type CategoryDto,
} from '@nail-crm/shared';
import { useCities } from '@/api/common';
import { Page } from '@/components/layout/Page';
import { CategoryGrid, CityPicker, CountryPicker } from '@/components/domain/pickers';
import { SinglePhotoUploader } from '@/components/domain/PhotoUploader';
import { MapView } from '@/components/map/MapView';
import { Field, GlassCard, GlassInput, GlassTextarea, SectionTitle } from '@/components/ui/glass';
import { useMainButton } from '@/hooks/telegram';
import { copyText, haptic } from '@/lib/telegram';

export interface TenantProfileValues {
  name: string;
  slug: string;
  username: string | null;
  channelUsername: string | null;
  avatarUrl: string | null;
  rules: string | null;
  countryId: string | null;
  cityId: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryIds: string[];
  categories?: CategoryDto[];
  publicLink: string;
}

export type TenantProfilePatch = Omit<
  TenantProfileValues,
  'categories' | 'publicLink' | 'countryId' | 'cityId'
> & { countryId?: string; cityId?: string };

export function TenantProfileForm({
  kind,
  profile,
  saving,
  onSave,
}: {
  kind: 'master' | 'salon';
  profile: TenantProfileValues;
  saving: boolean;
  onSave: (patch: TenantProfilePatch) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState(profile);
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => setV(profile), [profile]);
  const set = (patch: Partial<TenantProfileValues>) => setV((cur) => ({ ...cur, ...patch }));
  const cities = useCities(v.countryId);
  const city = cities.data?.find((c) => c.id === v.cityId);
  const prefix = kind === 'master' ? '/m/' : '/s/';

  const errors = useMemo(() => {
    const e: Partial<Record<keyof TenantProfileValues, string>> = {};
    if (v.name.trim().length < 2) e.name = t('validation.tooShort', { min: 2 });
    if (!isValidSlug(v.slug)) e.slug = t('validation.slug');
    if (v.username && !isValidUsername(v.username)) e.username = t('validation.username');
    if (v.channelUsername && !isValidUsername(v.channelUsername))
      e.channelUsername = t('validation.username');
    if (!v.categoryIds.length) e.categoryIds = t('validation.categories');
    if (!v.countryId) e.countryId = t('validation.required');
    if (!v.cityId) e.cityId = t('validation.required');
    return e;
  }, [v, t]);
  const err = (k: keyof TenantProfileValues) => (showErrors ? errors[k] : undefined);

  const submit = async () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      haptic.notify('error');
      return;
    }
    await onSave({
      name: v.name.trim(),
      slug: v.slug,
      username: v.username ? normalizeUsername(v.username) : null,
      channelUsername: v.channelUsername ? normalizeUsername(v.channelUsername) : null,
      avatarUrl: v.avatarUrl,
      rules: v.rules?.trim() || null,
      countryId: v.countryId!,
      cityId: v.cityId!,
      address: v.address?.trim() || null,
      latitude: v.latitude,
      longitude: v.longitude,
      categoryIds: v.categoryIds,
    });
    haptic.notify('success');
    toast.success(t('master.profile.saved'));
  };

  useMainButton({ text: t('common.save'), loading: saving, onClick: () => void submit() });

  return (
    <Page title={t('master.profile.title')} back bottomInset="button">
      <GlassCard className="flex items-center gap-4">
        <SinglePhotoUploader
          endpoint={kind === 'master' ? '/api/master/upload' : '/api/salon/upload'}
          kind="avatar"
          round
          size={80}
          value={v.avatarUrl}
          onChange={(avatarUrl) => set({ avatarUrl })}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-muted-foreground">{t('master.profile.publicLink')}</div>
          <button
            type="button"
            className="block w-full truncate text-left text-[15px] font-medium text-primary"
            onClick={() =>
              void copyText(profile.publicLink).then(() => toast.success(t('common.copied')))
            }
          >
            {profile.publicLink}
          </button>
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-4">
        <Field label={t('master.profile.name')} error={err('name')}>
          <GlassInput
            value={v.name}
            maxLength={64}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <Field
          label={t('master.profile.slug')}
          error={err('slug')}
          hint={t('master.onboarding.slugHint')}
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-muted-foreground">
              {prefix}
            </span>
            <GlassInput
              value={v.slug}
              autoCapitalize="none"
              className="pl-12"
              onChange={(e) =>
                set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
              }
            />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('master.profile.username')} error={err('username')}>
            <GlassInput
              value={v.username ?? ''}
              placeholder="@username"
              autoCapitalize="none"
              onChange={(e) => set({ username: e.target.value || null })}
            />
          </Field>
          <Field label={t('master.profile.channel')} error={err('channelUsername')}>
            <GlassInput
              value={v.channelUsername ?? ''}
              placeholder="@channel"
              autoCapitalize="none"
              onChange={(e) => set({ channelUsername: e.target.value || null })}
            />
          </Field>
        </div>
        <Field label={t('master.profile.rules')}>
          <GlassTextarea
            value={v.rules ?? ''}
            maxLength={3000}
            placeholder={t('master.profile.rulesPlaceholder')}
            onChange={(e) => set({ rules: e.target.value })}
          />
        </Field>
      </GlassCard>

      <section>
        <SectionTitle>{t('master.profile.categories')}</SectionTitle>
        <Field error={err('categoryIds')}>
          <CategoryGrid value={v.categoryIds} onChange={(categoryIds) => set({ categoryIds })} />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t('master.profile.location')}</SectionTitle>
        <Field error={err('countryId')}>
          <CountryPicker
            label={t('master.onboarding.country')}
            value={v.countryId}
            onChange={(countryId) => set({ countryId, cityId: null })}
          />
        </Field>
        <Field error={err('cityId')}>
          <CityPicker
            label={t('master.onboarding.city')}
            countryId={v.countryId}
            value={v.cityId}
            onChange={(cityId) => set({ cityId, latitude: null, longitude: null })}
          />
        </Field>
        <Field label={t('master.profile.address')}>
          <GlassInput
            value={v.address ?? ''}
            placeholder={t('master.onboarding.addressPlaceholder')}
            onChange={(e) => set({ address: e.target.value })}
          />
        </Field>
        <MapView
          height={280}
          zoom={13}
          center={
            v.latitude !== null && v.longitude !== null
              ? { lat: v.latitude, lng: v.longitude }
              : city?.latitude && city.longitude
                ? { lat: city.latitude, lng: city.longitude }
                : null
          }
          picked={
            v.latitude !== null && v.longitude !== null
              ? { lat: v.latitude, lng: v.longitude }
              : null
          }
          onPick={(p) => set({ latitude: p.lat, longitude: p.lng })}
        />
      </section>
    </Page>
  );
}
