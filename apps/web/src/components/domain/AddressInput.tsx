import { MapPin } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { GlassInput } from '@/components/ui/glass';
import { cn } from '@/lib/utils';

export type AddressSuggestion = {
  title: string;
  subtitle: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

async function fetchSuggestions(query: string, lang: string): Promise<AddressSuggestion[]> {
  if (query.trim().length < 2) return [];
  try {
    const data = await api.get<{ items: Omit<AddressSuggestion, 'lat' | 'lng'>[] }>(
      '/api/geo/suggest',
      { q: query.trim(), lang },
    );
    return (data.items ?? []).map((item) => ({ ...item, lat: null, lng: null }));
  } catch {
    return [];
  }
}

async function geocodeAddress(
  address: string,
  lang: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null;
  try {
    const data = await api.get<{ lat: number | null; lng: number | null }>('/api/geo/geocode', {
      q: address.trim(),
      lang,
    });
    if (data.lat == null || data.lng == null) return null;
    return { lat: data.lat, lng: data.lng };
  } catch {
    return null;
  }
}

export function AddressInput({
  value,
  onChange,
  onPick,
  placeholder,
  className,
}: {
  value: string;
  onChange: (address: string) => void;
  /** Called when user picks a suggestion (with coords when geocoding succeeds). */
  onPick?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);
  const skipSuggest = useRef(false);

  useEffect(() => {
    if (skipSuggest.current) {
      skipSuggest.current = false;
      return;
    }
    window.clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(() => {
      setLoading(true);
      void fetchSuggestions(value, i18n.language)
        .then((next) => {
          setItems(next);
          setOpen(next.length > 0);
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => window.clearTimeout(timer.current);
  }, [value, i18n.language]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = async (item: AddressSuggestion) => {
    skipSuggest.current = true;
    onChange(item.address || item.title);
    setOpen(false);
    setItems([]);
    let next = item;
    if (onPick) {
      const coords = await geocodeAddress(item.address || item.title, i18n.language);
      if (coords) next = { ...item, lat: coords.lat, lng: coords.lng };
      onPick(next);
    }
  };

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <GlassInput
        value={value}
        placeholder={placeholder}
        autoComplete="street-address"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
      />
      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-2xl border border-border bg-card py-1 shadow-lg backdrop-blur-xl"
        >
          {items.map((item, i) => (
            <li key={`${item.address}-${i}`} role="option">
              <button
                type="button"
                className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted"
                onClick={() => void pick(item)}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium leading-snug">
                    {item.title || item.address}
                  </span>
                  {item.subtitle ? (
                    <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                      {item.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
          {loading ? (
            <li className="px-3.5 py-2 text-[12px] text-muted-foreground">{t('common.loading')}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
