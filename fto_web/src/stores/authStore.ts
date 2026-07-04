/**
 * Auth store — persisted to localStorage.
 * Stores JWT tokens + decoded user info.
 * Exposes helpers used by the Axios interceptor.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserRole, UUID } from '@/api/types'

interface AuthUser {
  id:            UUID
  email:         string
  role:          UserRole
  full_name:     string
  home_base_id:  UUID | null
  token_version: number
}

interface AuthState {
  accessToken:  string | null
  refreshToken: string | null
  user:         AuthUser | null
  // Actions
  setTokens: (access: string, refresh: string) => void
  setUser:   (user: AuthUser) => void
  logout:    () => void
  // Selectors
  isAuthenticated: () => boolean
  hasRole:         (...roles: UserRole[]) => boolean
}

/** Decode a JWT payload without verifying signature (client-side only). */
function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      id:            payload.user_id,
      email:         payload.email ?? '',
      role:          payload.role,
      full_name:     payload.full_name,
      home_base_id:  payload.home_base_id ?? null,
      token_version: payload.token_version ?? 0,
    }
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken:  null,
      refreshToken: null,
      user:         null,

      setTokens(access, refresh) {
        const user = decodeJwt(access)
        set({ accessToken: access, refreshToken: refresh, user })
      },

      setUser(user) {
        set({ user })
      },

      logout() {
        set({ accessToken: null, refreshToken: null, user: null })
      },

      isAuthenticated() {
        const { accessToken, user } = get()
        if (!accessToken || !user) return false
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]))
          return payload.exp * 1000 > Date.now()
        } catch {
          return false
        }
      },

      hasRole(...roles: UserRole[]) {
        const role = get().user?.role
        return role ? roles.includes(role) : false
      },
    }),
    {
      name:    'fto-auth',
      storage: createJSONStorage(() => localStorage),
      // Only persist tokens — user is re-derived from the access token on load
      partialize: (state) => ({
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
        user:         state.user,
      }),
    }
  )
)
