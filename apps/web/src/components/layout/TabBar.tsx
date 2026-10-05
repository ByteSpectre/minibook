import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that keep the tab highlighted. */
  match?: string[];
  end?: boolean;
  badge?: number;
}

export function TabBar({ items, layoutId }: { items: TabItem[]; layoutId: string }) {
  const { pathname } = useLocation();
  const activeIndex = (() => {
    let best = -1;
    let bestLen = -1;
    items.forEach((item, i) => {
      const prefixes = [item.to, ...(item.match ?? [])];
      for (const p of prefixes) {
        const hit = item.end ? pathname === p : pathname === p || pathname.startsWith(`${p}/`);
        if (hit && p.length > bestLen) {
          best = i;
          bestLen = p.length;
        }
      }
    });
    return best;
  })();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(var(--tg-safe-bottom)+10px)]"
    >
      <div className="glass-strong mx-auto flex max-w-xl items-stretch justify-around rounded-[26px] p-1.5">
        {items.map((item, i) => {
          const active = i === activeIndex;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => haptic.select()}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {active ? (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-[20px] bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              ) : null}
              <span className="relative">
                <Icon
                  className={cn('size-[22px]', active && 'text-primary')}
                  strokeWidth={active ? 2.3 : 1.9}
                />
                {item.badge ? (
                  <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </span>
              <span className="relative">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export function TabLayout({ items, layoutId }: { items: TabItem[]; layoutId: string }) {
  return (
    <>
      <Outlet />
      <TabBar items={items} layoutId={layoutId} />
    </>
  );
}
