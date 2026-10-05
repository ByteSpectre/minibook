import { cn } from '@/lib/utils';

export function BrandLogo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Glow"
      width={size}
      height={size}
      className={cn('object-contain', className)}
      style={{ width: size, height: size }}
    />
  );
}
