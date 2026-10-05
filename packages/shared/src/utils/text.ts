import { RESERVED_SLUGS } from '../constants';

/** Telegram usernames: 5–32 chars, latin letters, digits and underscores. */
export const USERNAME_RE = /^[a-z][a-z0-9_]{3,31}$/;

/**
 * Telegram usernames are case-insensitive, so they are always stored and compared in
 * lowercase without the leading `@` or a `t.me/` prefix.
 */
export function normalizeUsername(raw?: string | null): string | null {
  if (!raw) return null;
  const value = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, '')
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
  return value.length > 0 ? value : null;
}

export function isValidUsername(raw?: string | null): boolean {
  const value = normalizeUsername(raw);
  return value !== null && USERNAME_RE.test(value);
}

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/;

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function slugify(input: string): string {
  const transliterated = input
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('');
  return transliterated
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 32)
    .replace(/-+$/g, '');
}

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !isReservedSlug(slug) && !slug.includes('--');
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Escapes text for Telegram HTML parse mode. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
