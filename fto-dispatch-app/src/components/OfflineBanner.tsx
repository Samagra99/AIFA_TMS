import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { C } from '../theme/colors';

export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const offline = !isConnected || !isInternetReachable;

  if (!offline) return null;

  return (
    <View style={styles.bar}>
      <Ionicons name="cloud-offline-outline" size={14} color={C.caution} />
      <Text style={styles.text}>
        OFFLINE — all changes saved locally and will sync when connected
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cautionMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  text: {
    color: C.caution,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
