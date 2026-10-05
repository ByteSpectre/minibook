import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  CalendarCheck,
  Check,
  ChevronLeft,
  Copy,
  Eye,
  Gift,
  Globe,
  Link2,
  Loader2,
  Pencil,
  Send,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { MonoEmoji } from '@/components/brand/MonoEmoji';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  isValidSlug,
  isValidUsername,
  slugify,
  type MasterOnboardingInput,
  type ScheduleDayDto,
  type ThemePreset,
} from '@nail-crm/shared';
import {
  checkSlug,
  useCompleteOnboarding,
  useOnboardingDraft,
  usePatchMasterProfile,
  useSaveDraft,
} from '@/api/cabinetApi';
import { useCategories, useCities } from '@/api/common';
import { Page } from '@/components/layout/Page';
import { FullscreenSpinner } from '@/components/layout/states';
import { AddressInput } from '@/components/domain/AddressInput';
import { categoryName } from '@/components/domain/MasterCard';
import { CategoryGrid, CityPicker, CountryPicker } from '@/components/domain/pickers';
import { SinglePhotoUploader } from '@/components/domain/PhotoUploader';
import { MapView } from '@/components/map/MapView';
import {
  Chip,
  Field,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassTextarea,
} from '@/components/ui/glass';
import { AccordionSection } from '@/components/ui/master-ui';
import { Switch } from '@/components/ui/switch';
import { ThemePresetPicker } from '@/features/cabinet/ThemePresetPicker';
import {
  DEFAULT_WEEK,
  toWeeklyInput,
  WeeklyScheduleEditor,
} from '@/features/cabinet/WeeklyScheduleEditor';
import { copyText, haptic, shareLink } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { useMe } from '@/store/auth';

const BOT =
  (import.meta.env.VITE_BOT_USERNAME as string | undefined)?.replace(/^@/, '') ?? 'glow_beauty_bot';

type StepKey = 'categories' | 'profile' | 'service' | 'schedule' | 'rules' | 'ready';

const STEPS: StepKey[] = ['categories', 'profile', 'service', 'schedule', 'rules'];
const SKIPPABLE: StepKey[] = ['schedule', 'rules'];

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
  about: string;
  serviceName: string;
  servicePrice: string;
  serviceDuration: string;
  serviceImage: string | null;
  schedule: ScheduleDayDto[];
  avatarUrl: string | null;
  themePreset: ThemePreset;
  autoConfirm: boolean;
  allowMultiService: boolean;
}

export function MasterOnboarding({
  joinSalon,
  referrerMasterId,
}: {
  joinSalon?: { salonId: string; code: string } | null;
  referrerMasterId?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const draft = useOnboardingDraft('/api/master');
  const saveDraft = useSaveDraft('/api/master');
  const complete = useCompleteOnboarding<MasterOnboardingInput>('/api/master');
  const patchProfile = usePatchMasterProfile();
  const categories = useCategories();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'welcome' | 'steps' | 'ready'>('welcome');
  const [restored, setRestored] = useState(false);
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [linkMode, setLinkMode] = useState<'telegram' | 'site'>('telegram');
  const [showErrors, setShowErrors] = useState(false);
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
    about: '',
    serviceName: '',
    servicePrice: '',
    serviceDuration: '60',
    serviceImage: null,
    schedule: DEFAULT_WEEK,
    avatarUrl: me?.user.photoUrl ?? null,
    themePreset: 'liquid_glass',
    autoConfirm: false,
    allowMultiService: false,
  });
  const set = (patch: Partial<Values>) => setV((cur) => ({ ...cur, ...patch }));
  const cities = useCities(v.countryId);
  const city = cities.data?.find((c) => c.id === v.cityId);

  useEffect(() => {
    if (restored || !draft.data) return;
    setRestored(true);
    if (draft.data.data && Object.keys(draft.data.data).length) {
      setV((cur) => ({ ...cur, ...(draft.data!.data as Partial<Values>) }));
      const saved = Math.min(Math.max(0, draft.data.step - 1), STEPS.length - 1);
      setStep(saved);
      if (saved > 0 || Object.keys(draft.data.data).length > 2) setPhase('steps');
    }
  }, [draft.data, restored]);

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
        setSlugState((await checkSlug('/api/master', v.slug)) ? 'free' : 'taken');
      } catch {
        setSlugState('idle');
      }
    }, 400);
    return () => window.clearTimeout(slugTimer.current);
  }, [v.slug]);

  const key = phase === 'ready' ? ('ready' as const) : STEPS[step]!;
  const last = step === STEPS.length - 1;
  const done = phase === 'ready';

  const errors = useMemo(() => {
    const e: Partial<Record<string, string>> = {};
    if (key === 'categories' && v.categoryIds.length === 0)
      e.categoryIds = t('validation.categories');
    if (key === 'profile') {
      if (v.name.trim().length < 2) e.name = t('validation.tooShort', { min: 2 });
      if (!isValidSlug(v.slug)) e.slug = t('validation.slug');
      else if (slugState === 'taken') e.slug = t('master.onboarding.slugTaken');
      if (v.username && !isValidUsername(v.username)) e.username = t('validation.username');
      if (v.channelUsername && !isValidUsername(v.channelUsername))
        e.channelUsername = t('validation.username');
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

  const payload = (): MasterOnboardingInput => ({
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
  });

  const ctaLabel = () => {
    if (key === 'categories') return t('master.onboarding.nextProfile');
    if (key === 'profile') return t('master.onboarding.nextServices');
    if (key === 'service') return t('master.onboarding.nextSchedule');
    if (key === 'schedule') return t('master.onboarding.nextRules');
    return t('master.onboarding.finish');
  };

  const next = async () => {
    if (Object.keys(errors).length || (key === 'profile' && slugState === 'checking')) {
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
    try {
      await patchProfile.mutateAsync({
        autoConfirm: v.autoConfirm,
        allowMultiService: v.allowMultiService,
        rules: v.about.trim() || null,
      });
    } catch {
      /* profile exists; rules patch is best-effort */
    }
    haptic.notify('success');
    toast.success(t('master.onboarding.created'));
    setPhase('ready');
  };

  const skip = () => {
    if (last) void next();
    else setStep((s) => s + 1);
  };

  if (draft.isLoading) return <FullscreenSpinner />;
  const err = (name: string) => (showErrors ? errors[name] : undefined);

  const siteLink =
    typeof window !== 'undefined' ? `${window.location.origin}/m/${v.slug}` : `/m/${v.slug}`;
  const tgLink = `https://t.me/${BOT}?startapp=m_${v.slug}`;
  const activeLink = linkMode === 'telegram' ? tgLink : siteLink;

  const suggestedCats = (categories.data ?? [])
    .filter((c) => v.categoryIds.includes(c.id))
    .slice(0, 4);

  if (phase === 'welcome') {
    const benefits = [
      { icon: <Link2 className="size-5" />, text: t('master.onboarding.welcomeBenefit1') },
      { icon: <CalendarCheck className="size-5" />, text: t('master.onboarding.welcomeBenefit2') },
      { icon: <Sparkles className="size-5" />, text: t('master.onboarding.welcomeBenefit3') },
    ];
    return (
      <Page bottomInset="none" largeTitle={false} back={() => navigate(-1)}>
        <div className="flex flex-1 flex-col items-center gap-6 pt-8 pb-4 text-center">
          <BrandLogo size={80} className="rounded-lg" />
          <div>
            <h1 className="font-heading text-[28px] font-bold tracking-tight">
              {t('master.onboarding.welcomeTitle')}
            </h1>
            <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">
              {t('master.onboarding.welcomeHint')}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2.5">
            {benefits.map((b) => (
              <GlassCard key={b.text} className="flex items-center gap-3 p-3.5 text-left">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  {b.icon}
                </span>
                <span className="text-[15px] font-medium">{b.text}</span>
              </GlassCard>
            ))}
          </div>
          <div className="mt-auto flex w-full flex-col gap-2 pt-4">
            <GlassButton
              variant="primary"
              size="lg"
              block
              onClick={() => {
                haptic.impact('medium');
                setPhase('steps');
              }}
            >
              {t('master.onboarding.welcomeCta')}
            </GlassButton>
            <button
              type="button"
              className="py-2 text-[14px] font-medium text-muted-foreground"
              onClick={() => navigate(-1)}
            >
              {t('master.onboarding.welcomeBack')}
            </button>
          </div>
        </div>
      </Page>
    );
  }

  if (done) {
    return (
      <Page bottomInset="none" largeTitle={false} back={false}>
        <div className="flex flex-col items-center gap-5 pt-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-primary/15 text-primary">
            <Sparkles className="size-8" />
          </div>
          <div>
            <h1 className="text-[28px] font-bold tracking-tight">
              {t('master.onboarding.readyTitle')}
            </h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {t('master.onboarding.readyHint')}
            </p>
          </div>

          <div className="flex w-full rounded-2xl bg-muted/60 p-1">
            {(
              [
                ['telegram', t('master.onboarding.linkTelegram'), Send],
                ['site', t('master.onboarding.linkSite'), Globe],
              ] as const
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[14px] font-medium transition-all',
                  linkMode === mode ? 'bg-primary text-white shadow' : 'text-muted-foreground',
                )}
                onClick={() => setLinkMode(mode)}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>

          <GlassCard className="flex w-full items-center gap-2 p-3">
            <div className="min-w-0 flex-1 truncate font-mono text-[13px]">{activeLink}</div>
            <GlassButton
              size="icon-sm"
              aria-label={t('common.copy')}
              onClick={() =>
                void copyText(activeLink).then(() => toast.success(t('common.copied')))
              }
            >
              <Copy className="size-4" />
            </GlassButton>
          </GlassCard>

          <GlassButton
            variant="primary"
            size="lg"
            block
            onClick={() => void shareLink(activeLink, t('master.share.shareText'))}
          >
            <Share2 /> {t('master.onboarding.shareCta')}
          </GlassButton>

          <GlassButton size="lg" block onClick={() => navigate('/master', { replace: true })}>
            {t('master.onboarding.openApp')}
          </GlassButton>

          <div className="flex items-center gap-4 text-[14px] text-muted-foreground">
            <button
              type="button"
              className="flex items-center gap-1.5"
              onClick={() => navigate('/master/profile', { replace: true })}
            >
              <Pencil className="size-3.5" /> {t('master.onboarding.editProfile')}
            </button>
            <span className="text-border">|</span>
            <button
              type="button"
              className="flex items-center gap-1.5"
              onClick={() => navigate('/client', { replace: true })}
            >
              <Eye className="size-3.5" /> {t('master.onboarding.asClient')}
            </button>
          </div>
        </div>
      </Page>
    );
  }

  const titles: Record<Exclude<StepKey, 'ready'>, [string, string?]> = {
    categories: [t('master.onboarding.categoriesTitle'), t('master.onboarding.categoriesHint')],
    profile: [t('master.onboarding.profileTitle'), t('master.onboarding.profileHint')],
    service: [t('master.onboarding.serviceTitle'), t('master.onboarding.serviceHint')],
    schedule: [t('master.onboarding.scheduleTitle'), t('master.onboarding.scheduleHint')],
    rules: [t('master.onboarding.rulesTitle'), t('master.onboarding.rulesHint')],
  };

  return (
    <Page
      back={step > 0 ? () => setStep((s) => s - 1) : true}
      bottomInset="button"
      largeTitle={false}
      header={
        <header className="pt-safe bg-background/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 pt-3 pb-3">
            {step > 0 ? (
              <button
                type="button"
                aria-label={t('common.back')}
                className="glass flex size-10 shrink-0 items-center justify-center rounded-full"
                onClick={() => setStep((s) => s - 1)}
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : (
              <span className="size-10" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex gap-1" aria-hidden>
                {STEPS.map((s, i) => (
                  <span
                    key={s}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      i <= step ? 'bg-primary' : 'bg-muted',
                    )}
                  />
                ))}
              </div>
              <p className="text-center text-[12px] text-muted-foreground">
                {t('master.onboarding.stepOf', { step: step + 1, total: STEPS.length })}
              </p>
            </div>
            <span className="size-10" />
          </div>
        </header>
      }
    >
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
          className="flex flex-col gap-4 pt-1"
        >
          <div className="text-center">
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">
              {titles[key as Exclude<StepKey, 'ready'>][0]}
            </h1>
            {titles[key as Exclude<StepKey, 'ready'>][1] ? (
              <p className="mt-1.5 text-[14px] text-muted-foreground">
                {titles[key as Exclude<StepKey, 'ready'>][1]}
              </p>
            ) : null}
          </div>

          {key === 'categories' ? (
            <Field error={err('categoryIds')}>
              <CategoryGrid
                value={v.categoryIds}
                onChange={(categoryIds) => set({ categoryIds })}
              />
            </Field>
          ) : null}

          {key === 'profile' ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-2">
                <SinglePhotoUploader
                  value={v.avatarUrl}
                  onChange={(avatarUrl) => set({ avatarUrl })}
                  kind="avatar"
                  round
                  size={96}
                />
                <span className="text-[13px] text-muted-foreground">
                  {t('master.onboarding.avatar')}
                </span>
              </div>

              <section className="flex flex-col gap-3">
                <p className="px-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('master.onboarding.sectionMain')}
                </p>
                <Field label={t('master.onboarding.name')} error={err('name')}>
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
                      /m/
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
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('master.onboarding.username')} error={err('username')}>
                    <GlassInput
                      value={v.username}
                      placeholder="@username"
                      autoCapitalize="none"
                      onChange={(e) => set({ username: e.target.value })}
                    />
                  </Field>
                  <Field label={t('master.onboarding.channel')} error={err('channelUsername')}>
                    <GlassInput
                      value={v.channelUsername}
                      placeholder="@channel"
                      autoCapitalize="none"
                      onChange={(e) => set({ channelUsername: e.target.value })}
                    />
                  </Field>
                </div>
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
                <Field
                  label={t('master.onboarding.address')}
                  hint={t('master.onboarding.addressHint')}
                >
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
                  height={220}
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
              </section>

              <section className="flex flex-col gap-3">
                <p className="px-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('master.onboarding.sectionAbout')}
                </p>
                <GlassTextarea
                  value={v.about}
                  maxLength={3000}
                  placeholder={t('master.onboarding.aboutPlaceholder')}
                  onChange={(e) => set({ about: e.target.value })}
                />
              </section>

              <section className="flex flex-col gap-3">
                <p className="px-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('master.onboarding.sectionDesign')}
                </p>
                <p className="-mt-1 px-1 text-[12px] text-muted-foreground">
                  {t('master.onboarding.themeHint')}
                </p>
                <ThemePresetPicker
                  value={v.themePreset}
                  onChange={(themePreset) => set({ themePreset })}
                />
              </section>
            </div>
          ) : null}

          {key === 'service' ? (
            <div className="flex flex-col gap-4">
              {suggestedCats.length ? (
                <GlassCard className="flex flex-col gap-3">
                  <p className="text-[14px] text-muted-foreground">
                    {t('master.onboarding.serviceSuggest')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedCats.map((c) => (
                      <Chip
                        key={c.id}
                        active
                        onClick={() =>
                          set({
                            serviceName: v.serviceName || categoryName(c, i18n.language),
                          })
                        }
                      >
                        <MonoEmoji>{c.emoji}</MonoEmoji> {categoryName(c, i18n.language)}
                      </Chip>
                    ))}
                  </div>
                </GlassCard>
              ) : null}
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
              <p className="px-1 text-center text-[12px] text-muted-foreground">
                {t('master.onboarding.addServiceHint')}
              </p>
            </div>
          ) : null}

          {key === 'schedule' ? (
            <div className="flex flex-col gap-4">
              <GlassCard className="flex items-center gap-3 bg-primary/10 p-3.5">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                  <CalendarCheck className="size-5" />
                </span>
                <div>
                  <div className="text-[15px] font-semibold">
                    {t('master.onboarding.scheduleModeWeekly')}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {t('master.onboarding.scheduleModeHint')}
                  </div>
                </div>
              </GlassCard>
              <WeeklyScheduleEditor value={v.schedule} onChange={(schedule) => set({ schedule })} />
            </div>
          ) : null}

          {key === 'rules' ? (
            <div className="flex flex-col gap-3">
              <AccordionSection
                icon={<Check className="size-5" />}
                title={t('master.onboarding.rulesConfirm')}
                subtitle={t('master.onboarding.rulesConfirmHint')}
                defaultOpen
                accent
              >
                <label className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <span>
                    <span className="block text-[15px] font-medium">
                      {t('master.onboarding.autoConfirm')}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {t('master.onboarding.autoConfirmHint')}
                    </span>
                  </span>
                  <Switch
                    checked={v.autoConfirm}
                    onCheckedChange={(autoConfirm) => set({ autoConfirm })}
                  />
                </label>
              </AccordionSection>
              <AccordionSection
                icon={<CalendarCheck className="size-5" />}
                title={t('master.onboarding.rulesSlots')}
                subtitle={t('master.onboarding.rulesSlotsHint')}
                defaultOpen
              >
                <label className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <span>
                    <span className="block text-[15px] font-medium">
                      {t('master.onboarding.multiService')}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {t('master.onboarding.multiServiceHint')}
                    </span>
                  </span>
                  <Switch
                    checked={v.allowMultiService}
                    onCheckedChange={(allowMultiService) => set({ allowMultiService })}
                  />
                </label>
              </AccordionSection>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="mt-2 flex flex-col items-center gap-2 pb-2">
        <GlassButton
          variant="primary"
          size="lg"
          block
          loading={complete.isPending}
          onClick={() => void next()}
        >
          {ctaLabel()}
        </GlassButton>
        {SKIPPABLE.includes(key) ? (
          <button
            type="button"
            className="py-2 text-[14px] font-medium text-muted-foreground"
            onClick={skip}
          >
            {last ? t('master.onboarding.skip') : t('master.onboarding.fillLater')}
          </button>
        ) : null}
      </div>
    </Page>
  );
}
