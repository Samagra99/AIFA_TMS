import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import { api } from '../services/api';
import { wsService } from '../services/websocket.service';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.login(username, password);
      const user = await api.getCurrentUser();

      wsService.setToken(data.access);
      wsService.connect();

      set({
        user,
        token: data.access,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Login failed. Check your credentials.';
      set({ isLoading: false, error: msg, isAuthenticated: false });
      throw err;
    }
  },

  logout: async () => {
    wsService.disconnect();
    await api.logout();
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('fto_jwt_access');
      if (!token) return false;

      // Validate by fetching the current user
      wsService.setToken(token);
      const user = await api.getCurrentUser();

      wsService.connect();
      set({ user, token, isAuthenticated: true });
      return true;
    } catch {
      // Token expired / invalid – clean up
      await SecureStore.deleteItemAsync('fto_jwt_access');
      await SecureStore.deleteItemAsync('fto_jwt_refresh');
      set({ isAuthenticated: false, user: null, token: null });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
