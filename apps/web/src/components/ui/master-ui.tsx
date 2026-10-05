import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';
import { GlassCard } from './glass';

export function StickyBottomBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl border-t border-border/50 bg-background/90 px-4 pt-3 pb-[calc(var(--tg-safe-bottom)+12px)] backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AccordionSection({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
  accent,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accent?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <GlassCard className="overflow-hidden p-0">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left active:bg-muted/40"
        onClick={() => {
          haptic.select();
          setOpen((v) => !v);
        }}
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            accent
              ? 'border border-foreground/20 bg-foreground text-background'
              : 'bg-muted text-foreground',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block text-[13px] text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? <div className="border-t border-border">{children}</div> : null}
    </GlassCard>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  format = (v) => v,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  className?: string;
}) {
  return (
    <div className={cn('flex rounded-2xl bg-muted/60 p-1', className)}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          className={cn(
            'flex-1 rounded-xl px-2 py-2 text-sm font-medium transition-all active:scale-[0.98]',
            o === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
          )}
          onClick={() => {
            if (o !== value) {
              haptic.select();
              onChange(o);
            }
          }}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

export function OnboardingSteps({ steps }: { steps: { title: string; hint: string }[] }) {
  return (
    <GlassCard strong className="flex flex-col gap-0 overflow-hidden p-0">
      {steps.map((step, i) => (
        <div key={step.title} className={cn('flex gap-3 p-4', i > 0 && 'border-t border-border')}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[14px] font-semibold">
            {i + 1}
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{step.title}</span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">{step.hint}</span>
          </span>
        </div>
      ))}
    </GlassCard>
  );
}

export function RatingSummaryCard({ avg, className }: { avg: number; className?: string }) {
  return (
    <GlassCard
      strong
      className={cn(
        'relative flex flex-col items-center gap-2 overflow-hidden py-6 text-center',
        className,
      )}
    >
      <div className="font-heading text-[40px] font-bold leading-none tracking-tight">
        {avg.toFixed(1)}
        <span className="text-[18px] font-medium text-muted-foreground"> / 5</span>
      </div>
    </GlassCard>
  );
}
