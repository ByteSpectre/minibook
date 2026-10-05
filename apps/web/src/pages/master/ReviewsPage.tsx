import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReviewMutations, useReviews, type CabinetBase } from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { EmptyState, ListSkeleton } from '@/components/layout/states';
import { RatingStars } from '@/components/domain/badges';
import { PhotoStrip } from '@/components/domain/media';
import { GlassButton, GlassCard, StatTile } from '@/components/ui/glass';
import { formatDate } from '@/lib/format';
import { confirmDialog } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export function ReviewsView({ base }: { base: CabinetBase }) {
  const { t } = useTranslation();
  const reviews = useReviews(base);
  const { toggle, remove } = useReviewMutations();
  const editable = base === '/api/master';
  const list = reviews.data ?? [];
  const published = list.filter((r) => r.isPublished);
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;
  if (reviews.isLoading) return <ListSkeleton />;
  if (!list.length)
    return (
      <EmptyState
        emoji="⭐️"
        title={t('master.reviews.empty')}
        text={t('master.reviews.emptyText')}
      />
    );
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label={t('master.reviews.average')}
          value={<RatingStars value={avg} size={20} className="text-[22px]" />}
        />
        <StatTile label={t('public.reviews')} value={published.length} />
      </div>
      <div className="flex flex-col gap-3">
        {list.map((r) => (
          <GlassCard
            key={r.id}
            className={cn('flex flex-col gap-2', !r.isPublished && 'opacity-60')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold">{r.clientName}</span>
              <RatingStars value={r.rating} />
            </div>
            {r.comment ? <p className="text-[14px]">{r.comment}</p> : null}
            <PhotoStrip photos={r.photos} />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">
                {formatDate(r.createdAt)} {!r.isPublished ? `· ${t('master.reviews.hidden')}` : ''}
              </span>
              {editable ? (
                <div className="flex gap-2">
                  <GlassButton
                    size="sm"
                    onClick={() => toggle.mutate({ id: r.id, isPublished: !r.isPublished })}
                  >
                    {r.isPublished ? <EyeOff /> : <Eye />}{' '}
                    {r.isPublished ? t('master.reviews.hide') : t('master.reviews.show')}
                  </GlassButton>
                  <GlassButton
                    size="icon-sm"
                    variant="destructive"
                    aria-label={t('common.delete')}
                    onClick={async () =>
                      (await confirmDialog(
                        t('master.reviews.deleteConfirm'),
                        t('common.delete'),
                        t('common.cancel'),
                      )) && remove.mutate(r.id)
                    }
                  >
                    <Trash2 />
                  </GlassButton>
                </div>
              ) : null}
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}

export default function MasterReviewsPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('master.reviews.title')} back>
      <ReviewsView base="/api/master" />
    </Page>
  );
}
