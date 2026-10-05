import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Check, Gift, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  isValidSlug,
  isValidUsername,
  slugify,
  type MasterOnboardingInput,
  type SalonOnboardingInput,
  type ScheduleDayDto,
  type ThemePreset,
} from '@nail-crm/shared';
import {
  checkSlug,
  useCompleteOnboarding,
  useOnboardingDraft,
  useSaveDraft,
  type CabinetBase,
} from '@/api/cabinetApi';
import { useCities } from '@/api/common';
import { Page } from '@/components/layout/Page';
import { FullscreenSpinner } from '@/components/layout/states';
import { AddressInput } from '@/components/domain/AddressInput';
import { CategoryGrid, CityPicker, CountryPicker } from '@/components/domain/pickers';
import { SinglePhotoUploader } from '@/components/domain/PhotoUploader';
import { MapView } from '@/components/map/MapView';
import { Field, GlassCard, GlassInput } from '@/components/ui/glass';
import { useMainButton } from '@/hooks/telegram';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { useMe } from '@/store/auth';
import { ThemePresetPicker } from './ThemePresetPicker';
import { DEFAULT_WEEK, toWeeklyInput, WeeklyScheduleEditor } from './WeeklyScheduleEditor';

type Kind = 'master' | 'salon';
type StepKey =
  | 'name'
  | 'contacts'
  | 'categories'
  | 'location'
  | 'address'
  | 'service'
  | 'schedule'
  | 'appearance';

const STEPS: Record<Kind, StepKey[]> = {
  master: [
    'name',
    'contacts',
    'categories',
    'location',
    'address',
    'service',
    'schedule',
    'appearance',
  ],
  salon: ['name', 'contacts', 'categories', 'location', 'address', 'appearance'],
};
const SKIPPABLE: StepKey[] = ['schedule', 'appearance', 'address'];

interface Values {
  name: string;
  slug: string;
  slugTouched: boolean;
  username: string;
  channelUsername: string;
  categoryIds: string[];
  countryId: string | null;
  cityId: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  serviceName: string;
  servicePrice: string;
  serviceDuration: string;
  serviceImage: string | null;
  schedule: ScheduleDayDto[];
  avatarUrl: string | null;
  themePreset: ThemePreset;
}

export interface TenantOnboardingProps {
  kind: Kind;
  joinSalon?: { salonId: string; code: string } | null;
  referrerMasterId?: string | null;
}

export function TenantOnboarding({ kind, joinSalon, referrerMasterId }: TenantOnboardingProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const base: CabinetBase = kind === 'master' ? '/api/master' : '/api/salon';
  const ns = kind === 'master' ? 'master' : 'salon';
  const draft = useOnboardingDraft(base);
  const saveDraft = useSaveDraft(base);
  const complete = useCompleteOnboarding<MasterOnboardingInput | SalonOnboardingInput>(base);
  const steps = STEPS[kind];
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [v, setV] = useState<Values>({
    name: '',
    slug: '',
    slugTouched: false,
    username: me?.user.username ?? '',
    channelUsername: '',
    categoryIds: [],
    countryId: null,
    cityId: null,
    address: '',
    latitude: null,
    longitude: null,
    serviceName: '',
    servicePrice: '',
    serviceDuration: '60',
    serviceImage: null,
    schedule: DEFAULT_WEEK,
    avatarUrl: me?.user.photoUrl ?? null,
    themePreset: 'liquid_glass',
  });
  const set = (patch: Partial<Values>) => setV((cur) => ({ ...cur, ...patch }));
  const cities = useCities(v.countryId);
  const city = cities.data?.find((c) => c.id === v.cityId);

  useEffect(() => {
    if (restored || !draft.data) return;
    setRestored(true);
    if (draft.data.data && Object.keys(draft.data.data).length) {
      setV((cur) => ({ ...cur, ...(draft.data!.data as Partial<Values>) }));
      setStep(Math.min(Math.max(0, draft.data.step - 1), steps.length - 1));
    }
  }, [draft.data, restored, steps.length]);

  const slugTimer = useRef<number>(undefined);
  useEffect(() => {
    window.clearTimeout(slugTimer.current);
    if (!v.slug || !isValidSlug(v.slug)) {
      setSlugState('idle');
      return;
    }
    setSlugState('checking');
    slugTimer.current = window.setTimeout(async () => {
      try {
        setSlugState((await checkSlug(base, v.slug)) ? 'free' : 'taken');
      } catch {
        setSlugState('idle');
      }
    }, 400);
    return () => window.clearTimeout(slugTimer.current);
  }, [v.slug, base]);

  const key = steps[step]!;
  const last = step === steps.length - 1;

  const errors = useMemo(() => {
    const e: Partial<Record<string, string>> = {};
    if (key === 'name') {
      if (v.name.trim().length < 2) e.name = t('validation.tooShort', { min: 2 });
      if (!isValidSlug(v.slug)) e.slug = t('validation.slug');
      else if (slugState === 'taken') e.slug = t('master.onboarding.slugTaken');
    }
    if (key === 'contacts') {
      if (v.username && !isValidUsername(v.username)) e.username = t('validation.username');
      if (v.channelUsername && !isValidUsername(v.channelUsername))
        e.channelUsername = t('validation.username');
    }
    if (key === 'categories' && v.categoryIds.length === 0)
      e.categoryIds = t('validation.categories');
    if (key === 'location') {
      if (!v.countryId) e.countryId = t('validation.required');
      if (!v.cityId) e.cityId = t('validation.required');
    }
    if (key === 'service') {
      if (!v.serviceName.trim()) e.serviceName = t('validation.required');
      if (!(Number(v.servicePrice) >= 0) || v.servicePrice === '')
        e.servicePrice = t('validation.required');
      const d = Number(v.serviceDuration);
      if (!(d >= 5 && d <= 720)) e.serviceDuration = t('validation.tooSmall', { min: 5 });
    }
    return e;
  }, [key, v, slugState, t]);
  const [showErrors, setShowErrors] = useState(false);

  const payload = (): MasterOnboardingInput | SalonOnboardingInput => {
    const common = {
      name: v.name.trim(),
      slug: v.slug,
      username: v.username || null,
      channelUsername: v.channelUsername || null,
      categoryIds: v.categoryIds,
      countryId: v.countryId!,
      cityId: v.cityId!,
      address: v.address.trim() || null,
      latitude: v.latitude,
      longitude: v.longitude,
      avatarUrl: v.avatarUrl,
      themePreset: v.themePreset,
    };
    if (kind === 'salon') return common;
    return {
      ...common,
      firstService: {
        name: v.serviceName.trim(),
        price: Number(v.servicePrice),
        duration: Number(v.serviceDuration),
        imageUrl: v.serviceImage,
        categoryId: v.categoryIds[0] ?? null,
      },
      schedule: toWeeklyInput(v.schedule),
      ...(joinSalon ? { joinSalon } : {}),
      ...(referrerMasterId ? { referrerMasterId } : {}),
    };
  };

  const next = async () => {
    if (Object.keys(errors).length || (key === 'name' && slugState === 'checking')) {
      setShowErrors(true);
      haptic.notify('error');
      return;
    }
    setShowErrors(false);
    saveDraft.mutate({ step: step + 2, data: { ...v } as unknown as Record<string, unknown> });
    if (!last) {
      setStep((s) => s + 1);
      return;
    }
    await complete.mutateAsync(payload());
    haptic.notify('success');
    toast.success(t(kind === 'master' ? 'master.onboarding.created' : 'salon.onboarding.created'));
    navigate(kind === 'master' ? '/master' : '/salon', { replace: true });
  };

  useMainButton({
    text: last
      ? t(kind === 'master' ? 'master.onboarding.finish' : 'salon.onboarding.finish')
      : t('common.next'),
    onClick: () => void next(),
    loading: complete.isPending,
  });

  if (draft.isLoading) return <FullscreenSpinner />;
  const err = (name: string) => (showErrors ? errors[name] : undefined);

  const titles: Record<StepKey, [string, string?]> = {
    name: [t(kind === 'master' ? 'master.onboarding.nameTitle' : 'salon.onboarding.nameTitle')],
    contacts: [t('master.onboarding.contactsTitle'), t('master.onboarding.contactsHint')],
    categories: [t('master.onboarding.categoriesTitle'), t('master.onboarding.categoriesHint')],
    location: [t('master.onboarding.locationTitle')],
    address: [t('master.onboarding.addressTitle'), t('master.onboarding.addressHint')],
    service: [t('master.onboarding.serviceTitle'), t('master.onboarding.serviceHint')],
    schedule: [t('master.onboarding.scheduleTitle'), t('master.onboarding.scheduleHint')],
    appearance: [t('master.onboarding.appearanceTitle'), t('master.onboarding.appearanceHint')],
  };

  return (
    <Page
      back={step > 0 ? () => setStep((s) => s - 1) : true}
      bottomInset="button"
      largeTitle={false}
      title={t(`${ns}.onboarding.title`)}
      subtitle={t('master.onboarding.stepOf', { step: step + 1, total: steps.length })}
      actions={
        SKIPPABLE.includes(key) && !last ? (
          <button
            type="button"
            className="h-10 px-2 text-[15px] font-medium text-primary"
            onClick={() => setStep((s) => s + 1)}
          >
            {t('common.skip')}
          </button>
        ) : null
      }
    >
      <div className="flex gap-1" aria-hidden>
        {steps.map((s, i) => (
          <span
            key={s}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-brand' : 'bg-muted',
            )}
          />
        ))}
      </div>
      {step === 0 && joinSalon ? (
        <GlassCard className="flex items-center gap-2 text-[14px]">
          <Building2 className="size-4 shrink-0" /> {t('master.onboarding.joinSalon')}
        </GlassCard>
      ) : null}
      {step === 0 && referrerMasterId ? (
        <GlassCard className="flex items-center gap-2 text-[14px]">
          <Gift className="size-4 shrink-0" /> {t('master.onboarding.referral')}
        </GlassCard>
      ) : null}
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4 pt-2"
        >
          <div>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">{titles[key][0]}</h1>
            {titles[key][1] ? (
              <p className="mt-1 text-[15px] text-muted-foreground">{titles[key][1]}</p>
            ) : null}
          </div>

          {key === 'name' ? (
            <GlassCard className="flex flex-col gap-4">
              <Field
                label={t(kind === 'master' ? 'master.onboarding.name' : 'salon.onboarding.name')}
                error={err('name')}
              >
                <GlassInput
                  autoFocus
                  value={v.name}
                  onChange={(e) =>
                    set({
                      name: e.target.value,
                      ...(v.slugTouched ? {} : { slug: slugify(e.target.value) }),
                    })
                  }
                />
              </Field>
              <Field
                label={t('master.onboarding.slug')}
                error={err('slug')}
                hint={
                  slugState === 'free'
                    ? t('master.onboarding.slugFree')
                    : t('master.onboarding.slugHint')
                }
              >
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-muted-foreground">
                    /{kind === 'master' ? 'm' : 's'}/
                  </span>
                  <GlassInput
                    value={v.slug}
                    autoCapitalize="none"
                    className="pr-10 pl-12"
                    onChange={(e) =>
                      set({
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                        slugTouched: true,
                      })
                    }
                  />
                  <span className="absolute top-1/2 right-3.5 -translate-y-1/2">
                    {slugState === 'checking' ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : null}
                    {slugState === 'free' ? <Check className="size-4 text-emerald-500" /> : null}
                    {slugState === 'taken' ? <X className="size-4 text-destructive" /> : null}
                  </span>
                </div>
              </Field>
            </GlassCard>
          ) : null}

          {key === 'contacts' ? (
            <GlassCard className="flex flex-col gap-4">
              <Field
                label={t(
                  kind === 'master' ? 'master.onboarding.username' : 'salon.onboarding.username',
                )}
                error={err('username')}
              >
                <GlassInput
                  value={v.username}
                  placeholder="@username"
                  autoCapitalize="none"
                  onChange={(e) => set({ username: e.target.value })}
                />
              </Field>
              <Field
                label={t(
                  kind === 'master' ? 'master.onboarding.channel' : 'salon.onboarding.channel',
                )}
                hint={t('common.optional')}
                error={err('channelUsername')}
              >
                <GlassInput
                  value={v.channelUsername}
                  placeholder="@channel"
                  autoCapitalize="none"
                  onChange={(e) => set({ channelUsername: e.target.value })}
                />
              </Field>
            </GlassCard>
          ) : null}

          {key === 'categories' ? (
            <Field error={err('categoryIds')}>
              <CategoryGrid
                value={v.categoryIds}
                onChange={(categoryIds) => set({ categoryIds })}
              />
            </Field>
          ) : null}

          {key === 'location' ? (
            <div className="flex flex-col gap-3">
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
            </div>
          ) : null}

          {key === 'address' ? (
            <div className="flex flex-col gap-3">
              <Field label={t('master.onboarding.address')}>
                <AddressInput
                  value={v.address}
                  placeholder={t('master.onboarding.addressPlaceholder')}
                  onChange={(address) => set({ address })}
                  onPick={(s) =>
                    set({
                      address: s.address || s.title,
                      ...(s.lat != null && s.lng != null
                        ? { latitude: s.lat, longitude: s.lng }
                        : {}),
                    })
                  }
                />
              </Field>
              <MapView
                height={320}
                center={
                  v.latitude !== null && v.longitude !== null
                    ? { lat: v.latitude, lng: v.longitude }
                    : city?.latitude && city.longitude
                      ? { lat: city.latitude, lng: city.longitude }
                      : null
                }
                zoom={13}
                picked={
                  v.latitude !== null && v.longitude !== null
                    ? { lat: v.latitude, lng: v.longitude }
                    : null
                }
                onPick={(p) => set({ latitude: p.lat, longitude: p.lng })}
              />
            </div>
          ) : null}

          {key === 'service' ? (
            <GlassCard className="flex flex-col gap-4">
              <div className="flex gap-3">
                <SinglePhotoUploader
                  value={v.serviceImage}
                  onChange={(serviceImage) => set({ serviceImage })}
                  kind="service"
                  size={84}
                />
                <Field
                  label={t('master.onboarding.serviceName')}
                  error={err('serviceName')}
                  className="flex-1"
                >
                  <GlassInput
                    value={v.serviceName}
                    placeholder={t('master.onboarding.servicePlaceholder')}
                    onChange={(e) => set({ serviceName: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('master.onboarding.price')} error={err('servicePrice')}>
                  <GlassInput
                    inputMode="decimal"
                    value={v.servicePrice}
                    placeholder="2500"
                    onChange={(e) => set({ servicePrice: e.target.value.replace(/[^\d.]/g, '') })}
                  />
                </Field>
                <Field label={t('master.onboarding.duration')} error={err('serviceDuration')}>
                  <GlassInput
                    inputMode="numeric"
                    value={v.serviceDuration}
                    onChange={(e) => set({ serviceDuration: e.target.value.replace(/\D/g, '') })}
                  />
                </Field>
              </div>
            </GlassCard>
          ) : null}

          {key === 'schedule' ? (
            <WeeklyScheduleEditor value={v.schedule} onChange={(schedule) => set({ schedule })} />
          ) : null}

          {key === 'appearance' ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <SinglePhotoUploader
                  value={v.avatarUrl}
                  onChange={(avatarUrl) => set({ avatarUrl })}
                  kind="avatar"
                  round
                  size={88}
                />
                <span className="text-[14px] text-muted-foreground">
                  {t('master.onboarding.avatar')}
                </span>
              </div>
              <ThemePresetPicker
                value={v.themePreset}
                onChange={(themePreset) => set({ themePreset })}
              />
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}
