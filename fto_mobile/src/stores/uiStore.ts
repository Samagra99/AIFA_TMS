import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

type ThemeMode = 'light' | 'dark' | 'system';

interface UiState {
  theme: ThemeMode;
  activeBaseId: string | null;
  aogAlerts: any[]; // Or WSAOGEvent[] from types
  setTheme: (theme: ThemeMode) => void;
  setActiveBaseId: (baseId: string | null) => void;
  setAogAlerts: (alerts: any[]) => void;
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      activeBaseId: null,
      aogAlerts: [],
      setTheme: (theme) => set({ theme }),
      setActiveBaseId: (baseId) => set({ activeBaseId: baseId }),
      setAogAlerts: (alerts) => set({ aogAlerts: alerts }),
    }),
    {
      name: 'fto-ui-store',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ theme: state.theme }), // only persist theme
    }
  )
);
