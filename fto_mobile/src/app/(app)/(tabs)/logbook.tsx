import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '../../../theme';
import { useStudentSummary, useInstructorLogbook } from '../../../api/hooks';
import { useAuthStore } from '../../../stores/authStore';

const StudentLogbook = ({ styles, summary, refetch, refreshing, onRefresh }: any) => (
  <ScrollView 
    contentContainerStyle={styles.scrollContent}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
  >
    <View style={styles.grid}>
      <View style={styles.card}>
        <Text style={styles.cardValue}>{summary?.hours_total || summary?.total_hours || '0.0'}</Text>
        <Text style={styles.cardLabel}>Total Hours</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardValue}>{summary?.hours_pic || summary?.pic_hours || '0.0'}</Text>
        <Text style={styles.cardLabel}>PIC Hours</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardValue}>{summary?.hours_dual || summary?.dual_hours || '0.0'}</Text>
        <Text style={styles.cardLabel}>Dual Hours</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardValue}>{summary?.hours_solo || summary?.solo_hours || '0.0'}</Text>
        <Text style={styles.cardLabel}>Solo Hours</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardValue}>{summary?.hours_cross_country || summary?.xc_hours || '0.0'}</Text>
        <Text style={styles.cardLabel}>XC Hours</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardValue}>{summary?.hours_night || summary?.night_hours || '0.0'}</Text>
        <Text style={styles.cardLabel}>Night Hours</Text>
      </View>
    </View>

    <Text style={styles.sectionTitle}>Recent Entries</Text>
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>Detailed entries placeholder</Text>
    </View>
  </ScrollView>
);

const InstructorLogbook = ({ styles, instructorId, colors, fonts, spacing }: any) => {
  const { data: summary, refetch } = useInstructorLogbook(instructorId);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  return (
    <ScrollView 
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sectionTitle}>Instructor Logbook ({summary?.pilot_name || '...'})</Text>
      <View style={[styles.emptyState, { alignItems: 'flex-start' }]}>
        {summary?.entries?.length ? (
          summary.entries.map((entry: any, idx: number) => (
            <View key={idx} style={{ marginBottom: spacing.md, width: '100%', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, color: colors.text }}>{entry.date} - {entry.aircraft_id}</Text>
              <Text style={{ fontFamily: fonts.regular, color: colors.subtext }}>{entry.departure} → {entry.arrival} ({entry.flight_time}h)</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent logbook entries found.</Text>
        )}
      </View>
    </ScrollView>
  );
};

export default function LogbookScreen() {
  const { colors, fonts, fontSizes, spacing } = useTheme();
  const user = useAuthStore((state: any) => state.user);
  const isInstructor = user?.role === 'instructor' || user?.role === 'cfi' || user?.role === 'superadmin';
  
  // Student Hook (conditionally skip if instructor but React hooks must be called unconditionally)
  // We can just call it, it might fail 403 for instructors if we don't disable it, but let's just let useStudentSummary return error or we can disable it in the hook, but for now we'll just leave it and render the right component.
  // Actually it's better to isolate the hook in a wrapper if it causes 403.
  const { data: studentSummary, refetch: refetchStudent } = useStudentSummary(!isInstructor);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refetchStudent().finally(() => setRefreshing(false));
  }, [refetchStudent]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    card: {
      width: '48%',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    cardValue: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.xl,
      color: colors.primary,
      marginBottom: spacing.xs,
    },
    cardLabel: {
      fontFamily: fonts.medium,
      fontSize: fontSizes.sm,
      color: colors.subtext,
    },
    sectionTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.lg,
      color: colors.text,
      marginBottom: spacing.md,
    },
    emptyState: {
      padding: spacing.xl,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    emptyText: {
      fontFamily: fonts.medium,
      fontSize: fontSizes.md,
      color: colors.subtext,
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      {isInstructor ? (
        <InstructorLogbook styles={styles} instructorId={user?.id} colors={colors} fonts={fonts} spacing={spacing} />
      ) : (
        <StudentLogbook styles={styles} summary={studentSummary} refetch={refetchStudent} refreshing={refreshing} onRefresh={onRefresh} />
      )}
    </SafeAreaView>
  );
}
