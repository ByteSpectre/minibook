import { LocateFixed, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { ClusterBubble, MarkerPin, PickedPin } from './MarkerPin';
import { MOSCOW, type LatLng, type MapMarker, type MapViewProps } from './types';

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;
const CLUSTER_PX = 58;

function project({ lat, lng }: LatLng, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unproject(x: number, y: number, zoom: number): LatLng {
  const scale = TILE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng };
}

function fitZoom(points: LatLng[], width: number, height: number): number {
  if (points.length < 2) return 13;
  for (let z = MAX_ZOOM - 3; z >= MIN_ZOOM; z -= 1) {
    const projected = points.map((p) => project(p, z));
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    if (
      Math.max(...xs) - Math.min(...xs) < width * 0.75 &&
      Math.max(...ys) - Math.min(...ys) < height * 0.7
    )
      return z;
  }
  return MIN_ZOOM;
}

interface Cluster {
  id: string;
  x: number;
  y: number;
  markers: MapMarker[];
}

/** Schematic map used when no Yandex Maps key is configured (offline-friendly). */
export function FallbackMap({
  markers = [],
  center,
  zoom: zoomProp,
  onMarkerClick,
  onPick,
  picked,
  showNearMe,
  className,
  height = 420,
  yandexFailed = false,
}: MapViewProps & { yandexFailed?: boolean }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: typeof height === 'number' ? height : 420 });
  const [view, setView] = useState<{ center: LatLng; zoom: number } | null>(null);
  const [user, setUser] = useState<LatLng | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    cx: number;
    cy: number;
    moved: boolean;
    pointers: Map<number, { x: number; y: number }>;
    pinch?: number;
  } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pointsKey = markers.map((m) => m.id).join(',');
  useEffect(() => {
    const pts = markers.length ? markers : [];
    const c =
      center ??
      picked ??
      (pts.length
        ? {
            lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
            lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
          }
        : MOSCOW);
    setView({ center: c, zoom: zoomProp ?? (pts.length ? fitZoom(pts, size.w, size.h) : 12) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, center?.lat, center?.lng, size.w > 0]);

  const v = view ?? { center: center ?? MOSCOW, zoom: zoomProp ?? 12 };
  const origin = project(v.center, v.zoom);
  const toScreen = (p: LatLng) => {
    const pt = project(p, v.zoom);
    return { x: pt.x - origin.x + size.w / 2, y: pt.y - origin.y + size.h / 2 };
  };

  const clusters = useMemo<Cluster[]>(() => {
    const cells = new Map<string, Cluster>();
    for (const m of markers) {
      const s = toScreen(m);
      const key = `${Math.floor(s.x / CLUSTER_PX)}:${Math.floor(s.y / CLUSTER_PX)}`;
      const c = cells.get(key);
      if (c) {
        c.markers.push(m);
        c.x = (c.x * (c.markers.length - 1) + s.x) / c.markers.length;
        c.y = (c.y * (c.markers.length - 1) + s.y) / c.markers.length;
      } else cells.set(key, { id: key, x: s.x, y: s.y, markers: [m] });
    }
    return [...cells.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, v.center.lat, v.center.lng, v.zoom, size.w, size.h]);

  const setZoom = (z: number, anchor?: { x: number; y: number }) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    if (!anchor) {
      setView({ center: v.center, zoom: next });
      return;
    }
    const world = { x: origin.x + anchor.x - size.w / 2, y: origin.y + anchor.y - size.h / 2 };
    const latlng = unproject(world.x, world.y, v.zoom);
    const p = project(latlng, next);
    setView({
      center: unproject(p.x - (anchor.x - size.w / 2), p.y - (anchor.y - size.h / 2), next),
      zoom: next,
    });
  };

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error(t('components.map.geoDenied'));
      return;
    }
    toast.message(t('components.map.locating'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUser(p);
        setView({ center: p, zoom: 14 });
        haptic.notify('success');
      },
      () => toast.error(t('components.map.geoDenied')),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const gridOffset = { x: -(origin.x % 64), y: -(origin.y % 64) };

  return (
    <div
      ref={ref}
      className={cn(
        'relative touch-none select-none overflow-hidden rounded-3xl border border-glass-border',
        className,
      )}
      style={{
        height,
        backgroundColor: 'var(--background)',
        backgroundImage:
          'linear-gradient(color-mix(in srgb, var(--foreground) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--foreground) 8%, transparent) 1px, transparent 1px)',
        backgroundSize: '64px 64px, 64px 64px',
        backgroundPosition: `${gridOffset.x}px ${gridOffset.y}px, ${gridOffset.x}px ${gridOffset.y}px`,
      }}
      onWheel={(e) => {
        const rect = ref.current!.getBoundingClientRect();
        setZoom(v.zoom + (e.deltaY < 0 ? 1 : -1), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const pointers = drag.current?.pointers ?? new Map();
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          cx: origin.x,
          cy: origin.y,
          moved: false,
          pointers,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (d.pointers.size === 2) {
          const [a, b] = [...d.pointers.values()];
          const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
          if (d.pinch) {
            if (dist / d.pinch > 1.35) {
              setZoom(v.zoom + 1);
              d.pinch = dist;
            } else if (d.pinch / dist > 1.35) {
              setZoom(v.zoom - 1);
              d.pinch = dist;
            }
          } else d.pinch = dist;
          d.moved = true;
          return;
        }
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        if (d.moved) setView({ center: unproject(d.cx - dx, d.cy - dy, v.zoom), zoom: v.zoom });
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        d?.pointers.delete(e.pointerId);
        if (d && !d.moved && onPick && e.target === e.currentTarget) {
          const rect = ref.current!.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          onPick(unproject(origin.x + sx - size.w / 2, origin.y + sy - size.h / 2, v.zoom));
          haptic.select();
        }
        if (!d || d.pointers.size === 0) drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      {clusters.map((c) =>
        c.markers.length > 1 ? (
          <button
            key={c.id}
            type="button"
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: c.x, top: c.y }}
            aria-label={t('components.map.cluster', { count: c.markers.length })}
            onClick={() => setZoom(v.zoom + 2, { x: c.x, y: c.y })}
          >
            <ClusterBubble count={c.markers.length} />
          </button>
        ) : (
          <button
            key={c.id}
            type="button"
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: c.x, top: c.y }}
            aria-label={c.markers[0]!.title}
            onClick={() => {
              haptic.impact('light');
              onMarkerClick?.(c.markers[0]!);
            }}
          >
            <MarkerPin marker={c.markers[0]!} />
          </button>
        ),
      )}
      {picked ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
          style={{ left: toScreen(picked).x, top: toScreen(picked).y }}
        >
          <PickedPin />
        </div>
      ) : null}
      {user ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: toScreen(user).x, top: toScreen(user).y }}
        >
          <span className="block size-4 rounded-full border-[3px] border-background bg-foreground shadow-lg" />
        </div>
      ) : null}

      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <button
          type="button"
          aria-label={t('components.map.zoomIn')}
          onClick={() => setZoom(v.zoom + 1)}
          className="glass-strong flex size-10 items-center justify-center rounded-full"
        >
          <Plus className="size-5" />
        </button>
        <button
          type="button"
          aria-label={t('components.map.zoomOut')}
          onClick={() => setZoom(v.zoom - 1)}
          className="glass-strong flex size-10 items-center justify-center rounded-full"
        >
          <Minus className="size-5" />
        </button>
      </div>
      {showNearMe ? (
        <button
          type="button"
          onClick={locate}
          className="glass-strong absolute bottom-12 left-1/2 flex h-10 -translate-x-1/2 items-center gap-2 rounded-full px-4 text-[14px] font-medium"
        >
          <LocateFixed className="size-4 text-primary" /> {t('components.map.nearMe')}
        </button>
      ) : null}
      <div className="pointer-events-none absolute inset-x-3 bottom-2 text-center text-[11px] text-muted-foreground">
        {onPick && !picked
          ? t('components.map.pickHint')
          : t(yandexFailed ? 'components.map.yandexFailedHint' : 'components.map.fallback')}
      </div>
    </div>
  );
}
