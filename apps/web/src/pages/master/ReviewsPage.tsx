import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useMasterProfile,
  useReviewMutations,
  useReviews,
  useSalonProfile,
  type CabinetBase,
} from '@/api/cabinetApi';
import { Page } from '@/components/layout/Page';
import { ListSkeleton } from '@/components/layout/states';
import { RatingStars, UserAvatar } from '@/components/domain/badges';
import { PhotoStrip } from '@/components/domain/media';
import { GlassButton, GlassCard } from '@/components/ui/glass';
import { RatingSummaryCard } from '@/components/ui/master-ui';
import { formatDate } from '@/lib/format';
import { confirmDialog } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export function ReviewsView({ base }: { base: CabinetBase }) {
  const { t } = useTranslation();
  const masterProfile = useMasterProfile();
  const salonProfile = useSalonProfile();
  const profile = base === '/api/master' ? masterProfile : salonProfile;
  const reviews = useReviews(base);
  const { toggle, remove } = useReviewMutations();
  const editable = base === '/api/master';
  const list = reviews.data ?? [];
  const published = list.filter((r) => r.isPublished);
  const computedAvg = published.length
    ? published.reduce((s, r) => s + r.rating, 0) / published.length
    : 0;
  const avg =
    base === '/api/master' && masterProfile.data?.ratingAvg != null
      ? masterProfile.data.ratingAvg
      : computedAvg;
  const count =
    base === '/api/master' && masterProfile.data?.ratingCount != null
      ? masterProfile.data.ratingCount
      : published.length;

  if (reviews.isLoading) return <ListSkeleton />;

  return (
    <>
      <GlassCard className="flex items-center gap-3 p-3">
        <UserAvatar src={profile.data?.avatarUrl} name={profile.data?.name ?? ''} size={48} ring />
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold">{profile.data?.name ?? '—'}</div>
          <div className="text-[13px] text-muted-foreground">{t('master.reviews.subtitle')}</div>
        </div>
      </GlassCard>

      <RatingSummaryCard avg={avg} count={count} />
      <div className="flex justify-center">
        <RatingStars value={avg} size={22} />
      </div>
      {count > 0 ? (
        <p className="-mt-2 text-center text-[13px] text-muted-foreground">
          {t('master.reviews.count', { count })}
        </p>
      ) : null}

      {!list.length ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-[16px] font-medium">{t('master.reviews.empty')}</p>
          <p className="max-w-xs text-[14px] text-muted-foreground">
            {t('master.reviews.emptyText')}
          </p>
        </div>
      ) : (
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
                  {formatDate(r.createdAt)}{' '}
                  {!r.isPublished ? `· ${t('master.reviews.hidden')}` : ''}
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
      )}
    </>
  );
}

export default function MasterReviewsPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('master.reviews.title')} back bottomInset="none">
      <ReviewsView base="/api/master" />
    </Page>
  );
}
