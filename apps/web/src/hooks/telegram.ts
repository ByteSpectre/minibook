import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { nativeBackButton, nativeMainButton, telegramEnv } from '@/lib/telegram';
import { useUi } from '@/store/ui';

/**
 * Telegram BackButton. In a browser the AppBar renders its own back arrow instead.
 * Pass `false` to hide the button.
 */
export function useBackButton(onBack?: (() => void) | false): void {
  const navigate = useNavigate();
  const handler = useRef<() => void>(() => navigate(-1));
  handler.current = onBack ? onBack : () => navigate(-1);

  useEffect(() => {
    if (!telegramEnv().inTelegram) return;
    if (onBack === false) {
      if (nativeBackButton.hide.isAvailable()) nativeBackButton.hide();
      return;
    }
    if (nativeBackButton.show.isAvailable()) nativeBackButton.show();
    const off = nativeBackButton.onClick.isAvailable()
      ? nativeBackButton.onClick(() => handler.current())
      : undefined;
    return () => {
      off?.();
      if (nativeBackButton.hide.isAvailable()) nativeBackButton.hide();
    };
  }, [onBack]);
}

export interface MainButtonOptions {
  text: string;
  onClick: () => void;
  enabled?: boolean;
  loading?: boolean;
  visible?: boolean;
}

/** In-app primary CTA (Telegram's green MainButton is kept hidden to avoid duplicates). */
export function useMainButton({
  text,
  onClick,
  enabled = true,
  loading = false,
  visible = true,
}: MainButtonOptions): void {
  const handler = useRef(onClick);
  handler.current = onClick;
  const setFallback = useUi((s) => s.setMainButton);
  const inTelegram = telegramEnv().inTelegram;

  useEffect(() => {
    if (!visible) {
      setFallback(null);
      if (inTelegram && nativeMainButton.setParams.isAvailable())
        nativeMainButton.setParams({ isVisible: false });
      return;
    }
    // Prefer the in-app button so Telegram's green MainButton never duplicates it.
    if (inTelegram && nativeMainButton.setParams.isAvailable())
      nativeMainButton.setParams({ isVisible: false });
    setFallback({ text, onClick: () => handler.current(), enabled, loading });
  }, [text, enabled, loading, visible, inTelegram, setFallback]);

  useEffect(
    () => () => {
      setFallback(null);
      if (inTelegram && nativeMainButton.setParams.isAvailable())
        nativeMainButton.setParams({ isVisible: false });
    },
    [inTelegram, setFallback],
  );
}
