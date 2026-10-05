import { Building2, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppointmentStatus, SubStatus } from '@nail-crm/shared';
import { initials } from '@nail-crm/shared';
import { MonoEmoji } from '@/components/brand/MonoEmoji';
import { assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';

const AVATAR_TONES = [
  'bg-neutral-900 text-neutral-100',
  'bg-neutral-800 text-neutral-100',
  'bg-neutral-700 text-neutral-100',
  'bg-neutral-600 text-neutral-100',
  'bg-neutral-500 text-neutral-950',
  'bg-neutral-400 text-neutral-950',
];

function toneFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
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
            'flex size-full items-center justify-center font-heading font-semibold',
            toneFor(name ?? '?'),
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
                n <= value ? 'fill-foreground text-foreground' : 'text-muted-foreground/40',
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
      <Star className="fill-foreground text-foreground" style={{ width: size, height: size }} />
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
        'inline-flex items-center gap-1.5 rounded-full border border-foreground/20 bg-muted px-2 py-0.5 text-[11px] font-semibold',
        className,
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground opacity-40" />
        <span className="relative inline-flex size-2 rounded-full bg-foreground" />
      </span>
      {t('components.onlineNow')}
    </span>
  );
}

export function PromoBadge({ pct, className }: { pct: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-[color:var(--brand-foreground)] shadow-sm',
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
        'inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold',
        className,
      )}
    >
      <Building2 className="size-3" /> {t('components.salon')}
    </span>
  );
}

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  PENDING: 'border border-border bg-muted',
  CONFIRMED: 'border border-foreground/25 bg-muted',
  COMPLETED: 'border border-foreground/40 bg-foreground/10',
  CANCELLED: 'bg-muted text-muted-foreground',
  NO_SHOW: 'border border-destructive/30 bg-destructive/10 text-destructive',
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
  TRIAL: 'border border-border bg-muted',
  ACTIVE: 'border border-foreground/25 bg-muted',
  CANCELLED: 'border border-border bg-muted text-muted-foreground',
  EXPIRED: 'border border-destructive/30 bg-destructive/10 text-destructive',
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
      {emoji ? <MonoEmoji>{emoji}</MonoEmoji> : null}
      {name}
    </span>
  );
}
