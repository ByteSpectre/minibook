import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  YMap,
  YMapComponentsProvider,
  YMapControls,
  YMapCustomClusterer,
  YMapDefaultFeaturesLayer,
  YMapDefaultSchemeLayer,
  YMapGeolocationControl,
  YMapListener,
  YMapMarker,
  YMapZoomControl,
} from 'ymap3-components';
import { ClusterBubble, MarkerPin, PickedPin } from './MarkerPin';
import { YANDEX_MAPS_API_KEY } from './config';
import { MOSCOW, type MapMarker, type MapViewProps } from './types';

type LngLat = [lon: number, lat: number, alt?: number];

interface Feature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: LngLat };
  properties?: Record<string, unknown>;
}

const markerOf = (feature: Feature) => feature.properties?.marker as MapMarker;

/** Yandex Maps JS API v3 through the ymap3-components React wrapper. */
export default function YandexMap({
  markers = [],
  center,
  zoom,
  onMarkerClick,
  onPick,
  picked,
  showNearMe,
  className,
  height = 420,
  onLoadError,
}: MapViewProps & { onLoadError?: () => void }) {
  const { i18n } = useTranslation();
  const start =
    center ?? picked ?? (markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : MOSCOW);
  const [location] = useState({
    center: [start.lng, start.lat] as LngLat,
    zoom: zoom ?? (markers.length > 1 ? 11 : 14),
  });
  const features = useMemo<Feature[]>(
    () =>
      markers.map((m) => ({
        type: 'Feature',
        id: m.id,
        geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
        properties: { marker: m },
      })),
    [markers],
  );

  return (
    <div className={className} style={{ height, borderRadius: 24, overflow: 'hidden' }}>
      <YMapComponentsProvider
        apiKey={YANDEX_MAPS_API_KEY}
        lang={i18n.language === 'en' ? 'en_US' : 'ru_RU'}
        onError={() => onLoadError?.()}
      >
        <YMap location={location} mode="vector">
          <YMapDefaultSchemeLayer />
          <YMapDefaultFeaturesLayer />
          {onPick ? (
            <YMapListener
              layer="any"
              onClick={(_object, event) =>
                onPick({ lng: event.coordinates[0], lat: event.coordinates[1] })
              }
            />
          ) : null}
          <YMapCustomClusterer
            gridSize={64}
            features={features}
            marker={(feature: Feature) => (
              <YMapMarker
                key={feature.id}
                coordinates={feature.geometry.coordinates}
                onClick={() => onMarkerClick?.(markerOf(feature))}
              >
                <div style={{ transform: 'translate(-50%, -100%)' }}>
                  <MarkerPin marker={markerOf(feature)} />
                </div>
              </YMapMarker>
            )}
            cluster={(coordinates: LngLat, items: Feature[]) => (
              <YMapMarker key={`${coordinates[0]}-${coordinates[1]}`} coordinates={coordinates}>
                <div style={{ transform: 'translate(-50%, -50%)' }}>
                  <ClusterBubble count={items.length} />
                </div>
              </YMapMarker>
            )}
          />
          {picked ? (
            <YMapMarker coordinates={[picked.lng, picked.lat]}>
              <div style={{ transform: 'translate(-50%, -100%)' }}>
                <PickedPin />
              </div>
            </YMapMarker>
          ) : null}
          <YMapControls position="right">
            <YMapZoomControl />
            {showNearMe ? <YMapGeolocationControl /> : null}
          </YMapControls>
        </YMap>
      </YMapComponentsProvider>
    </div>
  );
}
