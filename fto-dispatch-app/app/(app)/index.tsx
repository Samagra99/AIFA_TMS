import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlightCard } from '../../src/components/FlightCard';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { SyncStatusBar } from '../../src/components/SyncStatusBar';
import { useFlights } from '../../src/hooks/useFlights';
import { useAlertsStore } from '../../src/store/alerts.store';
import { useAuthStore } from '../../src/store/auth.store';
import { Flight } from '../../src/db/models/Flight';
import { C, FLIGHT_STATUS_COLOR } from '../../src/theme/colors';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { flights, isLoading, isSyncing, lastSyncedAt, refresh } = useFlights();
  const { hasActiveAog, alerts, unreadCount } = useAlertsStore();
  const { user, logout } = useAuthStore();

  // Determine which flights are affected by active AOG
  const aogAircraftRegs = new Set(
    alerts
      .filter((a) => a.type === 'AOG' && !a.isResolved && a.aircraftRegistration)
      .map((a) => a.aircraftRegistration!)
  );

  const handleFlightPress = useCallback(
    (flight: Flight) => {
      router.push(`/dispatch/${flight.id}`);
    },
    [router]
  );

  // Stats for the header cards
  const stats = {
    total: flights.length,
    dispatched: flights.filter((f) => f.status === 'DISPATCHED' || f.status === 'AIRBORNE').length,
    pending: flights.filter((f) => f.status === 'SCHEDULED').length,
    complete: flights.filter((f) => f.status === 'COMPLETE').length,
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>TODAY'S DISPATCH</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.userBtn}>
          <Ionicons name="person-circle-outline" size={28} color={C.textMuted} />
        </TouchableOpacity>
      </View>

      <OfflineBanner />

      <SyncStatusBar
        isSyncing={isSyncing}
        lastSyncedAt={lastSyncedAt}
        onRefresh={refresh}
      />

      {/* ── AOG banner ──────────────────────────────────────────────── */}
      {hasActiveAog && (
        <TouchableOpacity
          style={styles.aogBanner}
          onPress={() => router.push('/(app)/alerts')}
          activeOpacity={0.85}
        >
          <View style={styles.aogBannerLeft}>
            <Ionicons name="warning" size={20} color="#fff" />
            <View>
              <Text style={styles.aogBannerTitle}>⚠ AOG ACTIVE</Text>
              <Text style={styles.aogBannerSub}>
                {aogAircraftRegs.size} aircraft grounded — tap to view
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <StatPill label="Total" value={stats.total} color={C.textSecondary} />
        <StatPill label="Pending" value={stats.pending} color={C.info} />
        <StatPill label="Active" value={stats.dispatched} color={C.amber} />
        <StatPill label="Done" value={stats.complete} color={C.go} />
      </View>

      {/* ── Flight list ──────────────────────────────────────────────── */}
      <FlatList
        data={flights}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => (
          <FlightCard
            flight={item}
            onPress={handleFlightPress}
            isAogAffected={aogAircraftRegs.has(item.aircraftRegistration)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={refresh}
            tintColor={C.amber}
            colors={[C.amber]}
          />
        }
        ListEmptyComponent={
          <EmptyState isLoading={isLoading} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
      />
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ isLoading }: { isLoading: boolean }) {
  return (
    <View style={styles.empty}>
      <Ionicons
        name={isLoading ? 'sync-outline' : 'calendar-outline'}
        size={48}
        color={C.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {isLoading ? 'Loading flights…' : 'No flights scheduled today'}
      </Text>
      <Text style={styles.emptySub}>
        {isLoading
          ? 'Fetching from server'
          : 'Pull down to refresh or check tomorrows roster'}
      </Text>
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
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLabel: {
    color: C.amber,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  headerDate: {
    color: C.textPrimary,
    fontSize: isTablet ? 20 : 17,
    fontWeight: '700',
    marginTop: 2,
  },
  userBtn: { padding: 4 },
  aogBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.aog,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  aogBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aogBannerTitle: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  aogBannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statPill: {
    flex: 1,
    backgroundColor: C.bgCard,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  statValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: C.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  list: { paddingBottom: 32, paddingTop: 4 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 },
  emptyTitle: { color: C.textSecondary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: C.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
