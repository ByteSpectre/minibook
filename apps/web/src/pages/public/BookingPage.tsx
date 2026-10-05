import { CalendarDays, Clock, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { defaultCountryForLocale, normalizeUsername } from '@nail-crm/shared';
import { ApiError } from '@/api/client';
import { toastError } from '@/api/queryClient';
import { useCheckAccess, useCreateBooking, usePublicPage, useQuote } from '@/api/publicApi';
import { Page } from '@/components/layout/Page';
import { PageLoader } from '@/components/layout/states';
import { UserAvatar } from '@/components/domain/badges';
import { PhotoUploader } from '@/components/domain/PhotoUploader';
import { PhoneInput } from '@/components/domain/pickers';
import { Field, GlassCard, GlassInput, GlassTextarea } from '@/components/ui/glass';
import { clientReferralFor } from '@/app/startParam';
import { SlotPicker } from '@/features/booking/SlotPicker';
import { ThemedSurface } from '@/features/theme/ThemedSurface';
import { useMainButton } from '@/hooks/telegram';
import { formatDateTime, formatDuration, formatPrice } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { useMe } from '@/store/auth';

export default function BookingPage() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const me = useMe();
  const page = usePublicPage(slug);
  const access = useCheckAccess(slug);
  const create = useCreateBooking(slug);
  const serviceIds = useMemo(
    () => (params.get('services') ?? '').split(',').filter(Boolean),
    [params],
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [day, setDay] = useState<string | null>(params.get('date'));
  const [slot, setSlot] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [contact, setContact] = useState<{
    firstName: string;
    phone: string;
    phoneCountry: string;
    username: string;
  }>({
    firstName: '',
    phone: '',
    phoneCountry: defaultCountryForLocale(me?.user.languageCode),
    username: '',
  });
  const referrerClientId = slug ? (clientReferralFor(slug) ?? undefined) : undefined;
  const quote = useQuote(
    slug,
    serviceIds.length ? { serviceIds, startAt: slot ?? undefined, referrerClientId } : null,
  );

  useEffect(() => {
    const c = access.data?.contact;
    if (!c) return;
    setContact((cur) => ({
      firstName: cur.firstName || c.firstName || '',
      phone: cur.phone || c.phone || '',
      phoneCountry: c.phoneCountry ?? cur.phoneCountry,
      username: cur.username || (c.username ? `@${c.username}` : ''),
    }));
  }, [access.data]);

  useEffect(() => {
    if (access.data?.reason === 'blocked' && slug)
      navigate(`/m/${slug}/blocked`, { replace: true, state: access.data.screen });
    if (access.data?.reason === 'expired' && slug)
      navigate(`/m/${slug}/expired`, { replace: true });
  }, [access.data, slug, navigate]);

  const master = page.data?.kind === 'master' ? page.data.master : null;
  const services = useMemo(
    () =>
      master
        ? master.serviceGroups.flatMap((g) => g.services).filter((s) => serviceIds.includes(s.id))
        : [],
    [master, serviceIds],
  );

  const submit = useCallback(async () => {
    if (!slot || !slug) return;
    if (!contact.firstName.trim() || contact.phone.replace(/\D/g, '').length < 6) {
      haptic.notify('error');
      toast.error(t('validation.phone'));
      return;
    }
    try {
      const res = await create.mutateAsync({
        serviceIds,
        startAt: slot,
        comment: comment.trim() || undefined,
        photos,
        contact: {
          firstName: contact.firstName.trim(),
          phone: contact.phone,
          phoneCountry: contact.phoneCountry,
          username: normalizeUsername(contact.username) ?? undefined,
        },
        referrerClientId,
      });
      haptic.notify('success');
      navigate(`/booking/${res.appointment.id}/success`, { replace: true, state: res });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'slotTaken') {
        toast.error(t('public.booking.slotTaken'));
        setSlot(null);
        setStep(1);
        return;
      }
      if (err instanceof ApiError && err.code === 'blocked') {
        navigate(`/m/${slug}/blocked`, { replace: true });
        return;
      }
      toastError(err);
    }
  }, [slot, slug, contact, comment, photos, serviceIds, referrerClientId, create, navigate, t]);

  useMainButton({
    text:
      step === 1
        ? t('public.booking.next')
        : `${t('public.booking.submit')}${quote.data ? ` · ${formatPrice(quote.data.finalPrice, quote.data.currency)}` : ''}`,
    enabled: step === 1 ? !!slot : true,
    loading: create.isPending,
    onClick: () => (step === 1 ? slot && setStep(2) : void submit()),
  });

  if (!serviceIds.length && slug) return <Navigate to={`/m/${slug}`} replace />;
  if (page.isLoading || !master) return <PageLoader />;

  const duration = services.reduce((sum, s) => sum + s.duration, 0);
  const discount = quote.data?.discountSource;

  return (
    <ThemedSurface theme={master.theme}>
      <Page
        back={step === 2 ? () => setStep(1) : true}
        bottomInset="button"
        largeTitle={false}
        title={t('public.booking.title')}
        subtitle={step === 1 ? t('public.booking.step1') : t('public.booking.step2')}
      >
        <GlassCard className="flex items-center gap-3 p-3">
          <UserAvatar src={master.avatarUrl} name={master.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{master.name}</div>
            <div className="truncate text-[13px] text-muted-foreground">
              {services.map((s) => s.name).join(' + ')}
            </div>
          </div>
          <div className="shrink-0 text-right text-[13px] text-muted-foreground">
            <Clock className="mr-1 inline size-3.5" />
            {formatDuration(duration)}
          </div>
        </GlassCard>

        {step === 1 ? (
          <SlotPicker
            slug={master.slug}
            serviceIds={serviceIds}
            timezone={master.timezone}
            day={day}
            onDayChange={(d) => (setDay(d), setSlot(null))}
            value={slot}
            onChange={setSlot}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <GlassCard className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[15px] font-semibold capitalize">
                <CalendarDays className="size-4 text-primary" />{' '}
                {slot ? formatDateTime(slot, master.timezone) : ''}
              </div>
              {services.map((s) => (
                <div key={s.id} className="flex justify-between text-[14px]">
                  <span className="text-muted-foreground">{s.name}</span>
                  <span>{formatPrice(s.price, master.currency)}</span>
                </div>
              ))}
              {quote.data?.discountPct ? (
                <div className="flex justify-between text-[14px] font-medium text-primary">
                  <span className="flex items-center gap-1">
                    <Sparkles className="size-4" />
                    {discount?.source === 'promotion'
                      ? discount.title
                      : discount?.loyaltyType
                        ? t(`public.booking.discountLoyalty.${discount.loyaltyType}`)
                        : t('public.booking.discount')}
                  </span>
                  <span>−{quote.data.discountPct}%</span>
                </div>
              ) : null}
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-[16px] font-semibold">
                <span>{t('public.booking.summary')}</span>
                <span>
                  {quote.data && quote.data.discountPct ? (
                    <s className="mr-2 text-[13px] font-normal text-muted-foreground">
                      {formatPrice(quote.data.totalPrice, master.currency)}
                    </s>
                  ) : null}
                  {formatPrice(
                    quote.data?.finalPrice ?? services.reduce((s, x) => s + x.price, 0),
                    master.currency,
                  )}
                </span>
              </div>
            </GlassCard>

            <Field label={t('public.booking.comment')}>
              <GlassTextarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                placeholder={t('public.booking.commentPlaceholder')}
              />
            </Field>
            <Field label={t('public.booking.references')} hint={t('public.booking.referencesHint')}>
              <PhotoUploader value={photos} onChange={setPhotos} max={5} kind="reference" />
            </Field>

            <GlassCard className="flex flex-col gap-3">
              <div>
                <h3 className="text-[16px] font-semibold">{t('public.booking.contacts')}</h3>
                <p className="text-[12px] text-muted-foreground">
                  {t('public.booking.contactsHint')}
                </p>
              </div>
              <Field label={t('client.profile.firstName')}>
                <GlassInput
                  value={contact.firstName}
                  onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))}
                  autoComplete="given-name"
                />
              </Field>
              <Field label={t('client.profile.phone')}>
                <PhoneInput
                  value={contact.phone}
                  country={contact.phoneCountry}
                  onChange={(phone) => setContact((c) => ({ ...c, phone }))}
                  onCountryChange={(phoneCountry) => setContact((c) => ({ ...c, phoneCountry }))}
                />
              </Field>
              <Field label={t('client.profile.username')}>
                <GlassInput
                  value={contact.username}
                  onChange={(e) => setContact((c) => ({ ...c, username: e.target.value }))}
                  placeholder="@username"
                  autoCapitalize="none"
                />
              </Field>
            </GlassCard>
          </div>
        )}
      </Page>
    </ThemedSurface>
  );
}
