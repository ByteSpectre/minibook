import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';
import { errorText } from '@/lib/i18n';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from './drawer';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';

/* ───────────── GlassCard ───────────── */

export function GlassCard({
  className,
  strong,
  interactive,
  ...props
}: React.ComponentProps<'div'> & { strong?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(
        strong ? 'glass-strong' : 'glass',
        'rounded-[var(--card-radius,0.75rem)] p-[var(--card-p,1.25rem)]',
        interactive && 'transition-transform duration-200 active:scale-[0.985]',
        className,
      )}
      {...props}
    />
  );
}

/* ───────────── Ripple ───────────── */

interface RippleDot {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function useRipple() {
  const [ripples, setRipples] = React.useState<RippleDot[]>([]);
  const onPointerDown = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const id = Date.now() + Math.random();
    setRipples((r) => [
      ...r,
      { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size },
    ]);
    window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 650);
  }, []);
  const node = (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute animate-ripple rounded-full bg-current opacity-30"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </span>
  );
  return { onPointerDown, node };
}

export function Ripple({ className, children, ...props }: React.ComponentProps<'div'>) {
  const { onPointerDown, node } = useRipple();
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onPointerDown={onPointerDown}
      {...props}
    >
      {children}
      {node}
    </div>
  );
}

/* ───────────── GlassButton ───────────── */

const glassButtonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap font-medium transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-[18px]',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-[color:var(--brand-foreground)] border border-border shadow-sm',
        glass: 'glass text-foreground',
        solid: 'bg-foreground text-background',
        ghost: 'text-foreground hover:bg-muted',
        outline: 'border border-border bg-transparent text-foreground hover:bg-muted',
        destructive: 'bg-destructive/10 text-destructive',
        soft: 'bg-accent text-accent-foreground',
      },
      size: {
        sm: 'h-9 min-h-9 rounded-[calc(var(--btn-radius,1rem)*0.75)] px-3 text-sm',
        md: 'h-11 min-h-11 rounded-[var(--btn-radius,1rem)] px-4 text-[15px]',
        lg: 'h-13 min-h-13 rounded-[var(--btn-radius,1rem)] px-5 text-base',
        icon: 'size-11 min-h-11 rounded-[var(--btn-radius,1rem)]',
        'icon-sm': 'size-9 min-h-9 rounded-[calc(var(--btn-radius,1rem)*0.75)]',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'glass', size: 'md' },
  },
);

export interface GlassButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
  hapticStyle?: 'light' | 'medium' | 'heavy' | false;
}

export function GlassButton({
  className,
  variant,
  size,
  block,
  asChild,
  loading,
  hapticStyle = 'light',
  children,
  onClick,
  onPointerDown,
  disabled,
  ...props
}: GlassButtonProps) {
  const ripple = useRipple();
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      className={cn(glassButtonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => {
        ripple.onPointerDown(e);
        onPointerDown?.(e);
      }}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (hapticStyle) haptic.impact(hapticStyle);
        onClick?.(e);
      }}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="animate-spin" /> : null}
          {children}
          {ripple.node}
        </>
      )}
    </Comp>
  );
}

/* ───────────── Fields ───────────── */

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
  htmlFor,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <Label htmlFor={htmlFor} className="px-1 text-[13px] font-medium text-muted-foreground">
          {label}
          {required ? <span className="text-primary"> *</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="px-1 text-[13px] text-destructive">
          {errorText(error)}
        </p>
      ) : hint ? (
        <p className="px-1 text-[13px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  'glass h-12 rounded-2xl border-glass-border px-4 text-[16px] shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive';

export function GlassInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input className={cn(inputClass, className)} {...props} />;
}

export function GlassTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return <Textarea className={cn(inputClass, 'min-h-24 py-3', className)} {...props} />;
}

/* ───────────── GlassSheet ───────────── */

export function GlassSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent
        className={cn(
          'glass-strong max-h-[88dvh] rounded-t-[28px] border-x-0 border-b-0 data-[vaul-drawer-direction=bottom]:max-h-[88dvh]',
          className,
        )}
      >
        {title || description ? (
          <DrawerHeader className="px-5 pb-2 text-left">
            {title ? <DrawerTitle className="text-lg font-semibold">{title}</DrawerTitle> : null}
            {description ? (
              <DrawerDescription>{description}</DrawerDescription>
            ) : (
              <DrawerDescription className="sr-only">{title}</DrawerDescription>
            )}
          </DrawerHeader>
        ) : (
          <DrawerTitle className="sr-only">Sheet</DrawerTitle>
        )}
        <div className="no-scrollbar overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? (
          <div className="px-5 pt-1 pb-[calc(var(--tg-safe-bottom)+16px)]">{footer}</div>
        ) : (
          <div className="pb-[calc(var(--tg-safe-bottom)+12px)]" />
        )}
      </DrawerContent>
    </Drawer>
  );
}

/* ───────────── Small building blocks ───────────── */

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-[var(--section-gap)] flex items-center justify-between', className)}>
      <h2 className="font-heading text-[18px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function Chip({
  active,
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-all active:scale-95',
        active ? 'bg-foreground text-background shadow-md' : 'glass text-foreground',
        className,
      )}
      onClick={(e) => {
        haptic.select();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onClick,
  className,
  danger,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  danger?: boolean;
}) {
  const ripple = useRipple();
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick ? () => (haptic.select(), onClick()) : undefined}
      onPointerDown={onClick ? ripple.onPointerDown : undefined}
      className={cn(
        'relative flex min-h-[3.25rem] w-full items-center gap-3 overflow-hidden px-[var(--card-p)] py-3.5 text-left transition-colors',
        onClick && 'active:bg-muted',
        danger && 'text-destructive',
        className,
      )}
    >
      {icon ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&_svg]:size-[18px]">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        {subtitle ? (
          <span className="block truncate text-[13px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {right}
      {onClick ? ripple.node : null}
    </Tag>
  );
}

export function ListGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className={cn('divide-y divide-border overflow-hidden p-0', className)}>
      {children}
    </GlassCard>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn('flex flex-col gap-1 p-3.5', className)}>
      <div className="flex items-center justify-between text-[12px] font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        {icon}
      </div>
      <div className="truncate text-[22px] font-semibold tracking-tight">{value}</div>
      {hint ? <div className="truncate text-[12px] text-muted-foreground">{hint}</div> : null}
    </GlassCard>
  );
}
