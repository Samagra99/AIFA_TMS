import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '../../../theme';
import { useStudentSummary } from '../../../api/hooks';
import { useAuthStore } from '../../../stores/authStore';

export default function LogbookScreen() {
  const { colors, fonts, fontSizes, spacing } = useTheme();
  const user = useAuthStore((state: any) => state.user);
  const { data: summary, isLoading, refetch } = useStudentSummary();
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
    </SafeAreaView>
  );
}
