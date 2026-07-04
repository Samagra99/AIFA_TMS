import { create } from 'zustand';
import { AlertData } from '../types';

interface AlertsState {
  alerts: AlertData[];
  unreadCount: number;
  hasActiveAog: boolean;

  // Actions
  addAlert: (alert: AlertData) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  resolveAlert: (id: string) => void;
  setAlerts: (alerts: AlertData[]) => void;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  hasActiveAog: false,

  addAlert: (alert) => {
    const current = get().alerts;
    // Deduplicate by id
    if (current.some((a) => a.id === alert.id)) return;

    const updated = [alert, ...current];
    set({
      alerts: updated,
      unreadCount: updated.filter((a) => !a.isRead && !a.isResolved).length,
      hasActiveAog: updated.some(
        (a) => a.type === 'AOG' && !a.isResolved
      ),
    });
  },

  markRead: (id) => {
    const updated = get().alerts.map((a) =>
      a.id === id ? { ...a, isRead: true } : a
    );
    set({
      alerts: updated,
      unreadCount: updated.filter((a) => !a.isRead && !a.isResolved).length,
    });
  },

  markAllRead: () => {
    const updated = get().alerts.map((a) => ({ ...a, isRead: true }));
    set({ alerts: updated, unreadCount: 0 });
  },

  resolveAlert: (id) => {
    const updated = get().alerts.map((a) =>
      a.id === id ? { ...a, isResolved: true, isRead: true } : a
    );
    set({
      alerts: updated,
      unreadCount: updated.filter((a) => !a.isRead && !a.isResolved).length,
      hasActiveAog: updated.some((a) => a.type === 'AOG' && !a.isResolved),
    });
  },

  setAlerts: (alerts) => {
    set({
      alerts,
      unreadCount: alerts.filter((a) => !a.isRead && !a.isResolved).length,
      hasActiveAog: alerts.some((a) => a.type === 'AOG' && !a.isResolved),
    });
  },
}));
