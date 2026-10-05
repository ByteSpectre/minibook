const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '');

/** Upload paths (`/uploads/...`) are served by the API; absolute URLs pass through. */
export function assetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/uploads/')) return `${API_BASE}${url}`;
  return url;
}

export const apiBase = API_BASE;
