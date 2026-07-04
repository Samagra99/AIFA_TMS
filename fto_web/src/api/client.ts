/**
 * Axios API client with:
 * - JWT Bearer token injection on every request
 * - Automatic silent token refresh on 401
 * - Force logout when refresh also fails
 * - Queue of failed requests replayed after refresh
 */
import axios, { type AxiosRequestConfig } from 'axios'
// 1. ADD THIS TOP-LEVEL IMPORT
import { useAuthStore } from '@/stores/authStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

// ── Token injection ────────────────────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  // 2. REMOVED THE REQUIRE STATEMENT. Call Zustand's getState() directly.
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── 401 → refresh → replay ────────────────────────────────────────────────────
type FailedRequest = { resolve: (t: string) => void; reject: (e: unknown) => void }

let isRefreshing   = false
let pendingQueue:  FailedRequest[] = []

const flushQueue = (error: unknown, token: string | null) => {
  pendingQueue.forEach(p => error ? p.reject(error) : p.resolve(token!))
  pendingQueue = []
}

apiClient.interceptors.response.use(
  res => res,
  async (error) => {
    const original: AxiosRequestConfig & { _retry?: boolean } = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    // 3. REMOVED THE REQUIRE STATEMENT HERE AS WELL.
    const { refreshToken, setTokens, logout } = useAuthStore.getState()

    if (!refreshToken) {
      logout()
      window.location.replace('/login')
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) =>
        pendingQueue.push({ resolve, reject })
      ).then(token => {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
        return apiClient(original)
      })
    }

    original._retry = true
    isRefreshing    = true

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
        refresh: refreshToken,
      })
      setTokens(data.access, data.refresh ?? refreshToken)
      flushQueue(null, data.access)
      original.headers = { ...original.headers, Authorization: `Bearer ${data.access}` }
      return apiClient(original)
    } catch (refreshError) {
      flushQueue(refreshError, null)
      logout()
      window.location.replace('/login')
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default apiClient