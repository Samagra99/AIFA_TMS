import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// Set your computer's local Wi-Fi IP address so physical Android devices on Wi-Fi can connect
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.6:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Type': 'mobile',
  },
  timeout: 30_000,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      const { refreshToken, setTokens, logout } = useAuthStore.getState();

      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });
        const { data } = response;

        const newAccess = data.access;
        let newRefresh = data.refresh;

        if (!newRefresh && response.headers['set-cookie']) {
          const cookies = Array.isArray(response.headers['set-cookie']) 
            ? response.headers['set-cookie'] 
            : [response.headers['set-cookie']];
          for (const cookieStr of cookies) {
            const match = cookieStr.match(/refresh=([^;]+)/) || cookieStr.match(/refresh_token=([^;]+)/);
            if (match) {
              newRefresh = match[1];
              break;
            }
          }
        }
        
        newRefresh = newRefresh || refreshToken;

        setTokens(newAccess, newRefresh);
        processQueue(null, newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
