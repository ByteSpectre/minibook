import {
  backButton,
  closingBehavior,
  copyTextToClipboard,
  downloadFile,
  hapticFeedback,
  init,
  isTMA,
  mainButton,
  miniApp,
  openLink as tgOpenLink,
  openTelegramLink as tgOpenTelegramLink,
  popup,
  retrieveLaunchParams,
  retrieveRawInitData,
  shareURL,
  swipeBehavior,
  themeParams,
  viewport,
} from '@telegram-apps/sdk-react';

export interface TelegramEnv {
  inTelegram: boolean;
  initDataRaw: string | null;
  startParam: string | null;
  languageCode: string | null;
  colorScheme: 'light' | 'dark';
  platform: string | null;
}

let env: TelegramEnv | null = null;

const safe = (fn: () => void) => {
  try {
    fn();
  } catch {
    /* feature not supported by this client */
  }
};

function browserEnv(): TelegramEnv {
  const params = new URLSearchParams(window.location.search);
  return {
    inTelegram: false,
    initDataRaw: null,
    startParam: params.get('startapp') ?? params.get('tgWebAppStartParam'),
    languageCode: navigator.language ?? null,
    colorScheme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    platform: null,
  };
}

/** Initializes the Telegram SDK once. Outside Telegram it returns browser defaults. */
export function initTelegram(): TelegramEnv {
  if (env) return env;
  let inside: boolean;
  try {
    inside = isTMA();
  } catch {
    inside = false;
  }
  if (!inside) {
    env = browserEnv();
    return env;
  }
  init();
  safe(() => miniApp.mountSync());
  safe(() => themeParams.mountSync());
  safe(() => themeParams.bindCssVars());
  safe(() => miniApp.bindCssVars());
  safe(() => backButton.mount());
  safe(() => mainButton.mount());
  safe(() => {
    swipeBehavior.mount();
    swipeBehavior.disableVertical();
  });
  safe(() => closingBehavior.mount());
  void viewport
    .mount()
    .then(() => {
      safe(() => viewport.bindCssVars());
      safe(() => viewport.expand());
    })
    .catch(() => undefined);
  safe(() => miniApp.ready());

  let startParam: string | null = null;
  let languageCode: string | null = null;
  let platform: string | null = null;
  safe(() => {
    const lp = retrieveLaunchParams();
    const data = lp.tgWebAppData as
      { start_param?: string; user?: { language_code?: string } } | undefined;
    startParam = lp.tgWebAppStartParam ?? data?.start_param ?? null;
    languageCode = data?.user?.language_code ?? null;
    platform = lp.tgWebAppPlatform ?? null;
  });
  let dark = false;
  safe(() => {
    dark = miniApp.isDark();
  });
  env = {
    inTelegram: true,
    initDataRaw: retrieveRawInitData() ?? null,
    startParam,
    languageCode,
    colorScheme: dark ? 'dark' : 'light',
    platform,
  };
  return env;
}

export const telegramEnv = (): TelegramEnv => env ?? initTelegram();

type Impact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type Notification = 'success' | 'warning' | 'error';

export const haptic = {
  impact(style: Impact = 'light') {
    if (hapticFeedback.impactOccurred.isAvailable()) hapticFeedback.impactOccurred(style);
  },
  notify(type: Notification) {
    if (hapticFeedback.notificationOccurred.isAvailable())
      hapticFeedback.notificationOccurred(type);
  },
  select() {
    if (hapticFeedback.selectionChanged.isAvailable()) hapticFeedback.selectionChanged();
  },
};

export function openExternal(url: string): void {
  if (tgOpenLink.isAvailable()) tgOpenLink(url, { tryBrowser: 'chrome' });
  else window.open(url, '_blank', 'noopener');
}

export function openTelegram(url: string): void {
  if (tgOpenTelegramLink.isAvailable()) tgOpenTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}

export function openUsername(username: string): void {
  openTelegram(`https://t.me/${username.replace(/^@/, '')}`);
}

export async function shareLink(url: string, text?: string): Promise<void> {
  if (shareURL.isAvailable()) {
    shareURL(url, text);
    return;
  }
  if (navigator.share) {
    await navigator.share({ url, text }).catch(() => undefined);
    return;
  }
  await copyText(url);
}

export async function copyText(text: string): Promise<void> {
  try {
    await copyTextToClipboard(text);
  } catch {
    await navigator.clipboard?.writeText(text);
  }
}

/** Native download popup (Bot API 8.0+) with a browser fallback. */
export async function download(url: string, fileName: string): Promise<void> {
  if (downloadFile.isAvailable()) {
    try {
      await downloadFile(url, fileName);
      return;
    } catch {
      /* fall back to the browser */
    }
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const nativeBackButton = backButton;
export const nativeMainButton = mainButton;

export function setHeaderColors(color: `#${string}`): void {
  safe(() => miniApp.setHeaderColor(color));
  safe(() => miniApp.setBackgroundColor(color));
  safe(() => miniApp.setBottomBarColor(color));
}

/** Native Telegram confirm popup with a browser fallback. */
export async function confirmDialog(
  message: string,
  okText = 'OK',
  cancelText = 'Cancel',
): Promise<boolean> {
  if (popup.show.isAvailable()) {
    try {
      const id = await popup.show({
        message,
        buttons: [
          { id: 'ok', type: 'destructive', text: okText },
          { id: 'cancel', type: 'default', text: cancelText },
        ],
      });
      return id === 'ok';
    } catch {
      return false;
    }
  }
  return window.confirm(message);
}
