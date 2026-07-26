import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, RefreshControl } from 'react-native';
import { useTheme } from '../../../theme';
import { useDailyRoster } from '../../../api/hooks';
import { FlightStatusPill } from '../../../components/ui';

export default function ScheduleScreen() {
  const { colors, fonts, fontSizes, spacing } = useTheme();
  // Using today as default for daily roster
  const today = new Date().toISOString().split('T')[0];
  const { data: flights = [], isLoading, refetch } = useDailyRoster(today);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      padding: spacing.md,
    },
    card: {
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: spacing.md,
    },
    time: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.md,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    details: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.sm,
      color: colors.subtext,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    emptyState: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      fontFamily: fonts.medium,
      fontSize: fontSizes.md,
      color: colors.subtext,
    }
  });

  const formatTime = (iso?: string) => {
    if (!iso) return '--:--';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.time}>{formatTime(item.scheduled_start)} - {formatTime(item.scheduled_end)}</Text>
          <Text style={styles.details}>{item.flight_type} • {item.aircraft_name || item.aircraft?.tail_number || 'Aircraft'}</Text>
          <Text style={styles.details}>Instructor: {item.instructor_name || 'Assigned'}</Text>
        </View>
        <FlightStatusPill status={item.status || 'scheduled'} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={Array.isArray(flights) ? flights : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No flights scheduled for today</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
