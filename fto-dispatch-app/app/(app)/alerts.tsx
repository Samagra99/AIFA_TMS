import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { Ionicons } from '@expo/vector-icons';
import { AlertCard } from '../../src/components/AlertCard';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { useAlertsStore } from '../../src/store/alerts.store';
import { alertsCollection } from '../../src/db';
import { FtoAlert } from '../../src/db/models/FtoAlert';
import { AlertData } from '../../src/types';
import { pullAll } from '../../src/services/sync.service';
import { C } from '../../src/theme/colors';

type Tab = 'active' | 'resolved';

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('active');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { setAlerts, markAllRead, unreadCount } = useAlertsStore();
  const [dbAlerts, setDbAlerts] = useState<FtoAlert[]>([]);

  // Observe alerts from WatermelonDB
  useEffect(() => {
    const subscription = alertsCollection
      .query(Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe((results) => {
        setDbAlerts(results);
        // Hydrate Zustand store
        const mapped: AlertData[] = results.map((a) => ({
          id: a.id,
          remoteId: a.remoteId || null,
          type: a.type as AlertData['type'],
          severity: a.severity as AlertData['severity'],
          title: a.title,
          message: a.message,
          aircraftRegistration: a.aircraftRegistration || null,
          affectedFlightsCount: a.affectedFlightsCount,
          isRead: a.isRead,
          isResolved: a.isResolved,
          createdAt: a.createdAt,
        }));
        setAlerts(mapped);
      });

    return () => subscription.unsubscribe();
  }, [setAlerts]);

  const active = dbAlerts.filter((a) => !a.isResolved);
  const resolved = dbAlerts.filter((a) => a.isResolved);
  const displayed = tab === 'active' ? active : resolved;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await pullAll();
    } finally {
      setIsRefreshing(false);
    }
  };

  const alertDataForCard = (a: FtoAlert): AlertData => ({
    id: a.id,
    remoteId: a.remoteId || null,
    type: a.type as AlertData['type'],
    severity: a.severity as AlertData['severity'],
    title: a.title,
    message: a.message,
    aircraftRegistration: a.aircraftRegistration || null,
    affectedFlightsCount: a.affectedFlightsCount,
    isRead: a.isRead,
    isResolved: a.isResolved,
    createdAt: a.createdAt,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>OPERATIONS ALERTS</Text>
          <Text style={styles.headerSub}>
            {active.length} active · {resolved.length} resolved
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Ionicons name="checkmark-done-outline" size={16} color={C.amber} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <OfflineBanner />

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['active', 'resolved'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'active' ? `Active (${active.length})` : `Resolved (${resolved.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Alert list */}
      <FlatList
        data={displayed}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AlertCard alert={alertDataForCard(item)} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={C.amber}
            colors={[C.amber]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={tab === 'active' ? 'checkmark-circle-outline' : 'archive-outline'}
              size={48}
              color={C.go}
            />
            <Text style={styles.emptyTitle}>
              {tab === 'active' ? 'No active alerts' : 'No resolved alerts'}
            </Text>
            <Text style={styles.emptySub}>
              {tab === 'active'
                ? 'All systems nominal — no AOG or safety alerts'
                : 'Resolved alerts will appear here'}
            </Text>
          </View>
        }
      />
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
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  markAllText: { color: C.amber, fontSize: 13, fontWeight: '600' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bgCard,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: C.amber },
  tabText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: C.amber, fontWeight: '700' },
  list: { paddingVertical: 8, paddingBottom: 32 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 },
  emptyTitle: { color: C.textSecondary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: C.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
