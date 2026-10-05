export function formatMoney(amount: number, currency = 'RUB', locale = 'ru-RU'): string {
  const isWhole = Math.abs(amount - Math.round(amount)) < 0.005;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: isWhole ? 0 : 2,
      minimumFractionDigits: isWhole ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(isWhole ? 0 : 2)} ${currency}`;
  }
}

export const rubToKopeks = (rub: number): number => Math.round(rub * 100);
export const kopeksToRub = (kopeks: number): number => kopeks / 100;

/** Applies a percentage discount and rounds to kopecks/cents. */
export function applyDiscount(amount: number, pct: number | null | undefined): number {
  if (!pct || pct <= 0) return amount;
  return Math.round(amount * (100 - Math.min(pct, 100))) / 100;
}

export function formatDuration(minutes: number, lang: 'ru' | 'en' = 'ru'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hs = lang === 'ru' ? 'ч' : 'h';
  const ms = lang === 'ru' ? 'мин' : 'min';
  if (h && m) return `${h} ${hs} ${m} ${ms}`;
  if (h) return `${h} ${hs}`;
  return `${m} ${ms}`;
}
