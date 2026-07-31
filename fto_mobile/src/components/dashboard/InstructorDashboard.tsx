/**
 * Instructor Dashboard — matches web's InstructorDashboardPage.tsx
 * Shows: FDTL remaining, today's flights, student progress, document expiries, AOG alerts.
 */
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardHeader, CardTitle, Badge, FlightStatusPill, Spinner } from '../ui';
import { useInstructorSummary, useInstructorAvailability } from '../../api/hooks';
import { useDailyRoster } from '../../api/hooks';
import { useMyStudents } from '../../api/hooks';
import { fmt } from '../../lib/utils';
import dayjs from 'dayjs';

export function InstructorDashboard() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const today = dayjs().format('YYYY-MM-DD');

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useInstructorSummary();
  const { data: availability, isLoading: availLoading, refetch: refetchAvail } = useInstructorAvailability();
  const { data: roster, isLoading: rosterLoading, refetch: refetchRoster } = useDailyRoster(today);
  const { data: students, isLoading: studentsLoading, refetch: refetchStudents } = useMyStudents();

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchAvail(), refetchRoster(), refetchStudents()]);
    setRefreshing(false);
  };

  const isLoading = summaryLoading || rosterLoading;

  // Filter today's roster for this instructor
  const myFlights = roster?.filter((f: any) =>
    f.instructor_user_id === user?.id || f.instructor_name?.includes(user?.full_name || '')
  ) || [];

  // Parse availability windows
  const dailyWin = availability?.windows?.find((w: any) => w.window === 'last_24h');
  const weeklyWin = availability?.windows?.find((w: any) => w.window === 'last_7d');
  const monthlyWin = availability?.windows?.find((w: any) => w.window === 'last_28d');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 8, 20) }
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Good {getGreeting()}</Text>
          <Text style={[styles.name, { color: colors.text }]}>{user?.full_name || 'Instructor'}</Text>
          <Text style={[styles.date, { color: colors.textMuted }]}>{dayjs().format('dddd, DD MMM YYYY')}</Text>
        </View>

        {isLoading && <Spinner />}

        {/* FDTL Cards */}
        <View style={styles.statsRow}>
          <StatCard
            colors={colors}
            label="Flown Today"
            value={summary?.hours_flown_today !== undefined ? `${summary.hours_flown_today}h` : '0h'}
            color={colors.primary}
          />
          <StatCard
            colors={colors}
            label="Daily Cap Left"
            value={summary?.hours_remaining_today !== undefined ? `${summary.hours_remaining_today}h` : '8.0h'}
            color={Number(summary?.hours_remaining_today ?? 8) < 2 ? colors.danger : colors.success}
          />
          <StatCard
            colors={colors}
            label="This Month"
            value={summary?.hours_flown_month !== undefined ? `${summary.hours_flown_month}h` : '0h'}
            color={colors.warning}
          />
        </View>

        {/* Today's Flights */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>Today's Flights</CardTitle>
            <Badge variant="primary">{myFlights.length} sorties</Badge>
          </CardHeader>
          {myFlights.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No flights scheduled today</Text>
          ) : (
            myFlights.map((flight: any) => (
              <View key={flight.id} style={[styles.flightRow, { borderBottomColor: colors.border }]}>
                <View style={styles.flightLeft}>
                  <Text style={[styles.flightTime, { color: colors.text }]}>
                    {fmt.time(flight.scheduled_start)} – {fmt.time(flight.scheduled_end)}
                  </Text>
                  <Text style={[styles.flightDetail, { color: colors.textSecondary }]}>
                    {flight.student_name || 'No student'} • {flight.aircraft_name || flight.aircraft_detail?.tail_number}
                  </Text>
                </View>
                <FlightStatusPill status={flight.status} />
              </View>
            ))
          )}
        </Card>

        {/* Student Progress */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>My Students</CardTitle>
          </CardHeader>
          {studentsLoading ? <Spinner /> : (
            students?.map((s: any) => (
              <View key={s.student_id} style={[styles.studentRow, { borderBottomColor: colors.border }]}>
                <View style={styles.studentInfo}>
                  <Text style={[styles.studentName, { color: colors.text }]}>{s.student_name}</Text>
                  <Text style={[styles.studentDetail, { color: colors.textMuted }]}>
                    {s.hours_total}h total • Next: {s.last_exercise_code || 'D1'}
                  </Text>
                </View>
                <View style={styles.studentBadges}>
                  <Badge variant={s.spl_expiry ? 'success' : 'danger'}>
                    {s.spl_expiry ? 'SPL ✓' : 'SPL ✗'}
                  </Badge>
                  <Badge variant={s.medical_expiry ? 'success' : 'danger'}>
                    {s.medical_expiry ? 'Med ✓' : 'Med ✗'}
                  </Badge>
                </View>
              </View>
            )) || <Text style={[styles.empty, { color: colors.textMuted }]}>No assigned students</Text>
          )}
        </Card>

        {/* FDTL Availability Bars */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>FDTL Availability</CardTitle>
          </CardHeader>
          <FDTLBar
            label="Daily"
            remaining={dailyWin?.remaining_hours ?? 8.0}
            cap={dailyWin?.cap_hours ?? 8.0}
            colors={colors}
          />
          <FDTLBar
            label="Weekly"
            remaining={weeklyWin?.remaining_hours ?? 30.0}
            cap={weeklyWin?.cap_hours ?? 30.0}
            colors={colors}
          />
          <FDTLBar
            label="Monthly"
            remaining={monthlyWin?.remaining_hours ?? 100.0}
            cap={monthlyWin?.cap_hours ?? 100.0}
            colors={colors}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

function StatCard({ colors, label, value, color }: { colors: any; label: string; value: string; color: string }) {
  return (
    <View style={[statStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function FDTLBar({ label, remaining, cap, colors }: { label: string; remaining: number; cap: number; colors: any }) {
  const pct = cap > 0 ? Math.min(remaining / cap, 1) : 0;
  const barColor = pct > 0.3 ? colors.success : pct > 0.1 ? colors.warning : colors.danger;
  return (
    <View style={fdtlStyles.row}>
      <Text style={[fdtlStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[fdtlStyles.track, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={[fdtlStyles.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[fdtlStyles.value, { color: colors.text }]}>
        {remaining.toFixed(1)}h / {cap.toFixed(0)}h
      </Text>
    </View>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  greeting: { fontSize: 14 },
  name: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  date: { fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  section: { marginBottom: 16 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  flightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  flightLeft: { flex: 1 },
  flightTime: { fontSize: 15, fontWeight: '600' },
  flightDetail: { fontSize: 13, marginTop: 2 },
  studentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600' },
  studentDetail: { fontSize: 12, marginTop: 2 },
  studentBadges: { flexDirection: 'row', gap: 4 },
});

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 14, alignItems: 'center' },
  value: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
});

const fdtlStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { width: 65, fontSize: 13 },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  value: { width: 90, fontSize: 12, fontWeight: '600', textAlign: 'right' },
});
