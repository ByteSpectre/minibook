import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { ThemeDto } from '@nail-crm/shared';
import { assetUrl } from '@/lib/assets';

const GOOGLE_FONTS: Record<string, string> = {
  Inter: 'Inter:wght@400;500;600;700',
  Manrope: 'Manrope:wght@400;500;600;700',
  Montserrat: 'Montserrat:wght@400;500;600;700',
  Nunito: 'Nunito:wght@400;600;700;800',
  'Playfair Display': 'Playfair+Display:wght@500;600;700',
  Comfortaa: 'Comfortaa:wght@400;600;700',
};

export function useGoogleFont(family: string): void {
  useEffect(() => {
    const spec = GOOGLE_FONTS[family];
    if (!spec) return;
    const id = `gf-${family.replace(/\s+/g, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}

function withAlpha(color: string, alpha: number): string {
  if (/^#([0-9a-f]{6})$/i.test(color)) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return `color-mix(in oklab, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

function isDarkColor(color: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

export function themeStyle(theme: ThemeDto): CSSProperties {
  const darkText = !isDarkColor(theme.textColor);
  return {
    '--glass': theme.cardBg,
    '--glass-strong': theme.cardBg,
    '--glass-border': darkText ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.65)',
    '--glass-blur': `${theme.blur}px`,
    '--card-radius': `${Math.round(theme.radius * 1.4)}px`,
    '--btn-radius': `${theme.radius}px`,
    '--primary': theme.accent,
    '--accent': withAlpha(theme.accent, 0.14),
    '--accent-foreground': theme.accent,
    '--foreground': theme.textColor,
    '--card-foreground': theme.textColor,
    '--muted': withAlpha(theme.textColor, 0.07),
    '--muted-foreground': withAlpha(theme.textColor, 0.62),
    '--border': withAlpha(theme.textColor, 0.12),
    '--brand': theme.btnBg,
    '--brand-foreground': theme.btnText,
    '--ring': withAlpha(theme.accent, 0.45),
    color: theme.textColor,
    fontFamily: `'${theme.fontFamily}', var(--font-sans)`,
  } as CSSProperties;
}

export function themeBackground(theme: ThemeDto): CSSProperties {
  if (theme.bgType === 'image') {
    const url = assetUrl(theme.bgValue);
    return {
      backgroundImage: `url(${url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return { background: theme.bgValue };
}

/** Applies a master's / salon's visual theme to everything inside. */
export function ThemedSurface({
  theme,
  children,
  className,
}: {
  theme: ThemeDto;
  children: ReactNode;
  className?: string;
}) {
  useGoogleFont(theme.fontFamily);
  return (
    <div className={className} style={themeStyle(theme)}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[5]"
        style={themeBackground(theme)}
      />
      {children}
    </div>
  );
}
