import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientAppointmentDto } from '@nail-crm/shared';
import { GlassCard } from '@/components/ui/glass';
import {
  formatDayLabel,
  formatDuration,
  formatPrice,
  formatShortDayLabel,
  formatTime,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { StatusBadge, UserAvatar } from './badges';

export function ClientAppointmentCard({
  appointment: a,
  compact,
  onClick,
  actions,
  highlight,
  children,
}: {
  appointment: ClientAppointmentDto;
  compact?: boolean;
  onClick?: () => void;
  actions?: ReactNode;
  highlight?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const duration = Math.round(
    (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000,
  );
  return (
    <GlassCard
      interactive={!!onClick}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-3',
        onClick && 'cursor-pointer',
        highlight && 'ring-2 ring-primary',
      )}
      id={`appointment-${a.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-accent py-1.5 text-accent-foreground">
          <span className="max-w-full truncate px-1 text-[11px] font-semibold">
            {formatShortDayLabel(a.startAt, a.timezone)}
          </span>
          <span className="text-[18px] font-bold tabular-nums">
            {formatTime(a.startAt, a.timezone)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <UserAvatar src={a.master.avatarUrl} name={a.master.name} size={22} />
            <span className="truncate text-[15px] font-semibold">{a.master.name}</span>
          </div>
          <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {a.services.map((s) => s.name).join(' + ')}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status} />
            {!compact ? (
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <Clock className="size-3.5" /> {formatDuration(duration)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-semibold">{formatPrice(a.price, a.currency)}</div>
          {a.discountPct ? (
            <div className="text-[12px] font-medium text-primary">
              {t('client.calendar.discount', { pct: a.discountPct })}
            </div>
          ) : null}
        </div>
      </div>
      {!compact ? (
        <div className="text-[13px] text-muted-foreground capitalize">
          {formatDayLabel(a.startAt, a.timezone)}
        </div>
      ) : null}
      {children}
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </GlassCard>
  );
}
