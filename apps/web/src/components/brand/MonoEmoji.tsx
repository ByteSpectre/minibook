import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Renders emoji in grayscale to match the B&W gothic palette. */
export function MonoEmoji({ children, className }: { children?: ReactNode; className?: string }) {
  if (children == null || children === '') return null;
  return (
    <span aria-hidden className={cn('emoji-mono inline-block leading-none', className)}>
      {children}
    </span>
  );
}
