import { create } from 'zustand';

type ThemeMode = 'light' | 'dark' | 'system';

interface UiState {
  theme: ThemeMode;
  activeBaseId: string | null;
  aogAlerts: any[]; // Or WSAOGEvent[] from types
  setTheme: (theme: ThemeMode) => void;
  setActiveBaseId: (baseId: string | null) => void;
  setAogAlerts: (alerts: any[]) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'system',
  activeBaseId: null,
  aogAlerts: [],
  setTheme: (theme) => set({ theme }),
  setActiveBaseId: (baseId) => set({ activeBaseId: baseId }),
  setAogAlerts: (alerts) => set({ aogAlerts: alerts }),
}));
