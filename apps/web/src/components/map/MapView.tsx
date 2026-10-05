import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { hasYandexMapsKey } from './config';
import { FallbackMap } from './FallbackMap';
import type { MapViewProps } from './types';

const YandexMap = lazy(() => import('./YandexMap'));

export function MapView(props: MapViewProps) {
  const { t } = useTranslation();
  const [yandexFailed, setYandexFailed] = useState(false);

  const onYandexError = () => {
    setYandexFailed(true);
    toast.error(t('components.map.yandexFailed'));
  };

  if (!hasYandexMapsKey || yandexFailed) {
    return <FallbackMap {...props} yandexFailed={hasYandexMapsKey && yandexFailed} />;
  }

  return (
    <Suspense
      fallback={
        <Skeleton className="w-full rounded-3xl bg-muted" style={{ height: props.height ?? 420 }} />
      }
    >
      <YandexMap {...props} onLoadError={onYandexError} />
    </Suspense>
  );
}

export function yandexMapsUrl(lat: number, lng: number, label?: string): string {
  const text = label ? `&text=${encodeURIComponent(label)}` : '';
  return `https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map${text}`;
}

export type { MapMarker, LatLng, MapViewProps } from './types';
