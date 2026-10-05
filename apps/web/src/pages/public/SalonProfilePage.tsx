import { ChevronRight, MapPin, Megaphone, Send, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { PublicSalonDto } from '@nail-crm/shared';
import { usePublicPage } from '@/api/publicApi';
import { Page } from '@/components/layout/Page';
import { ErrorState, PageLoader } from '@/components/layout/states';
import {
  CategoryTag,
  OnlineBadge,
  RatingStars,
  SalonBadge,
  UserAvatar,
} from '@/components/domain/badges';
import { categoryName } from '@/components/domain/MasterCard';
import { MapView, yandexMapsUrl } from '@/components/map/MapView';
import { GlassButton, GlassCard, GlassSheet, SectionTitle } from '@/components/ui/glass';
import { useMainButton } from '@/hooks/telegram';
import { promotionConditions } from '@/features/public/promo';
import { ThemedSurface } from '@/features/theme/ThemedSurface';
import { formatDuration, formatPrice } from '@/lib/format';
import { openExternal, openUsername, shareLink } from '@/lib/telegram';
import { ReviewCard } from './MasterProfilePage';

function SalonContent({ salon }: { salon: PublicSalonDto }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [chooser, setChooser] = useState(false);
  useMainButton({
    text: t('components.book'),
    onClick: () => setChooser(true),
    visible: salon.masters.length > 0,
  });
  const servicesByMaster = useMemo(() => {
    const map = new Map<string, typeof salon.services>();
    for (const s of salon.services) map.set(s.masterId, [...(map.get(s.masterId) ?? []), s]);
    return map;
  }, [salon]);

  return (
    <Page
      back
      bottomInset="button"
      largeTitle={false}
      actions={
        <GlassButton
          size="icon"
          aria-label={t('public.share')}
          onClick={() => void shareLink(window.location.href.split('?')[0]!, salon.name)}
        >
          <Share2 />
        </GlassButton>
      }
    >
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <UserAvatar src={salon.avatarUrl} name={salon.name} size={104} ring className="shadow-xl" />
        <div className="flex flex-col items-center gap-1">
          <SalonBadge />
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">{salon.name}</h1>
          {salon.address ? (
            <p className="flex items-center gap-1 text-[14px] text-muted-foreground">
              <MapPin className="size-4" /> {salon.address}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {salon.isOnlineNow ? <OnlineBadge /> : null}
          {salon.categories.map((c) => (
            <CategoryTag key={c.id} emoji={c.emoji} name={categoryName(c, i18n.language)} />
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium">
            <RatingStars value={salon.ratingAvg} size={16} /> ·{' '}
            {t('common.reviewsCount', { count: salon.ratingCount })}
          </span>
          {salon.username ? (
            <button
              type="button"
              onClick={() => openUsername(salon.username!)}
              className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium"
            >
              <Send className="size-4" /> @{salon.username}
            </button>
          ) : null}
          {salon.channelUsername ? (
            <button
              type="button"
              onClick={() => openUsername(salon.channelUsername!)}
              className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium"
            >
              <Megaphone className="size-4" /> {t('public.channel')}
            </button>
          ) : null}
        </div>
      </div>

      {salon.promotions.length ? (
        <section>
          <SectionTitle>🎁 {t('public.promotions')}</SectionTitle>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
            {salon.promotions.map((p) => (
              <GlassCard key={p.id} className="flex w-[260px] shrink-0 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[15px] font-semibold">{p.title}</span>
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[13px] font-bold text-white">
                    −{p.discountPct}%
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {p.masterName} · {promotionConditions(t, p, salon.timezone)}
                </p>
                <GlassButton
                  size="sm"
                  variant="primary"
                  className="mt-auto"
                  onClick={() =>
                    navigate(
                      `/m/${p.masterSlug}${p.serviceId ? `/book?services=${p.serviceId}` : ''}`,
                    )
                  }
                >
                  {t('public.bookWithDiscount')}
                </GlassButton>
              </GlassCard>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle>{t('public.masters')}</SectionTitle>
        <div className="flex flex-col gap-3">
          {salon.masters.map((m) => (
            <Link key={m.id} to={`/m/${m.slug}`}>
              <GlassCard interactive className="flex items-center gap-3 p-3">
                <UserAvatar src={m.avatarUrl} name={m.name} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{m.name}</span>
                    {m.isOnlineNow ? <OnlineBadge /> : null}
                  </div>
                  <RatingStars value={m.ratingAvg} count={m.ratingCount} />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.categories.map((c) => (
                      <CategoryTag
                        key={c.id}
                        emoji={c.emoji}
                        name={categoryName(c, i18n.language)}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {m.priceFrom !== null ? (
                    <span className="text-[13px] font-semibold">
                      {t('components.priceFrom', {
                        price: formatPrice(m.priceFrom, salon.currency),
                      })}
                    </span>
                  ) : null}
                  <ChevronRight className="size-5 text-muted-foreground" />
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>{t('public.services')}</SectionTitle>
        <GlassCard className="flex flex-col divide-y divide-border p-0">
          {salon.masters.map((m) =>
            (servicesByMaster.get(m.id) ?? []).map((s) => (
              <Link
                key={s.id}
                to={`/m/${m.slug}/book?services=${s.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{s.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {m.name} · {formatDuration(s.duration)}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold">
                  {formatPrice(s.price, salon.currency)}
                </span>
              </Link>
            )),
          )}
        </GlassCard>
      </section>

      {salon.latitude !== null && salon.longitude !== null ? (
        <GlassCard className="flex flex-col gap-3 p-3">
          <MapView
            markers={[
              {
                id: salon.id,
                lat: salon.latitude,
                lng: salon.longitude,
                title: salon.name,
                avatarUrl: salon.avatarUrl,
                kind: 'salon',
              },
            ]}
            center={{ lat: salon.latitude, lng: salon.longitude }}
            zoom={15}
            height={200}
          />
          <GlassButton
            block
            onClick={() =>
              openExternal(yandexMapsUrl(salon.latitude!, salon.longitude!, salon.name))
            }
          >
            {t('common.openInYandexMaps')}
          </GlassButton>
        </GlassCard>
      ) : null}

      {salon.reviews.length ? (
        <section>
          <SectionTitle>{t('public.reviews')}</SectionTitle>
          <div className="flex flex-col gap-3">
            {salon.reviews.slice(0, 5).map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </section>
      ) : null}

      <GlassSheet open={chooser} onOpenChange={setChooser} title={t('public.chooseMaster')}>
        <div className="flex flex-col gap-2 pb-4">
          {salon.masters.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(`/m/${m.slug}`)}
              className="flex items-center gap-3 rounded-2xl p-2 text-left active:bg-muted"
            >
              <UserAvatar src={m.avatarUrl} name={m.name} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{m.name}</span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {m.categories.map((c) => categoryName(c, i18n.language)).join(', ')}
                </span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </GlassSheet>
    </Page>
  );
}

export default function SalonProfilePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = usePublicPage(slug);
  useEffect(() => {
    if (data?.kind === 'master' && slug) navigate(`/m/${slug}`, { replace: true });
    if (data?.kind === 'expired' && slug)
      navigate(`/m/${slug}/expired`, { replace: true, state: data });
  }, [data, slug, navigate]);
  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    return (
      <Page back>
        <ErrorState onRetry={() => void refetch()} />
      </Page>
    );
  }
  if (data.kind !== 'salon') return <PageLoader />;
  return (
    <ThemedSurface theme={data.salon.theme}>
      <SalonContent salon={data.salon} />
    </ThemedSurface>
  );
}
