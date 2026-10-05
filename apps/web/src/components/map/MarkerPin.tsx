import { MapPin } from 'lucide-react';
import { assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';
import { initials } from '@nail-crm/shared';
import type { MapMarker } from './types';

export function MarkerPin({ marker, active }: { marker: MapMarker; active?: boolean }) {
  const url = assetUrl(marker.avatarUrl);
  return (
    <div
      className={cn(
        'relative flex flex-col items-center transition-transform',
        active && 'scale-110',
      )}
    >
      <div
        className={cn(
          'relative flex size-11 items-center justify-center overflow-hidden rounded-full border-[3px] bg-background shadow-lg',
          marker.online
            ? 'border-foreground'
            : marker.kind === 'salon'
              ? 'border-muted-foreground'
              : 'border-border',
        )}
      >
        {url ? (
          <img src={url} alt="" className="size-full object-cover grayscale" draggable={false} />
        ) : (
          <span className="text-[13px] font-bold text-foreground">{initials(marker.title)}</span>
        )}
      </div>
      {marker.discount ? (
        <span className="absolute -top-2 -right-3 rounded-full bg-brand px-1.5 text-[10px] leading-4 font-bold text-[color:var(--brand-foreground)] shadow">
          −{marker.discount}%
        </span>
      ) : null}
      <span className="-mt-1 size-3 rotate-45 rounded-sm bg-background shadow" />
    </div>
  );
}

export function ClusterBubble({ count }: { count: number }) {
  return (
    <div className="flex size-12 items-center justify-center rounded-full bg-brand text-[15px] font-bold text-[color:var(--brand-foreground)] shadow-xl ring-4 ring-background/70">
      {count}
    </div>
  );
}

export function PickedPin() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background">
        <MapPin className="size-4" fill="currentColor" />
      </div>
      <span className="-mt-1 size-3 rotate-45 rounded-sm bg-primary" />
    </div>
  );
}
