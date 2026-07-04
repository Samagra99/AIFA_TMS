import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme/colors';

interface SyncStatusBarProps {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  onRefresh?: () => void;
}

export function SyncStatusBar({ isSyncing, lastSyncedAt, onRefresh }: SyncStatusBarProps) {
  const label = isSyncing
    ? 'Syncing…'
    : lastSyncedAt
    ? `Synced ${relativeTime(lastSyncedAt)}`
    : 'Not yet synced';

  return (
    <View style={styles.bar}>
      {isSyncing ? (
        <ActivityIndicator size={12} color={C.info} />
      ) : (
        <Ionicons
          name={lastSyncedAt ? 'checkmark-circle-outline' : 'sync-outline'}
          size={13}
          color={lastSyncedAt ? C.go : C.textMuted}
        />
      )}
      <Text style={styles.label}>{label}</Text>

      {!isSyncing && onRefresh && (
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={14} color={C.amber} />
          <Text style={styles.refreshLabel}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  label: {
    color: C.textMuted,
    fontSize: 11,
    flex: 1,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshLabel: {
    color: C.amber,
    fontSize: 11,
    fontWeight: '600',
  },
});
