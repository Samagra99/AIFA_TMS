import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useDailyRoster, useMaintenanceOverview } from '../../api/hooks';
import { useTheme } from '../../theme';
import { Card, CardHeader, CardTitle, Badge, Spinner } from '../ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Flight } from '../../types';

export const OpsDashboard = () => {
  const today = new Date().toISOString().split('T')[0];
  const { data: flights, isLoading: rosterLoading, refetch: refetchRoster } = useDailyRoster(today);
  const { data: maintenance, isLoading: maintLoading, refetch: refetchMaint } = useMaintenanceOverview();
  const theme = useTheme();
  const styles = createStyles(theme);

  const isLoading = rosterLoading || maintLoading;

  const onRefresh = () => {
    refetchRoster();
    refetchMaint();
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Spinner size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Calculate stats from roster
  const flightList: Flight[] = flights || [];
  const totalFlights = flightList.length;
  const pendingDispatch = flightList.filter((f: Flight) => f.status === 'confirmed').length;
  const airborne = flightList.filter((f: Flight) => f.status === 'airborne').length;
  const completed = flightList.filter((f: Flight) => f.status === 'completed').length;

  const aogAircraft = (maintenance?.aircraft || maintenance?.results || []).filter((a: any) => a.status === 'AOG' || a.status === 'aog');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Ops Overview</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString()}</Text>
        </View>

        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Flights</Text>
            <Text style={styles.kpiValue}>{totalFlights}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pending</Text>
            <Text style={styles.kpiValue}>{pendingDispatch}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Airborne</Text>
            <Text style={styles.kpiValue}>{airborne}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Completed</Text>
            <Text style={styles.kpiValue}>{completed}</Text>
          </View>
        </View>

        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>AOG Aircraft</CardTitle>
          </CardHeader>
          <View style={styles.aogContainer}>
            {aogAircraft.length === 0 ? (
              <Text style={styles.emptyText}>No aircraft currently AOG.</Text>
            ) : (
              aogAircraft.map((ac: any, index: number) => (
                <View key={index} style={styles.aogRow}>
                  <Text style={styles.acReg}>{ac.tail_number || ac.registration}</Text>
                  <Badge variant="danger">AOG</Badge>
                </View>
              ))
            )}
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  greeting: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  date: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
    color: theme.colors.subtext,
    marginBottom: theme.spacing.sm,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  kpiCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    width: '48%',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kpiLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.subtext,
    fontFamily: theme.fonts.medium,
  },
  kpiValue: {
    fontSize: theme.fontSizes.xl,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    marginTop: 4,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  aogContainer: {
    marginTop: theme.spacing.sm,
  },
  aogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  acReg: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text,
  },
  emptyText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.subtext,
  }
});
