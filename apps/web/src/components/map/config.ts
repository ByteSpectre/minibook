/** Trimmed Yandex Maps JS API v3 key from Vite env (requires `pnpm dev` restart after changes). */
export const YANDEX_MAPS_API_KEY =
  (import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined)?.trim() ?? '';

/** Geosuggest key; falls back to the maps key when Suggest is enabled on it. */
export const YANDEX_SUGGEST_API_KEY =
  (import.meta.env.VITE_YANDEX_SUGGEST_API_KEY as string | undefined)?.trim() ||
  YANDEX_MAPS_API_KEY;

export const hasYandexMapsKey = YANDEX_MAPS_API_KEY.length > 0;
export const hasYandexSuggestKey = YANDEX_SUGGEST_API_KEY.length > 0;
