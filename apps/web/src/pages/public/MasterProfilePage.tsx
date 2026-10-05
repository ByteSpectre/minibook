import {
  Check,
  ChevronRight,
  Clock,
  FileText,
  Gift,
  Heart,
  MapPin,
  Megaphone,
  Send,
  Share2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PublicMasterDto, ReviewDto, ServiceDto } from '@nail-crm/shared';
import { usePublicPage, usePublicReviews } from '@/api/publicApi';
import { MonoEmoji } from '@/components/brand/MonoEmoji';
import { Page } from '@/components/layout/Page';
import { ErrorState, PageLoader } from '@/components/layout/states';
import { CategoryTag, OnlineBadge, RatingStars, UserAvatar } from '@/components/domain/badges';
import { LoyaltyProgressBar, loyaltyText } from '@/components/domain/loyalty';
import { categoryName } from '@/components/domain/MasterCard';
import { PhotoStrip } from '@/components/domain/media';
import { MapView, yandexMapsUrl } from '@/components/map/MapView';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GlassButton, GlassCard, GlassSheet, SectionTitle } from '@/components/ui/glass';
import { useMainButton } from '@/hooks/telegram';
import { promotionConditions } from '@/features/public/promo';
import { ThemedSurface } from '@/features/theme/ThemedSurface';
import { assetUrl } from '@/lib/assets';
import { formatDate, formatDuration, formatPrice } from '@/lib/format';
import { haptic, openExternal, openUsername, shareLink } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export function ReviewCard({ review }: { review: ReviewDto }) {
  return (
    <GlassCard className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold">{review.clientName}</span>
        <RatingStars value={review.rating} />
      </div>
      {review.comment ? <p className="text-[14px] leading-relaxed">{review.comment}</p> : null}
      <PhotoStrip photos={review.photos} size={84} />
      <span className="text-[12px] text-muted-foreground">{formatDate(review.createdAt)}</span>
    </GlassCard>
  );
}

function ServiceRow({
  service,
  currency,
  selected,
  onToggle,
}: {
  service: ServiceDto;
  currency: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const image = assetUrl(service.imageUrl);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        haptic.select();
        onToggle();
      }}
      className={cn(
        'flex w-full items-center gap-3 rounded-[var(--card-radius,1.5rem)] p-2.5 text-left transition-all active:scale-[0.99]',
        selected ? 'bg-accent ring-2 ring-primary' : 'hover:bg-muted',
      )}
    >
      <div className="size-[60px] shrink-0 overflow-hidden rounded-2xl bg-muted">
        {image ? (
          <img src={image} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-2xl text-muted-foreground">
            <MonoEmoji>✦</MonoEmoji>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[15px] font-medium">{service.name}</div>
        {service.description ? (
          <div className="line-clamp-1 text-[12px] text-muted-foreground">
            {service.description}
          </div>
        ) : null}
        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
          <Clock className="size-3.5" /> {formatDuration(service.duration)}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[15px] font-semibold">{formatPrice(service.price, currency)}</span>
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-full border-2',
            selected ? 'border-primary bg-primary text-white' : 'border-border',
          )}
        >
          {selected ? <Check className="size-3.5" /> : null}
        </span>
      </div>
    </button>
  );
}

function MasterContent({ master }: { master: PublicMasterDto }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const allReviews = usePublicReviews(master.slug, reviewsOpen);
  const services = useMemo(() => master.serviceGroups.flatMap((g) => g.services), [master]);
  const chosen = services.filter((s) => selected.includes(s.id));
  const duration = chosen.reduce((sum, s) => sum + s.duration, 0);

  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : master.allowMultiService
          ? [...cur, id]
          : [id],
    );

  const book = (ids = selected) => {
    const date = params.get('date');
    navigate(`/m/${master.slug}/book?services=${ids.join(',')}${date ? `&date=${date}` : ''}`);
  };

  useMainButton({
    text: chosen.length
      ? `${t('public.continue')} · ${formatPrice(
          chosen.reduce((s, x) => s + x.price, 0),
          master.currency,
        )}`
      : t('public.continue'),
    onClick: () => book(),
    visible: chosen.length > 0,
  });

  return (
    <Page
      back
      bottomInset="button"
      largeTitle={false}
      actions={
        <GlassButton
          size="icon"
          aria-label={t('public.share')}
          onClick={() => void shareLink(window.location.href.split('?')[0]!, master.name)}
        >
          <Share2 />
        </GlassButton>
      }
    >
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <UserAvatar
          src={master.avatarUrl}
          name={master.name}
          size={104}
          ring
          className="shadow-xl"
        />
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">{master.name}</h1>
          {master.salon ? (
            <Link to={`/s/${master.salon.slug}`} className="text-[14px] font-medium text-primary">
              {t('public.salonOf', { name: master.salon.name })}
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {master.isOnlineNow ? <OnlineBadge /> : null}
          {master.categories.map((c) => (
            <CategoryTag key={c.id} emoji={c.emoji} name={categoryName(c, i18n.language)} />
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setReviewsOpen(true)}
            className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium"
          >
            <RatingStars value={master.ratingAvg} size={16} /> ·{' '}
            {t('common.reviewsCount', { count: master.ratingCount })}
          </button>
          {master.rules ? (
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium"
            >
              <FileText className="size-4" /> {t('public.rules')}
            </button>
          ) : null}
          {master.username ? (
            <button
              type="button"
              onClick={() => openUsername(master.username!)}
              className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium"
            >
              <Send className="size-4" /> @{master.username}
            </button>
          ) : null}
          {master.channelUsername ? (
            <button
              type="button"
              onClick={() => openUsername(master.channelUsername!)}
              className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium"
            >
              <Megaphone className="size-4" /> {t('public.channel')}
            </button>
          ) : null}
        </div>
      </div>

      {master.promotions.length ? (
        <section>
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <Gift className="size-4" /> {t('public.promotions')}
            </span>
          </SectionTitle>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {master.promotions.map((p) => (
              <GlassCard
                key={p.id}
                className="flex w-[270px] shrink-0 snap-start flex-col gap-2 border border-foreground/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[15px] leading-snug font-semibold">{p.title}</span>
                  <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[13px] font-bold text-[color:var(--brand-foreground,#fff)]">
                    −{p.discountPct}%
                  </span>
                </div>
                {p.description ? (
                  <p className="line-clamp-2 text-[13px] text-muted-foreground">{p.description}</p>
                ) : null}
                <p className="text-[12px] text-muted-foreground">
                  {promotionConditions(t, p, master.timezone)}
                </p>
                <GlassButton
                  size="sm"
                  variant="primary"
                  className="mt-auto"
                  onClick={() => {
                    const ids = p.serviceId ? [p.serviceId] : selected;
                    if (ids.length) book(ids);
                    else
                      document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {t('public.bookWithDiscount')}
                </GlassButton>
              </GlassCard>
            ))}
          </div>
        </section>
      ) : null}

      {master.loyaltyRules.length ? (
        <GlassCard className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold">
            <Heart className="size-4" /> {t('public.loyalty')}
          </h2>
          {master.loyaltyProgress ? <LoyaltyProgressBar progress={master.loyaltyProgress} /> : null}
          <ul className="flex flex-col gap-1.5">
            {master.loyaltyRules.map((r) => (
              <li key={r.id} className="text-[14px] text-muted-foreground">
                • {loyaltyText(t, r)}
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

      <section id="services">
        <SectionTitle>{t('public.services')}</SectionTitle>
        <p className="-mt-1 mb-2 px-1 text-[12px] text-muted-foreground">
          {master.allowMultiService ? t('public.multiHint') : t('public.singleHint')}
        </p>
        {master.serviceGroups.length ? (
          <GlassCard className="p-1.5">
            <Accordion
              type="multiple"
              defaultValue={master.serviceGroups.map((g) => g.category?.id ?? 'other')}
            >
              {master.serviceGroups.map((g) => (
                <AccordionItem
                  key={g.category?.id ?? 'other'}
                  value={g.category?.id ?? 'other'}
                  className="border-b-0"
                >
                  <AccordionTrigger className="px-2.5 py-3 hover:no-underline">
                    <span className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-accent text-xl">
                        {g.category?.imageUrl ? (
                          <img
                            src={assetUrl(g.category.imageUrl)}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <MonoEmoji>{g.category?.emoji ?? '✦'}</MonoEmoji>
                        )}
                      </span>
                      <span className="text-[16px] font-semibold">
                        {g.category ? categoryName(g.category, i18n.language) : t('public.other')}
                      </span>
                      <span className="text-[13px] font-normal text-muted-foreground">
                        {g.services.length}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-1 pb-2">
                    {g.services.map((s) => (
                      <ServiceRow
                        key={s.id}
                        service={s}
                        currency={master.currency}
                        selected={selected.includes(s.id)}
                        onToggle={() => toggle(s.id)}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </GlassCard>
        ) : (
          <p className="px-1 text-[14px] text-muted-foreground">{t('public.noServices')}</p>
        )}
        {chosen.length ? (
          <p className="mt-2 px-1 text-[13px] text-muted-foreground">
            {t('public.selectedCount', {
              count: chosen.length,
              duration: formatDuration(duration),
            })}
          </p>
        ) : null}
      </section>

      {master.latitude !== null && master.longitude !== null ? (
        <section>
          <SectionTitle>{t('public.address')}</SectionTitle>
          <GlassCard className="flex flex-col gap-3 p-3">
            <div className="flex items-start gap-2 px-1 text-[14px]">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{master.address ?? `${master.cityName ?? ''}`}</span>
            </div>
            <MapView
              markers={[
                {
                  id: master.id,
                  lat: master.latitude,
                  lng: master.longitude,
                  title: master.name,
                  avatarUrl: master.avatarUrl,
                },
              ]}
              center={{ lat: master.latitude, lng: master.longitude }}
              zoom={15}
              height={200}
            />
            <GlassButton
              block
              onClick={() =>
                openExternal(yandexMapsUrl(master.latitude!, master.longitude!, master.name))
              }
            >
              {t('common.openInYandexMaps')}
            </GlassButton>
          </GlassCard>
        </section>
      ) : null}

      {master.reviews.length ? (
        <section>
          <SectionTitle
            action={
              <button
                type="button"
                onClick={() => setReviewsOpen(true)}
                className="flex items-center text-[14px] font-medium text-primary"
              >
                {t('public.allReviews')} <ChevronRight className="size-4" />
              </button>
            }
          >
            {t('public.reviews')}
          </SectionTitle>
          <div className="flex flex-col gap-3">
            {master.reviews.slice(0, 3).map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </section>
      ) : null}

      <GlassSheet open={rulesOpen} onOpenChange={setRulesOpen} title={t('public.rulesTitle')}>
        <p className="pb-4 text-[15px] leading-relaxed whitespace-pre-line">{master.rules}</p>
      </GlassSheet>
      <GlassSheet
        open={reviewsOpen}
        onOpenChange={setReviewsOpen}
        title={`${t('public.reviews')} · ${master.ratingAvg.toFixed(1)} ★`}
      >
        <div className="flex flex-col gap-3 pb-4">
          {(allReviews.data?.items ?? master.reviews).map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
          {!master.reviews.length ? (
            <p className="text-center text-[14px] text-muted-foreground">
              {t('components.noReviews')}
            </p>
          ) : null}
        </div>
      </GlassSheet>
    </Page>
  );
}

export default function MasterProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = usePublicPage(slug);

  useEffect(() => {
    if (!data || !slug) return;
    if (data.kind === 'blocked')
      navigate(`/m/${slug}/blocked`, { replace: true, state: data.screen });
    if (data.kind === 'expired') navigate(`/m/${slug}/expired`, { replace: true, state: data });
    if (data.kind === 'salon') navigate(`/s/${slug}`, { replace: true });
  }, [data, slug, navigate]);

  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    return (
      <Page back>
        <ErrorState onRetry={() => void refetch()} />
      </Page>
    );
  }
  if (data.kind !== 'master') return <PageLoader />;
  return (
    <ThemedSurface theme={data.master.theme}>
      <MasterContent master={data.master} />
    </ThemedSurface>
  );
}
