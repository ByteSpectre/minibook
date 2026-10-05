import { Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { GlassButton, GlassCard } from '@/components/ui/glass';
import { assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';

/** Drag-to-compare before/after slider. */
export function BeforeAfterGallery({
  before,
  after,
  className,
}: {
  before: string;
  after: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const update = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  };
  return (
    <div
      ref={ref}
      className={cn(
        'relative aspect-square w-full touch-none select-none overflow-hidden rounded-3xl',
        className,
      )}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => e.buttons > 0 && update(e.clientX)}
      role="slider"
      aria-label={t('components.beforeAfter.drag')}
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5));
        if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5));
      }}
    >
      <img
        src={assetUrl(after)}
        alt={t('components.beforeAfter.after')}
        className="absolute inset-0 size-full object-cover"
        draggable={false}
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img
          src={assetUrl(before)}
          alt={t('components.beforeAfter.before')}
          className="absolute inset-0 size-full object-cover"
          draggable={false}
        />
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold text-black shadow-lg">
          ⇆
        </div>
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
        {t('components.beforeAfter.before')}
      </span>
      <span className="absolute top-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
        {t('components.beforeAfter.after')}
      </span>
    </div>
  );
}

export function PhotoStrip({
  photos,
  size = 72,
  onOpen,
}: {
  photos: string[];
  size?: number;
  onOpen?: (url: string) => void;
}) {
  if (!photos.length) return null;
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
      {photos.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onOpen?.(p)}
          className="shrink-0 overflow-hidden rounded-2xl"
          style={{ width: size, height: size }}
        >
          <img src={assetUrl(p)} alt="" loading="lazy" className="size-full object-cover" />
        </button>
      ))}
    </div>
  );
}

const QR_COLORS = ['#1f1b26', '#e0457f', '#7b6bff', '#0f766e', '#b45309'];

export function QRCodeCard({
  link,
  title,
  avatarUrl,
  fileName = 'glow-qr.png',
}: {
  link: string;
  title: string;
  avatarUrl?: string | null;
  fileName?: string;
}) {
  const { t } = useTranslation();
  const [fg, setFg] = useState(QR_COLORS[0]!);
  const [bg, setBg] = useState('#ffffff');
  const [withAvatar, setWithAvatar] = useState(!!avatarUrl);
  const wrapper = useRef<HTMLDivElement>(null);
  const downloadPng = () => {
    const canvas = wrapper.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = fileName;
    a.click();
  };
  const avatar = assetUrl(avatarUrl);
  return (
    <GlassCard className="flex flex-col items-center gap-4 p-5">
      <div ref={wrapper} className="rounded-3xl p-4 shadow-inner" style={{ background: bg }}>
        <QRCodeCanvas
          value={link}
          size={232}
          marginSize={1}
          level="H"
          fgColor={fg}
          bgColor={bg}
          imageSettings={
            withAvatar && avatar
              ? { src: avatar, height: 52, width: 52, excavate: true, crossOrigin: 'anonymous' }
              : undefined
          }
        />
      </div>
      <div className="text-center">
        <div className="text-[16px] font-semibold">{title}</div>
        <div className="mt-0.5 max-w-[260px] truncate text-[12px] text-muted-foreground">
          {link}
        </div>
      </div>
      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-muted-foreground">{t('components.qr.color')}</span>
          <div className="flex gap-2">
            {QR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setFg(c)}
                className={cn(
                  'size-8 rounded-full ring-offset-2 ring-offset-background',
                  fg === c && 'ring-2 ring-primary',
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-muted-foreground">{t('components.qr.background')}</span>
          <div className="flex gap-2">
            {['#ffffff', '#fff0f6', '#f1edff', '#fdf6e3'].map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setBg(c)}
                className={cn(
                  'size-8 rounded-full border border-border ring-offset-2 ring-offset-background',
                  bg === c && 'ring-2 ring-primary',
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {avatar ? (
          <label className="flex items-center justify-between text-[14px] text-muted-foreground">
            {t('components.qr.withAvatar')}
            <Switch checked={withAvatar} onCheckedChange={setWithAvatar} />
          </label>
        ) : null}
      </div>
      <GlassButton variant="primary" block onClick={downloadPng}>
        <Download /> {t('components.qr.download')}
      </GlassButton>
    </GlassCard>
  );
}
