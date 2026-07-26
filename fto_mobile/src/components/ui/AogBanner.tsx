import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineQuery } from '../../db';
import { apiClient } from '../../api/client';
import { useTheme } from '../../theme';
import { Aircraft } from '../../types';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

export function AogBanner() {
  const { colors } = useTheme();
  const router = useRouter();
  const authState = useAuthStore();

  const { data: aircraft } = useOfflineQuery<Aircraft[]>(
    ['aircraft', 'all'],
    async () => {
      const res = await apiClient.get('/infrastructure/aircraft/');
      return res.data?.results || res.data || [];
    },
    {
      queryKey: ['aircraft', 'all'],
      cacheKey: 'aircraft:all',
      refetchInterval: 60000,
    }
  );

  if (!aircraft || !authState.accessToken) return null;

  // Find AOG aircraft for the user's base, or all if superadmin/camo
  const aogAircraft = aircraft.filter(
    a => a.status === 'aog' && 
    (authState.user?.role === 'superadmin' || authState.user?.role === 'camo' || a.current_base === authState.user?.home_base_id)
  );

  if (aogAircraft.length === 0) return null;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: colors.aog }]}
      onPress={() => router.push('/(app)/(tabs)/fleet')}
    >
      <View style={styles.content}>
        <Ionicons name="warning" size={16} color="#ffffff" />
        <Text style={styles.text}>
          {aogAircraft.length === 1
            ? `AOG ALERT: ${aogAircraft[0].tail_number} is out of service`
            : `AOG ALERT: ${aogAircraft.length} aircraft are out of service`}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#ffffff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
    zIndex: 40,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
});
