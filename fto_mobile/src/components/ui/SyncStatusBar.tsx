/**
 * Connectivity & Sync Status Bar.
 * 
 * Renders a small banner at the top/bottom of the screen when offline
 * or when there are pending mutations waiting to sync.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSyncStatus, manualSync } from '../../db';
import { useTheme } from '../../theme';
import { Spinner } from './Spinner';

export function SyncStatusBar() {
  const { isOnline, isSyncing, pendingCount } = useSyncStatus();
  const { colors } = useTheme();

  // If online, fully synced, and not syncing — hide the bar
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  const bgColor = isOnline ? colors.primary : colors.warning;
  const textColor = isOnline ? '#ffffff' : '#000000';
  const iconName = isOnline ? 'cloud-upload-outline' : 'cloud-offline-outline';

  return (
    <Pressable
      onPress={isOnline ? () => manualSync() : undefined}
      style={[styles.container, { backgroundColor: bgColor }]}
    >
      <View style={styles.content}>
        {isSyncing ? (
          <Spinner color={textColor} size="small" />
        ) : (
          <Ionicons name={iconName} size={16} color={textColor} />
        )}
        <Text style={[styles.text, { color: textColor }]}>
          {!isOnline
            ? `Offline — ${pendingCount > 0 ? `${pendingCount} pending updates` : 'Read-only mode'}`
            : isSyncing
            ? 'Syncing changes...'
            : `${pendingCount} updates waiting to sync`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    width: '100%',
    zIndex: 50,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
