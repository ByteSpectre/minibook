import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FallbackMap } from './FallbackMap';
import type { MapViewProps } from './types';

const YandexMap = lazy(() => import('./YandexMap'));
const hasYandexKey = !!(import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined);

export function MapView(props: MapViewProps) {
  if (!hasYandexKey) return <FallbackMap {...props} />;
  return (
    <Suspense
      fallback={
        <Skeleton className="w-full rounded-3xl bg-muted" style={{ height: props.height ?? 420 }} />
      }
    >
      <YandexMap {...props} />
    </Suspense>
  );
}

export function yandexMapsUrl(lat: number, lng: number, label?: string): string {
  const text = label ? `&text=${encodeURIComponent(label)}` : '';
  return `https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map${text}`;
}

export type { MapMarker, LatLng, MapViewProps } from './types';
