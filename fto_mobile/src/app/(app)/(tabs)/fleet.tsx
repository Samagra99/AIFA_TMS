import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, SafeAreaView } from 'react-native';
import { useTheme } from '../../../theme';
import { useAircraft } from '../../../api/hooks';
import { AircraftStatusPill, DeferredDefectsSection } from '../../../components/ui';

export default function FleetScreen() {
  const { colors, fonts, fontSizes, spacing } = useTheme();
  const { data: aircraftResp, isLoading, refetch } = useAircraft();
  const aircraft = aircraftResp?.results || aircraftResp || [];
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
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
    aogCard: {
      borderColor: colors.danger,
      borderWidth: 2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.lg,
      color: colors.text,
    },
    model: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.md,
      color: colors.subtext,
      marginBottom: spacing.sm,
    },
    detailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    detailText: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.sm,
      color: colors.text,
    },
  });

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, (item.status === 'aog' || item.status === 'AOG') && styles.aogCard]}>
      <View style={styles.header}>
        <Text style={styles.title}>{item.tail_number}</Text>
        <AircraftStatusPill status={item.status} />
      </View>
      <Text style={styles.model}>{item.make_model || item.aircraft_type_name}</Text>
      <View style={styles.detailsRow}>
        <Text style={styles.detailText}>Base: {item.current_base_name || item.home_base_name || 'N/A'}</Text>
        <Text style={styles.detailText}>Hobbs: {item.hobbs_total}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={Array.isArray(aircraft) ? aircraft : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<DeferredDefectsSection />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
}
