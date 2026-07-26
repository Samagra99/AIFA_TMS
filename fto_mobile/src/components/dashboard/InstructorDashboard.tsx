/**
 * Instructor Dashboard — matches web's InstructorDashboardPage.tsx
 * Shows: FDTL remaining, today's flights, student progress, document expiries, AOG alerts.
 */
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const user = useAuthStore((s) => s.user);
  const today = dayjs().format('YYYY-MM-DD');

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useInstructorSummary();
  const { data: availability, isLoading: availLoading } = useInstructorAvailability();
  const { data: roster, isLoading: rosterLoading, refetch: refetchRoster } = useDailyRoster(today);
  const { data: students, isLoading: studentsLoading } = useMyStudents();

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchRoster()]);
    setRefreshing(false);
  };

  const isLoading = summaryLoading || rosterLoading;

  // Filter today's roster for this instructor
  const myFlights = roster?.filter((f: any) =>
    f.instructor_user_id === user?.id || f.instructor_name?.includes(user?.full_name || '')
  ) || [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
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
        {summary && (
          <View style={styles.statsRow}>
            <StatCard
              colors={colors}
              label="Flown Today"
              value={summary.hours_today ? `${summary.hours_today}h` : '0h'}
              color={colors.primary}
            />
            <StatCard
              colors={colors}
              label="Daily Cap Left"
              value={summary.fdtl_daily_remaining ? fmt.hours(summary.fdtl_daily_remaining) : '—'}
              color={Number(summary.fdtl_daily_remaining || 0) < 60 ? colors.danger : colors.success}
            />
            <StatCard
              colors={colors}
              label="This Month"
              value={summary.hours_month ? `${summary.hours_month}h` : '0h'}
              color={colors.warning}
            />
          </View>
        )}

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
                    {s.hours_total}h total • Next: {s.next_exercise_code || '—'}
                  </Text>
                </View>
                <View style={styles.studentBadges}>
                  <Badge variant={s.medical_valid ? 'success' : 'danger'}>
                    {s.medical_valid ? 'Med ✓' : 'Med ✗'}
                  </Badge>
                  <Badge variant={s.spl_valid ? 'success' : 'danger'}>
                    {s.spl_valid ? 'SPL ✓' : 'SPL ✗'}
                  </Badge>
                </View>
              </View>
            )) || <Text style={[styles.empty, { color: colors.textMuted }]}>No assigned students</Text>
          )}
        </Card>

        {/* Availability */}
        {availability && (
          <Card style={styles.section}>
            <CardHeader>
              <CardTitle>FDTL Availability</CardTitle>
            </CardHeader>
            <FDTLBar label="Daily" remaining={availability.daily_remaining_min} cap={availability.daily_cap_min} colors={colors} />
            <FDTLBar label="Weekly" remaining={availability.weekly_remaining_min} cap={availability.weekly_cap_min} colors={colors} />
            <FDTLBar label="Monthly" remaining={availability.monthly_remaining_min} cap={availability.monthly_cap_min} colors={colors} />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
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
      <Text style={[fdtlStyles.value, { color: colors.text }]}>{fmt.hours(remaining)}</Text>
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
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
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
  value: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
});

const fdtlStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: { width: 60, fontSize: 12 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  value: { width: 60, fontSize: 12, fontWeight: '600', textAlign: 'right' },
});
