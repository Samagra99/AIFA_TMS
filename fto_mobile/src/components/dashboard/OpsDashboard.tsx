import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useDailyRoster, useFleetStatus, useWeatherLatest } from '../../api/hooks';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme';
import { Card, CardHeader, CardTitle, Badge, Spinner, DeferredDefectsSection } from '../ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Flight, Aircraft } from '../../types';
import { fmt } from '../../lib/utils';

export const OpsDashboard = () => {
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().split('T')[0];
  const { data: flights, isLoading: rosterLoading, refetch: refetchRoster } = useDailyRoster(today);
  const { data: fleet, isLoading: fleetLoading, refetch: refetchFleet } = useFleetStatus();
  
  const user = useAuthStore(s => s.user);
  const { data: weather } = useWeatherLatest(undefined, user?.home_base_id || undefined);
  
  const theme = useTheme();
  const styles = createStyles(theme);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const utcTime = now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
  const istTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

  const isLoading = rosterLoading || fleetLoading;

  const onRefresh = () => {
    refetchRoster();
    refetchFleet();
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Spinner size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Calculate stats
  const flightList: Flight[] = flights || [];
  const activeFlights = flightList.filter((f: Flight) => !['cancelled', 'aborted', 'draft'].includes(f.status));
  const totalFlights = activeFlights.length;

  const fleetList: Aircraft[] = fleet || [];
  const airworthy = fleetList.filter(a => a.status === 'airworthy').length;
  const aogCount = fleetList.filter(a => a.status === 'aog' || (a as any).is_overdue || (a as any).has_overdue_snag).length;
  const ferryTriggered = fleetList.filter(a => (a as any).ferry_buffer_triggered).length;
  
  const aogAircraft = fleetList.filter(a => a.status === 'aog' || (a as any).is_overdue || (a as any).has_overdue_snag);
  const maintenanceAircraft = fleetList.filter(a => a.status === 'scheduled_maintenance');
  const ferryAlerts = fleetList.filter(a => (a as any).ferry_buffer_triggered && a.status !== 'aog');

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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Ops Overview</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          </View>
          <View style={styles.clockContainer}>
            <View style={styles.clockCol}>
              <Text style={styles.clockTime}>{utcTime}Z</Text>
              <Text style={styles.clockLabel}>UTC</Text>
            </View>
            <View style={styles.clockDivider} />
            <View style={styles.clockCol}>
              <Text style={styles.clockTime}>{istTime}</Text>
              <Text style={styles.clockLabel}>IST</Text>
            </View>
            <View style={styles.clockDivider} />
            <View style={styles.clockCol}>
              <Text style={styles.clockTime}>{weather?.visibility_m ? `${weather.visibility_m}m` : 'N/A'}</Text>
              <Text style={styles.clockLabel}>VISIBILITY</Text>
            </View>
          </View>
        </View>

        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Airworthy</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.success }]}>{airworthy}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>AOG</Text>
            <Text style={[styles.kpiValue, { color: aogCount > 0 ? theme.colors.danger : theme.colors.subtext }]}>{aogCount}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Ferry Due</Text>
            <Text style={[styles.kpiValue, { color: ferryTriggered > 0 ? theme.colors.warning : theme.colors.subtext }]}>{ferryTriggered}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Flights Today</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.primary }]}>{totalFlights}</Text>
          </View>
        </View>

        {/* Ferry Alerts */}
        {ferryAlerts.length > 0 && (
          <Card style={StyleSheet.flatten([styles.section, { borderColor: theme.colors.warning, borderWidth: 1 }])}>
            <CardHeader>
              <CardTitle>⚠ Ferry Buffer Alerts</CardTitle>
            </CardHeader>
            {ferryAlerts.map(a => (
              <View key={a.id} style={styles.ferryRow}>
                <Badge variant="warning">{a.tail_number}</Badge>
                <Text style={styles.ferryReason}>
                  {(a as any).hours_to_next_inspection ? `${Number((a as any).hours_to_next_inspection).toFixed(1)} hr to next inspection. ` : ''}Return to hub required.
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>Grounded & In Maintenance</CardTitle>
          </CardHeader>
          
          {aogAircraft.length === 0 && maintenanceAircraft.length === 0 ? (
            <Text style={styles.emptyText}>All aircraft are currently serviceable.</Text>
          ) : (
            <>
              {aogAircraft.map((a: any) => (
                <View key={a.id} style={styles.aogRow}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <Badge variant="danger">{a.tail_number}</Badge>
                    <Text style={styles.aogReason}>{a.aog_reason || 'Overdue Defect'}</Text>
                  </View>
                </View>
              ))}
              {maintenanceAircraft.map((a: any) => (
                <View key={a.id} style={styles.maintRow}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <Badge variant="warning">{a.tail_number}</Badge>
                    <Text style={styles.aogReason}>{a.aog_reason || 'Scheduled Maintenance'}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </Card>

        {/* Deferred Defect Section */}
        <DeferredDefectsSection />

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
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
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
    clockContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    clockCol: {
      alignItems: 'center',
    },
    clockTime: {
      fontFamily: theme.fonts.mono,
      fontWeight: 'bold',
      fontSize: theme.fontSizes.sm,
      color: theme.colors.text,
    },
    clockLabel: {
      fontSize: 9,
      fontWeight: 'bold',
      color: theme.colors.subtext,
      letterSpacing: 1,
    },
    clockDivider: {
      width: 1,
      height: 20,
      backgroundColor: theme.colors.border,
      marginHorizontal: 12,
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
    },
    section: {
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    emptyText: {
      fontFamily: theme.fonts.regular,
      fontSize: theme.fontSizes.md,
      color: theme.colors.subtext,
      marginTop: theme.spacing.sm,
    },
    aogRow: {
      flexDirection: 'column',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      padding: 12,
      backgroundColor: theme.colors.dangerLight,
      borderColor: theme.colors.danger,
      borderWidth: 1,
      borderRadius: 8,
    },
    maintRow: {
      flexDirection: 'column',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      padding: 12,
      backgroundColor: theme.colors.warningLight,
      borderColor: theme.colors.warning,
      borderWidth: 1,
      borderRadius: 8,
    },
    aogReason: {
      fontFamily: theme.fonts.regular,
      fontSize: theme.fontSizes.sm,
      color: theme.colors.text,
      flex: 1,
    },
    ferryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    ferryReason: {
      fontFamily: theme.fonts.regular,
      fontSize: theme.fontSizes.sm,
      color: theme.colors.text,
      flex: 1,
    }
  });
