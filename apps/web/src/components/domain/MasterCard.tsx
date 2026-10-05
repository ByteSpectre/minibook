import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { CategoryDto, SearchCardDto } from '@nail-crm/shared';
import { GlassCard } from '@/components/ui/glass';
import { formatPrice } from '@/lib/format';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import {
  CategoryTag,
  OnlineBadge,
  PromoBadge,
  RatingStars,
  SalonBadge,
  UserAvatar,
} from './badges';

export function categoryName(c: Pick<CategoryDto, 'name' | 'nameEn'>, lang: string): string {
  return lang === 'en' && c.nameEn ? c.nameEn : c.name;
}

export function tenantPath(type: 'master' | 'salon', slug: string): string {
  return type === 'salon' ? `/s/${slug}` : `/m/${slug}`;
}

export function MasterCard({ item, className }: { item: SearchCardDto; className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <Link
      to={tenantPath(item.type, item.slug)}
      onClick={() => haptic.impact('light')}
      className="block"
    >
      <GlassCard interactive className={cn('flex gap-3 p-3', className)}>
        <div className="relative">
          <UserAvatar src={item.avatarUrl} name={item.name} size={68} className="rounded-[22px]" />
          {item.maxDiscountPct ? (
            <PromoBadge pct={item.maxDiscountPct} className="absolute -right-1.5 -bottom-1.5" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-[16px] font-semibold">{item.name}</h3>
            <RatingStars value={item.ratingAvg} count={item.ratingCount} className="shrink-0" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {item.isOnlineNow ? <OnlineBadge /> : null}
            {item.type === 'salon' ? <SalonBadge /> : null}
            {item.categories.slice(0, 3).map((c) => (
              <CategoryTag key={c.id} emoji={c.emoji} name={categoryName(c, i18n.language)} />
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[12px] text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1 truncate">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {item.countryFlag} {item.cityName}
                {item.distanceKm !== null
                  ? ` · ${t('components.km', { value: item.distanceKm })}`
                  : ''}
                {item.mastersCount
                  ? ` · ${t('components.mastersInSalon', { count: item.mastersCount })}`
                  : ''}
              </span>
            </span>
            {item.priceFrom !== null ? (
              <span className="shrink-0 font-semibold text-foreground">
                {t('components.priceFrom', { price: formatPrice(item.priceFrom, item.currency) })}
              </span>
            ) : null}
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}
