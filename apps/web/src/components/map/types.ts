export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarker extends LatLng {
  id: string;
  title?: string;
  avatarUrl?: string | null;
  online?: boolean;
  discount?: number | null;
  kind?: 'master' | 'salon';
}

export interface MapViewProps {
  markers?: MapMarker[];
  center?: LatLng | null;
  zoom?: number;
  onMarkerClick?: (marker: MapMarker) => void;
  /** Enables pick mode: tapping the map selects a point. */
  onPick?: (point: LatLng) => void;
  picked?: LatLng | null;
  showNearMe?: boolean;
  className?: string;
  height?: number | string;
}

export const MOSCOW: LatLng = { lat: 55.7558, lng: 37.6173 };
