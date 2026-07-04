import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AircraftCard } from '../../src/components/AircraftCard';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { SyncStatusBar } from '../../src/components/SyncStatusBar';
import { useAircraftFleet } from '../../src/hooks/useAircraftFleet';
import { C } from '../../src/theme/colors';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

const BASE_LABELS: Record<string, { label: string; icon: string }> = {
  AMRAVATI: { label: 'Amravati Hub', icon: '🛖' },
  SAT1: { label: 'Satellite Base 1', icon: '📡' },
  SAT2: { label: 'Satellite Base 2', icon: '📡' },
};

export default function FleetScreen() {
  const insets = useSafeAreaInsets();
  const { aircraft, byBase, stats, isLoading, isSyncing, refresh } = useAircraftFleet();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>FLEET STATUS</Text>
          <Text style={styles.headerSub}>{stats.total} aircraft · 3 bases</Text>
        </View>
        <View style={styles.headerStats}>
          <MiniStat count={stats.serviceable} color={C.go} label="SVC" />
          <MiniStat count={stats.aog} color={C.aog} label="AOG" />
          <MiniStat count={stats.maintenance} color={C.caution} label="MX" />
        </View>
      </View>

      <OfflineBanner />
      <SyncStatusBar isSyncing={isSyncing} lastSyncedAt={null} onRefresh={refresh} />

      {/* Fleet grid */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={refresh}
            tintColor={C.amber}
            colors={[C.amber]}
          />
        }
      >
        {/* Ferry block callout */}
        {stats.ferryBlocked > 0 && (
          <View style={styles.ferryCallout}>
            <Ionicons name="airplane" size={16} color={C.caution} />
            <Text style={styles.ferryCalloutText}>
              {stats.ferryBlocked} aircraft at satellite base{stats.ferryBlocked > 1 ? 's' : ''} need
              ferrying before next training sortie (remaining hours ≤ ferry buffer)
            </Text>
          </View>
        )}

        {/* Bases */}
        {(['AMRAVATI', 'SAT1', 'SAT2'] as const).map((base) => {
          const fleet = byBase[base] ?? [];
          if (fleet.length === 0) return null;
          const { label, icon } = BASE_LABELS[base] ?? { label: base, icon: '✈️' };

          return (
            <View key={base} style={styles.baseSection}>
              <View style={styles.baseHeader}>
                <Text style={styles.baseIcon}>{icon}</Text>
                <Text style={styles.baseLabel}>{label}</Text>
                <View style={styles.baseCount}>
                  <Text style={styles.baseCountText}>{fleet.length}</Text>
                </View>
              </View>

              <View style={styles.cards}>
                {fleet.map((ac) => (
                  <AircraftCard key={ac.id} aircraft={ac} />
                ))}
              </View>
            </View>
          );
        })}

        {aircraft.length === 0 && !isLoading && (
          <View style={styles.empty}>
            <Ionicons name="airplane-outline" size={48} color={C.textMuted} />
            <Text style={styles.emptyText}>No fleet data — pull down to sync</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function MiniStat({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniValue, { color }]}>{count}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLabel: { color: C.amber, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  headerSub: { color: C.textSecondary, fontSize: 16, fontWeight: '700', marginTop: 2 },
  headerStats: { flexDirection: 'row', gap: 16 },
  miniStat: { alignItems: 'center', gap: 2 },
  miniValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  miniLabel: { color: C.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  scroll: { padding: 12 },
  ferryCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.cautionMuted,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${C.caution}44`,
  },
  ferryCalloutText: { color: C.caution, fontSize: 13, lineHeight: 18, flex: 1 },
  baseSection: { marginBottom: 20 },
  baseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  baseIcon: { fontSize: 16 },
  baseLabel: { color: C.textSecondary, fontSize: 14, fontWeight: '700', flex: 1 },
  baseCount: {
    backgroundColor: C.bgElevated,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  baseCountText: { color: C.textMuted, fontSize: 11, fontWeight: '700' },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -2,
  },
  empty: { alignItems: 'center', padding: 48, gap: 12 },
  emptyText: { color: C.textMuted, fontSize: 14, textAlign: 'center' },
});
