import { create } from 'zustand';

export interface MainButtonConfig {
  text: string;
  onClick: () => void;
  enabled?: boolean;
  loading?: boolean;
}

interface UiState {
  /** In-app replacement for Telegram's MainButton when running in a browser. */
  mainButton: MainButtonConfig | null;
  setMainButton: (config: MainButtonConfig | null) => void;
}

export const useUi = create<UiState>((set) => ({
  mainButton: null,
  setMainButton: (mainButton) => set({ mainButton }),
}));
