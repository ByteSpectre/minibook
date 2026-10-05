import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  Repeat2,
  Search,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { ClientAppointmentDto } from '@nail-crm/shared';
import {
  useCancelAppointment,
  useConfirmVisit,
  useMyAppointments,
  useRepeatBooking,
  useRepeatPreview,
  useRescheduleAppointment,
  useReviewAppointment,
} from '@/api/clientApi';
import { Page } from '@/components/layout/Page';
import { ErrorState, ListSkeleton } from '@/components/layout/states';
import { ClientAppointmentCard } from '@/components/domain/appointments';
import { RatingStars } from '@/components/domain/badges';
import { BeforeAfterGallery, PhotoStrip } from '@/components/domain/media';
import { PhotoUploader } from '@/components/domain/PhotoUploader';
import { yandexMapsUrl } from '@/components/map/MapView';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Field, GlassButton, GlassCard, GlassSheet, GlassTextarea } from '@/components/ui/glass';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SlotPicker } from '@/features/booking/SlotPicker';
import { formatDateTime, formatIsoDay, formatPrice } from '@/lib/format';
import { download, haptic, openExternal } from '@/lib/telegram';

function RescheduleSheet({
  appointment,
  onClose,
}: {
  appointment: ClientAppointmentDto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const reschedule = useRescheduleAppointment();
  useEffect(() => {
    setDay(null);
    setSlot(null);
  }, [appointment?.id]);
  if (!appointment) return null;
  return (
    <GlassSheet
      open={!!appointment}
      onOpenChange={(o) => !o && onClose()}
      title={t('client.calendar.rescheduleTitle')}
      description={`${appointment.master.name} · ${appointment.services.map((s) => s.name).join(', ')}`}
      footer={
        <GlassButton
          variant="primary"
          size="lg"
          block
          disabled={!slot}
          loading={reschedule.isPending}
          onClick={async () => {
            if (!slot) return;
            await reschedule.mutateAsync({ id: appointment.id, startAt: slot });
            haptic.notify('success');
            toast.success(t('client.calendar.rescheduled'));
            onClose();
          }}
        >
          {slot
            ? t('client.calendar.rescheduleConfirm', {
                date: formatDateTime(slot, appointment.timezone),
              })
            : t('public.booking.pickTime')}
        </GlassButton>
      }
    >
      <SlotPicker
        slug={appointment.master.slug}
        serviceIds={appointment.services.map((s) => s.serviceId)}
        timezone={appointment.timezone}
        day={day}
        onDayChange={(d) => (setDay(d), setSlot(null))}
        value={slot}
        onChange={setSlot}
      />
    </GlassSheet>
  );
}

function RepeatSheet({
  appointment,
  onClose,
}: {
  appointment: ClientAppointmentDto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const preview = useRepeatPreview(appointment?.id ?? null);
  const repeat = useRepeatBooking();
  if (!appointment) return null;
  const p = preview.data;
  return (
    <GlassSheet
      open={!!appointment}
      onOpenChange={(o) => !o && onClose()}
      title={t('client.calendar.repeatTitle')}
      description={t('client.calendar.repeatText')}
      footer={
        <div className="flex flex-col gap-2">
          <GlassButton
            variant="primary"
            size="lg"
            block
            disabled={!p?.slot}
            loading={repeat.isPending}
            onClick={async () => {
              const res = await repeat.mutateAsync({
                id: appointment.id,
                startAt: p?.slot?.startAt,
              });
              const booking = res as { appointment: { id: string } };
              haptic.notify('success');
              onClose();
              navigate(`/booking/${booking.appointment.id}/success`);
            }}
          >
            {t('client.calendar.repeatBook')}
          </GlassButton>
          <GlassButton
            block
            onClick={() => {
              onClose();
              navigate(
                `/m/${appointment.master.slug}/book?services=${appointment.services.map((s) => s.serviceId).join(',')}`,
              );
            }}
          >
            {t('client.calendar.repeatOtherTime')}
          </GlassButton>
        </div>
      }
    >
      <GlassCard className="flex flex-col gap-2">
        <div className="text-[13px] text-muted-foreground">{t('client.calendar.repeatSlot')}</div>
        {preview.isLoading ? (
          <div className="h-7 w-2/3 animate-pulse rounded-full bg-muted" />
        ) : p?.slot ? (
          <div className="text-[20px] font-semibold capitalize">
            {formatIsoDay(p.slot.date, 'd MMMM, EEEE')} · {p.slot.time}
            {p.slot.discountPct ? (
              <span className="ml-2 text-[14px] text-primary">−{p.slot.discountPct}%</span>
            ) : null}
          </div>
        ) : (
          <div className="text-[15px]">{t('client.calendar.repeatNone')}</div>
        )}
        <div className="text-[14px] text-muted-foreground">
          {appointment.master.name} ·{' '}
          {(p?.services ?? appointment.services).map((s) => s.name).join(', ')}
        </div>
      </GlassCard>
    </GlassSheet>
  );
}

function ReviewSheet({
  appointment,
  onClose,
}: {
  appointment: ClientAppointmentDto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const review = useReviewAppointment();
  if (!appointment) return null;
  return (
    <GlassSheet
      open={!!appointment}
      onOpenChange={(o) => !o && onClose()}
      title={t('client.calendar.reviewTitle')}
      description={appointment.master.name}
      footer={
        <GlassButton
          variant="primary"
          size="lg"
          block
          loading={review.isPending}
          onClick={async () => {
            await review.mutateAsync({
              id: appointment.id,
              input: { rating, comment: comment.trim() || undefined, photos },
            });
            haptic.notify('success');
            toast.success(t('client.calendar.reviewThanks'));
            onClose();
          }}
        >
          {t('client.calendar.reviewSend')}
        </GlassButton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <RatingStars value={rating} onChange={setRating} />
        </div>
        <Field label={t('client.calendar.comment')}>
          <GlassTextarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            placeholder={t('client.calendar.reviewPlaceholder')}
          />
        </Field>
        <Field label={t('client.calendar.reviewPhotos')}>
          <PhotoUploader value={photos} onChange={setPhotos} max={3} kind="review" />
        </Field>
      </div>
    </GlassSheet>
  );
}

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useMyAppointments();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rescheduleId, setRescheduleId] = useState<string | null>(params.get('reschedule'));
  const [repeatId, setRepeatId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(params.get('review'));
  const [cancelId, setCancelId] = useState<string | null>(null);
  const highlight = params.get('appointment');
  const cancel = useCancelAppointment();
  const confirm = useConfirmVisit();

  const all = useMemo(() => [...(data?.upcoming ?? []), ...(data?.past ?? [])], [data]);
  const find = (id: string | null) => all.find((a) => a.id === id) ?? null;

  const monthLabel = useMemo(
    () =>
      cursor.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'ru-RU', {
        month: 'long',
        year: 'numeric',
      }),
    [cursor, i18n.language],
  );

  useEffect(() => {
    if (!data) return;
    const target = highlight ?? params.get('review');
    if (target && data.past.some((a) => a.id === target)) setTab('past');
    if (highlight) {
      window.setTimeout(
        () =>
          document
            .getElementById(`appointment-${highlight}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        200,
      );
    }
  }, [data, highlight, params]);

  const clearParams = () => setParams({}, { replace: true });
  const list = tab === 'upcoming' ? (data?.upcoming ?? []) : (data?.past ?? []);
  const shiftMonth = (dir: -1 | 1) =>
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));

  return (
    <Page
      title={
        <div className="flex w-full items-center justify-center gap-3">
          <button
            type="button"
            aria-label="prev"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-[10rem] text-center capitalize">{monthLabel}</span>
          <button
            type="button"
            aria-label="next"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      }
      largeTitle={false}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex items-center justify-between px-1">
          <TabsList className="h-auto gap-4 bg-transparent p-0">
            <TabsTrigger
              value="upcoming"
              className="rounded-none border-0 bg-transparent px-0 text-[13px] font-semibold uppercase tracking-wide shadow-none data-active:bg-transparent data-active:text-foreground data-active:shadow-none"
            >
              {t('client.calendar.list')}
              {data?.upcoming.length ? ` · ${data.upcoming.length}` : ''}
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="rounded-none border-0 bg-transparent px-0 text-[13px] font-semibold uppercase tracking-wide shadow-none data-active:bg-transparent data-active:text-foreground data-active:shadow-none"
            >
              {t('client.calendar.past')}
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {isLoading && !data ? (
        <ListSkeleton count={3} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-[16px] text-muted-foreground">
            {tab === 'upcoming'
              ? t('client.calendar.emptyUpcoming')
              : t('client.calendar.emptyPast')}
          </p>
          {tab === 'upcoming' ? (
            <>
              <p className="max-w-xs text-[13px] text-muted-foreground">
                {t('client.calendar.emptyHint')}
              </p>
              <GlassButton
                variant="primary"
                className="rounded-full px-6"
                onClick={() => navigate('/client/search')}
              >
                <Search className="size-4" /> {t('client.calendar.find')}
              </GlassButton>
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((a) => (
            <ClientAppointmentCard
              key={a.id}
              appointment={a}
              highlight={a.id === highlight}
              actions={
                tab === 'upcoming' ? (
                  <>
                    {!a.clientConfirmedAt ? (
                      <GlassButton
                        size="sm"
                        variant="soft"
                        loading={confirm.isPending && confirm.variables === a.id}
                        onClick={() =>
                          confirm.mutate(a.id, {
                            onSuccess: () => toast.success(t('client.calendar.visitConfirmed')),
                          })
                        }
                      >
                        <Check /> {t('client.calendar.confirmVisit')}
                      </GlassButton>
                    ) : (
                      <span className="flex h-9 items-center gap-1 rounded-xl px-2 text-[13px] font-medium text-emerald-600">
                        <Check className="size-4" /> {t('client.calendar.visitConfirmed')}
                      </span>
                    )}
                    {a.canReschedule ? (
                      <GlassButton size="sm" onClick={() => setRescheduleId(a.id)}>
                        <RefreshCw /> {t('client.calendar.reschedule')}
                      </GlassButton>
                    ) : null}
                    {a.canCancel ? (
                      <GlassButton
                        size="sm"
                        variant="destructive"
                        onClick={() => setCancelId(a.id)}
                      >
                        <X /> {t('client.calendar.cancel')}
                      </GlassButton>
                    ) : null}
                    <GlassButton
                      size="icon-sm"
                      aria-label={t('client.calendar.addToCalendar')}
                      onClick={() => void download(a.icsUrl, `glow-${a.id}.ics`)}
                    >
                      <CalendarPlus />
                    </GlassButton>
                    {a.master.latitude !== null && a.master.longitude !== null ? (
                      <GlassButton
                        size="icon-sm"
                        aria-label={t('client.calendar.route')}
                        onClick={() =>
                          openExternal(
                            yandexMapsUrl(
                              a.master.latitude!,
                              a.master.longitude!,
                              a.master.address ?? undefined,
                            ),
                          )
                        }
                      >
                        <MapPin />
                      </GlassButton>
                    ) : null}
                  </>
                ) : (
                  <>
                    <GlassButton size="sm" variant="soft" onClick={() => setRepeatId(a.id)}>
                      <Repeat2 /> {t('client.calendar.repeat')}
                    </GlassButton>
                    {a.canReview ? (
                      <GlassButton size="sm" onClick={() => setReviewId(a.id)}>
                        <Star /> {t('client.calendar.review')}
                      </GlassButton>
                    ) : a.review ? (
                      <span className="flex h-9 items-center gap-1 px-1 text-[13px] text-muted-foreground">
                        <Star className="size-4 fill-foreground text-foreground" />{' '}
                        {a.review.rating} · {t('client.calendar.reviewed')}
                      </span>
                    ) : null}
                  </>
                )
              }
            >
              {a.comment ? (
                <p className="rounded-2xl bg-muted px-3 py-2 text-[13px]">💬 {a.comment}</p>
              ) : null}
              {a.beforePhotoUrl && a.afterPhotoUrl ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted-foreground">
                    {t('client.calendar.beforeAfter')}
                  </span>
                  <BeforeAfterGallery before={a.beforePhotoUrl} after={a.afterPhotoUrl} />
                </div>
              ) : a.afterPhotoUrl ? (
                <PhotoStrip photos={[a.afterPhotoUrl]} size={120} />
              ) : null}
              {a.originalPrice && a.price !== null && a.originalPrice > a.price ? (
                <div className="text-[12px] text-muted-foreground">
                  {t('client.calendar.total')}: <s>{formatPrice(a.originalPrice, a.currency)}</s> →{' '}
                  {formatPrice(a.price, a.currency)}
                </div>
              ) : null}
            </ClientAppointmentCard>
          ))}
        </div>
      )}

      <RescheduleSheet
        appointment={find(rescheduleId)}
        onClose={() => (setRescheduleId(null), clearParams())}
      />
      <RepeatSheet appointment={find(repeatId)} onClose={() => setRepeatId(null)} />
      <ReviewSheet
        appointment={find(reviewId)}
        onClose={() => (setReviewId(null), clearParams())}
      />

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent className="glass-strong rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('client.calendar.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('client.calendar.cancelText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-2xl">{t('common.no')}</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-2xl bg-destructive text-white"
              onClick={() =>
                cancelId &&
                cancel.mutate(cancelId, {
                  onSuccess: () => {
                    haptic.notify('success');
                    toast.success(t('client.calendar.cancelled'));
                  },
                })
              }
            >
              {t('client.calendar.cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
