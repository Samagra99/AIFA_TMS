/**
 * Instructor Dashboard — matches web's InstructorDashboardPage.tsx
 * Shows: FDTL remaining (5 CAR-FDTL windows with date selector), today's flights, student progress, document expiries, AOG alerts.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardHeader, CardTitle, Badge, FlightStatusPill, Spinner } from '../ui';
import { useInstructorSummary, useInstructorAvailability, useDailyRoster, useMyStudents } from '../../api/hooks';
import { fmt } from '../../lib/utils';
import dayjs from 'dayjs';

export function InstructorDashboard() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [selectedFdtlDate, setSelectedFdtlDate] = useState(dayjs().format('YYYY-MM-DD'));
  const todayStr = dayjs().format('YYYY-MM-DD');

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useInstructorSummary();
  const { data: availability, isLoading: availLoading, refetch: refetchAvail } = useInstructorAvailability(selectedFdtlDate);
  const { data: roster, isLoading: rosterLoading, refetch: refetchRoster } = useDailyRoster(todayStr);
  const { data: students, isLoading: studentsLoading, refetch: refetchStudents } = useMyStudents();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchAvail(), refetchRoster(), refetchStudents()]);
    setRefreshing(false);
  };

  const isLoading = summaryLoading || rosterLoading;

  // Filter today's roster for active flights (excluding cancelled/aborted)
  const myFlights = roster?.filter((f: any) =>
    (f.instructor_user_id === user?.id || f.secondary_instructor_user_id === user?.id || f.instructor_name?.includes(user?.full_name || '')) &&
    !['cancelled', 'aborted', 'draft'].includes(f.status)
  ) || [];

  // Parse availability windows (24h, 7d, 28d, 90d, 360d)
  const win24h = availability?.windows?.find((w: any) => w.window === 'last_24h');
  const win7d  = availability?.windows?.find((w: any) => w.window === 'last_7d');
  const win28d = availability?.windows?.find((w: any) => w.window === 'last_28d');
  const win90d = availability?.windows?.find((w: any) => w.window === 'last_90d');
  const win360d= availability?.windows?.find((w: any) => w.window === 'last_360d');

  // AOG Aircraft list (combining explicit AOG status and overdue defect grounding)
  const aogAircraft = (summary?.aog_aircraft || []).filter((a: any) => a.status === 'aog' || a.status === 'AOG' || a.is_overdue);

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
            label="Remaining Today"
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

        {/* Expiring Documents */}
        {summary?.expiring_within_60_days && summary.expiring_within_60_days.length > 0 && (
          <Card style={StyleSheet.flatten([styles.section, { borderColor: colors.warning, borderWidth: 1 }])}>
            <CardHeader>
              <CardTitle>⚠ Expiring Within 60 Days ({summary.expiring_within_60_days.length})</CardTitle>
            </CardHeader>
            {summary.expiring_within_60_days.map((e: any, i: number) => (
              <View key={i} style={styles.aogRow}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                  <Text style={[styles.aogReason, { color: colors.text, fontWeight: 'bold' }]}>
                    {e.is_own ? e.label : `${e.entity_name} — ${e.label}`}
                  </Text>
                  <Badge variant={e.days_left <= 14 ? 'danger' : 'warning'}>{e.days_left}d</Badge>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Expires {fmt.date(e.expiry_date)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* AOG Alert Section */}
        {aogAircraft.length > 0 && (
          <Card style={StyleSheet.flatten([styles.section, { borderColor: colors.danger, borderWidth: 1 }])}>
            <CardHeader>
              <CardTitle>⚠ AOG Grounded Aircraft ({aogAircraft.length})</CardTitle>
            </CardHeader>
            {aogAircraft.map((ac: any) => (
              <View key={ac.aircraft_id || ac.id} style={styles.aogRow}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <Badge variant="danger">{ac.tail_number}</Badge>
                  <Text style={[styles.aogReason, { color: colors.text }]}>
                    {ac.aog_reason || 'Grounded — Unscheduled Maintenance / Overdue Defect'}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Today's Active Flights */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>Today's Active Flights</CardTitle>
            <Badge variant="primary">{myFlights.length} sorties</Badge>
          </CardHeader>
          {myFlights.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No active flights scheduled today</Text>
          ) : (
            myFlights.map((flight: any) => (
              <View key={flight.id} style={[styles.flightRow, { borderBottomColor: colors.border }]}>
                <View style={styles.flightLeft}>
                  <Text style={[styles.flightTime, { color: colors.text }]}>
                    {fmt.time(flight.scheduled_start)} – {fmt.time(flight.scheduled_end)}
                  </Text>
                  <Text style={[styles.flightDetail, { color: colors.textSecondary }]}>
                    {flight.student_name || (flight.secondary_instructor_name ? `w/ ${flight.instructor_user_id === user?.id ? flight.secondary_instructor_name : flight.instructor_name}` : 'Solo')} • {flight.aircraft_name || flight.aircraft_detail?.tail_number}
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
            students?.map((s: any) => {
              const isSplValid = s.spl_valid !== undefined ? s.spl_valid : (!!s.spl_expiry && dayjs(s.spl_expiry).isAfter(dayjs()));
              const isMedValid = s.medical_valid !== undefined ? s.medical_valid : (!!s.medical_expiry && dayjs(s.medical_expiry).isAfter(dayjs()));

              return (
                <View key={s.student_id} style={[styles.studentRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.studentInfo}>
                    <Text style={[styles.studentName, { color: colors.text }]}>{s.student_name}</Text>
                    <Text style={[styles.studentDetail, { color: colors.textMuted }]}>
                      {s.hours_total}h total • Next: {s.next_exercise_code || s.last_exercise_code || 'D1'}
                      {s.last_grade !== undefined && s.last_grade !== null ? ` • Last Grade: ${s.last_grade}/5` : ''}
                    </Text>
                  </View>
                  <View style={styles.studentBadges}>
                    <Badge variant={isSplValid ? 'success' : 'danger'}>
                      {isSplValid ? 'SPL ✓' : 'SPL ✗'}
                    </Badge>
                    <Badge variant={isMedValid ? 'success' : 'danger'}>
                      {isMedValid ? 'Med ✓' : 'Med ✗'}
                    </Badge>
                  </View>
                </View>
              );
            }) || <Text style={[styles.empty, { color: colors.textMuted }]}>No assigned students</Text>
          )}
        </Card>

        {/* FDTL Availability (5 Windows + Date Selector) */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>FDTL Availability Limits</CardTitle>
            <View style={styles.dateSelector}>
              <TouchableOpacity
                onPress={() => setSelectedFdtlDate(dayjs(selectedFdtlDate).subtract(1, 'day').format('YYYY-MM-DD'))}
                style={styles.dateBtn}
              >
                <Text style={styles.dateBtnText}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.selectedDateText, { color: colors.text }]}>
                {dayjs(selectedFdtlDate).format('DD MMM YYYY')}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedFdtlDate(dayjs(selectedFdtlDate).add(1, 'day').format('YYYY-MM-DD'))}
                style={styles.dateBtn}
              >
                <Text style={styles.dateBtnText}>›</Text>
              </TouchableOpacity>
            </View>
          </CardHeader>

          {availLoading ? (
            <Spinner />
          ) : (
            <>
              <FDTLBar
                label="24 Hours"
                remaining={win24h?.remaining_hours ?? 8.0}
                cap={win24h?.cap_hours ?? 8.0}
                colors={colors}
              />
              <FDTLBar
                label="7 Days"
                remaining={win7d?.remaining_hours ?? 30.0}
                cap={win7d?.cap_hours ?? 30.0}
                colors={colors}
              />
              <FDTLBar
                label="28 Days"
                remaining={win28d?.remaining_hours ?? 100.0}
                cap={win28d?.cap_hours ?? 100.0}
                colors={colors}
              />
              <FDTLBar
                label="90 Days"
                remaining={win90d?.remaining_hours ?? 270.0}
                cap={win90d?.cap_hours ?? 270.0}
                colors={colors}
              />
              <FDTLBar
                label="360 Days"
                remaining={win360d?.remaining_hours ?? 1000.0}
                cap={win360d?.cap_hours ?? 1000.0}
                colors={colors}
              />
            </>
          )}
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
  aogRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  aogReason: { fontSize: 13, flex: 1 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  dateBtnText: { fontSize: 16, fontWeight: 'bold', color: '#0ea5e9' },
  selectedDateText: { fontSize: 12, fontWeight: '600' },
});

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 14, alignItems: 'center' },
  value: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
});

const fdtlStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { width: 75, fontSize: 12 },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  value: { width: 95, fontSize: 12, fontWeight: '600', textAlign: 'right' },
});
