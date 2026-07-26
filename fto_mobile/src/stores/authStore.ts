/**
 * Auth store — persisted to expo-secure-store.
 * Mirrors the web app's authStore pattern exactly.
 * Stores JWT tokens + decoded user info.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { UserRole, UUID } from '../types';

interface AuthUser {
  id:            UUID;
  email:         string;
  role:          UserRole;
  full_name:     string;
  home_base_id:  UUID | null;
  token_version: number;
}

interface AuthState {
  accessToken:  string | null;
  refreshToken: string | null;
  user:         AuthUser | null;
  // Actions
  setTokens: (access: string, refresh: string) => void;
  setUser:   (user: AuthUser) => void;
  logout:    () => void;
  // Selectors
  isAuthenticated: () => boolean;
  hasRole:         (...roles: UserRole[]) => boolean;
}

/** Decode a JWT payload without verifying signature (client-side only). */
function decodeJwt(token: string): AuthUser | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return {
      id:            payload.user_id,
      email:         payload.email ?? '',
      role:          payload.role,
      full_name:     payload.full_name,
      home_base_id:  payload.home_base_id ?? null,
      token_version: payload.token_version ?? 0,
    };
  } catch {
    return null;
  }
}

// Custom SecureStore storage adapter for Zustand persist
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken:  null,
      refreshToken: null,
      user:         null,

      setTokens(access: string, refresh: string) {
        const user = decodeJwt(access);
        set({ accessToken: access, refreshToken: refresh, user });
      },

      setUser(user: AuthUser) {
        set({ user });
      },

      logout() {
        set({ accessToken: null, refreshToken: null, user: null });
      },

      isAuthenticated() {
        const { accessToken, user } = get();
        if (!accessToken || !user) return false;
        try {
          const decoded = decodeJwt(accessToken);
          if (!decoded) return false;
          // Check expiration from the raw JWT payload
          const base64 = accessToken.split('.')[1];
          const payload = JSON.parse(atob(base64));
          return payload.exp * 1000 > Date.now();
        } catch {
          return false;
        }
      },

      hasRole(...roles: UserRole[]) {
        const role = get().user?.role;
        return role ? roles.includes(role) : false;
      },
    }),
    {
      name:    'fto-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
        user:         state.user,
      }),
    }
  )
);
