import { create } from 'zustand';
import type { AuthResponse, MeDto } from '@nail-crm/shared';
import { telegramEnv } from '@/lib/telegram';

export type Cabinet = 'client' | 'master' | 'salon' | 'admin';

const TOKEN_KEY = 'glow.token';
const CABINET_KEY = 'glow.cabinet';

interface AuthState {
  status: 'booting' | 'ready' | 'needsLogin' | 'outsideTelegram' | 'error';
  token: string | null;
  me: MeDto | null;
  cabinet: Cabinet | null;
  error: string | null;
  setSession: (res: AuthResponse) => void;
  setMe: (me: MeDto) => void;
  setCabinet: (cabinet: Cabinet) => void;
  setStatus: (status: AuthState['status'], error?: string | null) => void;
  logout: () => void;
  reauthenticate: () => Promise<boolean>;
  /** Re-issues the session so JWT claims and `me` reflect role or subscription changes. */
  refreshMe: () => Promise<void>;
}

const storedCabinet = (): Cabinet | null => {
  const v = localStorage.getItem(CABINET_KEY);
  return v === 'client' || v === 'master' || v === 'salon' || v === 'admin' ? v : null;
};

let reauthInFlight: Promise<boolean> | null = null;

export const useAuth = create<AuthState>((set, get) => ({
  status: 'booting',
  token: localStorage.getItem(TOKEN_KEY),
  me: null,
  cabinet: storedCabinet(),
  error: null,
  setSession: (res) => {
    localStorage.setItem(TOKEN_KEY, res.token);
    set({ token: res.token, me: res.me, status: 'ready', error: null });
  },
  setMe: (me) => set({ me }),
  setCabinet: (cabinet) => {
    localStorage.setItem(CABINET_KEY, cabinet);
    set({ cabinet });
  },
  setStatus: (status, error = null) => set({ status, error }),
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, me: null, status: telegramEnv().inTelegram ? 'error' : 'needsLogin' });
  },
  reauthenticate: async () => {
    if (reauthInFlight) return reauthInFlight;
    const env = telegramEnv();
    if (!env.inTelegram || !env.initDataRaw) {
      get().logout();
      return false;
    }
    reauthInFlight = (async () => {
      try {
        const { request } = await import('@/api/client');
        const res = await request<AuthResponse>('/api/auth/init', {
          method: 'POST',
          body: { initData: env.initDataRaw },
          noRetry: true,
        });
        get().setSession(res);
        return true;
      } catch {
        set({ status: 'error', error: 'unauthorized' });
        return false;
      } finally {
        reauthInFlight = null;
      }
    })();
    return reauthInFlight;
  },
  refreshMe: async () => {
    if (!get().token) return;
    try {
      const { request } = await import('@/api/client');
      get().setSession(
        await request<AuthResponse>('/api/auth/refresh', { method: 'POST', noRetry: true }),
      );
    } catch {
      /* the next request re-authenticates if needed */
    }
  },
}));

export const useMe = () => useAuth((s) => s.me);
