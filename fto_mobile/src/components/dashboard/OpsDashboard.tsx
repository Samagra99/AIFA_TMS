import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useDailyRoster, useMaintenanceOverview } from '../../api/hooks';
import { useTheme } from '../../theme';
import { Card, CardHeader, CardTitle, Badge, Spinner } from '../ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Flight } from '../../types';

export const OpsDashboard = () => {
  const insets = useSafeAreaInsets();
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top + 8, 20) }
        ]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Ops Overview</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
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

        <Card style={styles.aogCard}>
          <CardHeader>
            <CardTitle>AOG Aircraft</CardTitle>
          </CardHeader>
          {aogAircraft.length === 0 ? (
            <Text style={styles.noAogText}>No aircraft currently AOG.</Text>
          ) : (
            aogAircraft.map((a: any) => (
              <View key={a.id} style={styles.aogRow}>
                <Badge variant="danger">{a.tail_number}</Badge>
                <Text style={styles.aogReason}>{a.aog_reason || 'Unscheduled Maintenance'}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: theme.spacing.md,
      paddingBottom: 40,
    },
    header: {
      marginBottom: theme.spacing.md,
    },
    greeting: {
      fontFamily: theme.fonts.bold,
      fontSize: theme.fontSizes.xl,
      color: theme.colors.text,
    },
    date: {
      fontFamily: theme.fonts.regular,
      fontSize: theme.fontSizes.sm,
      color: theme.colors.subtext,
    },
    kpiContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    kpiCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: theme.spacing.md,
      alignItems: 'center',
    },
    kpiLabel: {
      fontFamily: theme.fonts.medium,
      fontSize: theme.fontSizes.sm,
      color: theme.colors.subtext,
      marginBottom: 4,
    },
    kpiValue: {
      fontFamily: theme.fonts.bold,
      fontSize: theme.fontSizes.xxl,
      color: theme.colors.text,
    },
    aogCard: {
      padding: theme.spacing.md,
    },
    noAogText: {
      fontFamily: theme.fonts.regular,
      fontSize: theme.fontSizes.md,
      color: theme.colors.subtext,
      marginTop: theme.spacing.sm,
    },
    aogRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    aogReason: {
      fontFamily: theme.fonts.regular,
      fontSize: theme.fontSizes.sm,
      color: theme.colors.text,
      flex: 1,
    },
  });
