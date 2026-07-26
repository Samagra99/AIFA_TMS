import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useDailyRoster } from '../../../api/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useTheme } from '../../../theme';
import { Card, FlightStatusPill, Spinner } from '../../../components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Flight } from '../../../types';

export default function DispatchScreen() {
  const today = new Date().toISOString().split('T')[0];
  const { data: roster, isLoading, refetch } = useDailyRoster(today);
  const user = useAuthStore((state: any) => state.user);
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const [filter, setFilter] = useState<'all' | 'confirmed' | 'dispatched' | 'airborne'>('all');

  if (isLoading && !roster) {
    return (
      <View style={styles.center}>
        <Spinner size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Filter flights by role
  let flights: Flight[] = Array.isArray(roster) ? roster : [];
  if (user?.role === 'instructor') {
    flights = flights.filter((f: Flight) => f.instructor === user.id || f.instructor_user_id === user.id);
  } else if (user?.role === 'student') {
    flights = flights.filter((f: Flight) => f.student === user.id || f.student_user_id === user.id);
  }
  
  // Filter by status tab
  if (filter !== 'all') {
    flights = flights.filter((f: Flight) => f.status === filter);
  }

  const formatTime = (iso?: string) => {
    if (!iso) return '--:--';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Dispatch Queue</Text>
      </View>
      
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['all', 'confirmed', 'dispatched', 'airborne'].map(status => (
            <TouchableOpacity 
              key={status} 
              style={[styles.filterBtn, filter === status && styles.filterBtnActive]}
              onPress={() => setFilter(status as any)}
            >
              <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
                {status.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        {flights.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No flights found.</Text>
          </View>
        ) : (
          flights.map((flight: Flight) => (
            <TouchableOpacity 
              key={flight.id} 
              onPress={() => router.push(`/(app)/dispatch/${flight.id}` as any)}
              activeOpacity={0.7}
            >
              <Card style={styles.flightCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.tailNumber}>{flight.aircraft_name || flight.aircraft_detail?.tail_number || 'VT-TBA'}</Text>
                  <FlightStatusPill status={flight.status} />
                </View>
                
                <View style={styles.cardBody}>
                  <View style={styles.crewRow}>
                    <Text style={styles.label}>Crew: </Text>
                    <Text style={styles.value}>
                      {flight.instructor_name || 'No CFI'} / {flight.student_name || 'No Student'}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.label}>Type:</Text>
                      <Text style={styles.value}>{flight.flight_type?.replace(/_/g, ' ')}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.label}>Time:</Text>
                      <Text style={styles.value}>{formatTime(flight.scheduled_start)} - {formatTime(flight.scheduled_end)}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  filters: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterScroll: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 16,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.subtext,
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: theme.spacing.md,
  },
  flightCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  tailNumber: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text,
  },
  cardBody: {
    marginTop: theme.spacing.xs,
  },
  crewRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  label: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.subtext,
  },
  value: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  emptyState: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.md,
    color: theme.colors.subtext,
  }
});
