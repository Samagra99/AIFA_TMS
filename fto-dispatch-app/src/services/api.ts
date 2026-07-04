import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { SyncPullResponse, DispatchRecordData } from '../types';

const TOKEN_KEY = 'fto_jwt_access';
const REFRESH_KEY = 'fto_jwt_refresh';

// ─── Default to dev. Override in eas.json / CI env for production ────────────
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.100:8000';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${BASE_URL}/api`,
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Attach JWT to every request
    this.client.interceptors.request.use(async (config) => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Auto-refresh on 401
    this.client.interceptors.response.use(
      (res) => res,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          const refreshed = await this.refreshToken();
          if (refreshed && error.config) {
            const newToken = await SecureStore.getItemAsync(TOKEN_KEY);
            if (error.config.headers && newToken) {
              error.config.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────

  async login(username: string, password: string) {
    const res = await this.client.post('/auth/token/', { username, password });
    const { access, refresh } = res.data;
    await SecureStore.setItemAsync(TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
    return res.data;
  }

  async refreshToken(): Promise<boolean> {
    try {
      const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
      if (!refresh) return false;
      const res = await this.client.post('/auth/token/refresh/', { refresh });
      await SecureStore.setItemAsync(TOKEN_KEY, res.data.access);
      return true;
    } catch {
      return false;
    }
  }

  async logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }

  async getStoredToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  async getCurrentUser() {
    const res = await this.client.get('/auth/me/');
    return res.data;
  }

  // ─── Sync – pull all operational data ───────────────────────────────────────

  async pullAll(since?: number): Promise<SyncPullResponse> {
    const params = since ? { since } : {};
    const res = await this.client.get('/dispatch/sync/pull/', { params });
    return res.data;
  }

  // ─── Dispatch records ───────────────────────────────────────────────────────

  async pushDispatchRecord(record: Partial<DispatchRecordData>) {
    if (record.remoteId) {
      const res = await this.client.patch(
        `/dispatch/records/${record.remoteId}/`,
        this.serializeDispatchRecord(record)
      );
      return res.data;
    } else {
      const res = await this.client.post(
        '/dispatch/records/',
        this.serializeDispatchRecord(record)
      );
      return res.data;
    }
  }

  async releaseFlightDispatch(remoteRecordId: string, payload: {
    released_by: string;
    released_at: string;
    release_signature: string;
    eta_minutes: number;
  }) {
    const res = await this.client.post(
      `/dispatch/records/${remoteRecordId}/release/`,
      payload
    );
    return res.data;
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  async markAlertRead(remoteId: string) {
    await this.client.patch(`/sms/alerts/${remoteId}/`, { is_read: true });
  }

  async getActiveAlerts() {
    const res = await this.client.get('/sms/alerts/', {
      params: { is_resolved: false },
    });
    return res.data.results;
  }

  // ─── Weather ─────────────────────────────────────────────────────────────────

  async getWeather(icaoStation: string) {
    const res = await this.client.get(`/weather/metar/${icaoStation}/`);
    return res.data;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private serializeDispatchRecord(record: Partial<DispatchRecordData>) {
    return {
      flight: record.remoteFlightId,
      preflight_checks: JSON.stringify(record.preflightChecks ?? []),
      preflight_notes: record.preflightNotes ?? '',
      preflight_completed_at: record.preflightCompletedAt
        ? new Date(record.preflightCompletedAt).toISOString()
        : null,
      preflight_by: record.preflightBy,
      weather_data: record.weatherData ? JSON.stringify(record.weatherData) : null,
      notam_acknowledged: record.notamAcknowledged ?? false,
      weather_decision: record.weatherDecision,
      released_by: record.releasedBy,
      released_at: record.releasedAt
        ? new Date(record.releasedAt).toISOString()
        : null,
      release_signature: record.releaseSignature,
      eta_minutes: record.etaMinutes,
      status: record.status,
    };
  }
}

export const api = new ApiService();
