import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppointmentStatus, SubStatus } from '@nail-crm/shared';
import { initials } from '@nail-crm/shared';
import { assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';

const GRADIENTS = [
  'from-pink-400 to-fuchsia-500',
  'from-violet-400 to-indigo-500',
  'from-amber-300 to-orange-500',
  'from-emerald-300 to-teal-500',
  'from-sky-300 to-blue-500',
  'from-rose-300 to-pink-500',
];

function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length]!;
}

export function UserAvatar({
  src,
  name,
  size = 48,
  className,
  ring,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const url = assetUrl(src);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full',
        ring && 'ring-2 ring-white/80 ring-offset-0 dark:ring-white/20',
        className,
      )}
      style={style}
    >
      {url ? (
        <img src={url} alt={name ?? ''} loading="lazy" className="size-full object-cover" />
      ) : (
        <div
          className={cn(
            'flex size-full items-center justify-center bg-gradient-to-br font-semibold text-white',
            gradientFor(name ?? '?'),
          )}
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
}

export function RatingStars({
  value,
  count,
  size = 14,
  className,
  onChange,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
  onChange?: (value: number) => void;
}) {
  const { t } = useTranslation();
  if (onChange) {
    return (
      <div
        className={cn('flex items-center gap-1.5', className)}
        role="radiogroup"
        aria-label={t('common.rating')}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={String(n)}
            onClick={() => onChange(n)}
            className="flex size-11 items-center justify-center rounded-full transition-transform active:scale-90"
          >
            <Star
              className={cn(
                'size-8',
                n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
              )}
            />
          </button>
        ))}
      </div>
    );
  }
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-[13px] font-medium', className)}
      aria-label={t('components.rating', { value })}
    >
      <Star className="fill-amber-400 text-amber-400" style={{ width: size, height: size }} />
      {value > 0 ? value.toFixed(1) : '—'}
      {count !== undefined ? (
        <span className="font-normal text-muted-foreground">({count})</span>
      ) : null}
    </span>
  );
}

export function OnlineBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400',
        className,
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      {t('components.onlineNow')}
    </span>
  );
}

export function PromoBadge({ pct, className }: { pct: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white shadow-sm',
        className,
      )}
    >
      −{pct}%
    </span>
  );
}

export function SalonBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300',
        className,
      )}
    >
      🏛 {t('components.salon')}
    </span>
  );
}

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  CONFIRMED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  COMPLETED: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  CANCELLED: 'bg-muted text-muted-foreground',
  NO_SHOW: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

export function StatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        STATUS_STYLE[status],
        className,
      )}
    >
      {t(`enums.appointmentStatus.${status}`)}
    </span>
  );
}

const SUB_STYLE: Record<SubStatus, string> = {
  TRIAL: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  CANCELLED: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  EXPIRED: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  BANNED: 'bg-foreground text-background',
};

export function SubStatusBadge({ status, className }: { status: SubStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        SUB_STYLE[status],
        className,
      )}
    >
      {t(`enums.subStatus.${status}`)}
    </span>
  );
}

export function CategoryTag({
  emoji,
  name,
  className,
}: {
  emoji?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium',
        className,
      )}
    >
      {emoji ? <span aria-hidden>{emoji}</span> : null}
      {name}
    </span>
  );
}
