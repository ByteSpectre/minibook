import { ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { uploadImage } from '@/api/client';
import { errorMessage } from '@/api/queryClient';
import { assetUrl } from '@/lib/assets';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export interface PhotoUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  /** Upload endpoint: `/api/public/upload`, `/api/master/upload`, `/api/salon/upload`. */
  endpoint?: string;
  kind: string;
  size?: number;
  className?: string;
}

export function PhotoUploader({
  value,
  onChange,
  max = 5,
  endpoint = '/api/public/upload',
  kind,
  size = 84,
  className,
}: PhotoUploaderProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = max - value.length;
    const batch = [...files].slice(0, room);
    if (files.length > room) toast.message(t('components.photoUploader.limit', { count: max }));
    setUploading(batch.length);
    const urls: string[] = [];
    for (const file of batch) {
      try {
        const res = await uploadImage(endpoint, file, kind);
        urls.push(res.url);
      } catch (err) {
        toast.error(errorMessage(err) || t('components.photoUploader.failed'));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (urls.length) {
      haptic.notify('success');
      onChange([...value, ...urls]);
    }
    if (input.current) input.current.value = '';
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {value.map((url) => (
        <div
          key={url}
          className="relative overflow-hidden rounded-2xl"
          style={{ width: size, height: size }}
        >
          <img src={assetUrl(url)} alt="" className="size-full object-cover" />
          <button
            type="button"
            aria-label={t('components.photoUploader.remove')}
            onClick={() => onChange(value.filter((v) => v !== url))}
            className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      {Array.from({ length: uploading }, (_, i) => (
        <div
          key={`u${i}`}
          className="glass flex items-center justify-center rounded-2xl"
          style={{ width: size, height: size }}
        >
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ))}
      {value.length + uploading < max ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="glass flex flex-col items-center justify-center gap-1 rounded-2xl border-dashed text-[11px] font-medium text-muted-foreground active:scale-95"
          style={{ width: size, height: size }}
        >
          <ImagePlus className="size-5" />
          {t('components.photoUploader.add')}
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={max - value.length > 1}
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
    </div>
  );
}

/** Single image (avatar, preview, cover). */
export function SinglePhotoUploader({
  value,
  onChange,
  endpoint,
  kind,
  size = 96,
  round,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  endpoint?: string;
  kind: string;
  size?: number;
  round?: boolean;
  placeholder?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadImage(endpoint ?? '/api/public/upload', file, kind);
      haptic.notify('success');
      onChange(res.url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          'glass flex size-full items-center justify-center overflow-hidden active:scale-95',
          round ? 'rounded-full' : 'rounded-3xl',
        )}
        aria-label={t('components.photoUploader.add')}
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : value ? (
          <img src={assetUrl(value)} alt="" className="size-full object-cover" />
        ) : (
          (placeholder ?? <ImagePlus className="size-6 text-muted-foreground" />)
        )}
      </button>
      {value && !busy ? (
        <button
          type="button"
          aria-label={t('components.photoUploader.remove')}
          onClick={() => onChange(null)}
          className="absolute -top-1 -right-1 flex size-7 items-center justify-center rounded-full bg-foreground text-background shadow"
        >
          <X className="size-4" />
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
