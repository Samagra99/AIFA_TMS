import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '../../../theme';
import { useAircraft } from '../../../api/hooks';
import { Card, CardHeader, CardTitle, DeferredDefectsSection, AircraftStatusPill } from '../../../components/ui';

export default function MaintenanceScreen() {
  const { colors, fonts, fontSizes, spacing } = useTheme();
  const { data: aircraftResp, isLoading, refetch } = useAircraft();
  const aircraftList = aircraftResp?.results || (Array.isArray(aircraftResp) ? aircraftResp : []);
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
    title: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.xl,
      color: colors.text,
      marginBottom: spacing.md,
    },
    card: {
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    aircraftRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tailNumber: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.md,
      color: colors.text,
    },
    hoursText: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.sm,
      color: colors.subtext,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Maintenance & CAMO Dashboard</Text>
        
        <DeferredDefectsSection />

        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Fleet Maintenance Countdown</CardTitle>
          </CardHeader>
          {aircraftList.map((ac: any) => (
            <View key={ac.id} style={styles.aircraftRow}>
              <View>
                <Text style={styles.tailNumber}>{ac.tail_number}</Text>
                <Text style={styles.hoursText}>Hobbs: {ac.hobbs_total} hrs | 50h due: {ac.next_50hr_at || 'N/A'}</Text>
              </View>
              <AircraftStatusPill status={ac.status} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
