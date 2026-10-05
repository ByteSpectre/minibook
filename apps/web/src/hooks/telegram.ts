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

/** Telegram MainButton with an in-app fallback rendered by <MainButtonFallback/>. */
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
      if (inTelegram && nativeMainButton.setParams.isAvailable())
        nativeMainButton.setParams({ isVisible: false });
      else setFallback(null);
      return;
    }
    if (inTelegram && nativeMainButton.setParams.isAvailable()) {
      nativeMainButton.setParams({
        text,
        isVisible: true,
        isEnabled: enabled && !loading,
        isLoaderVisible: loading,
        hasShineEffect: enabled && !loading,
      });
      return;
    }
    setFallback({ text, onClick: () => handler.current(), enabled, loading });
  }, [text, enabled, loading, visible, inTelegram, setFallback]);

  useEffect(() => {
    if (!inTelegram || !nativeMainButton.onClick.isAvailable()) return;
    const off = nativeMainButton.onClick(() => handler.current());
    return () => off();
  }, [inTelegram]);

  useEffect(
    () => () => {
      if (inTelegram && nativeMainButton.setParams.isAvailable())
        nativeMainButton.setParams({ isVisible: false });
      else setFallback(null);
    },
    [inTelegram, setFallback],
  );
}
