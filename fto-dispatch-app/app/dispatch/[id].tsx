import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { Ionicons } from '@expo/vector-icons';

import {
  database,
  flightsCollection,
  aircraftCollection,
  dispatchCollection,
} from '../../src/db';
import { Flight } from '../../src/db/models/Flight';
import { Aircraft } from '../../src/db/models/Aircraft';
import { DispatchRecord } from '../../src/db/models/DispatchRecord';

import { ProgressSteps } from '../../src/components/dispatch/ProgressSteps';
import {
  PreFlightStep,
  DEFAULT_CHECKLIST,
} from '../../src/components/dispatch/PreFlightStep';
import { WeatherStep } from '../../src/components/dispatch/WeatherStep';
import { ReleaseStep } from '../../src/components/dispatch/ReleaseStep';

import { enqueueSync, pushPending } from '../../src/services/sync.service';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import {
  FlightData,
  FlightType,
  FlightStatus,
  PreflightCheck,
  WeatherData,
  WeatherDecision,
} from '../../src/types';
import { C } from '../../src/theme/colors';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function DispatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetworkStatus();

  const [flight, setFlight] = useState<Flight | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [dispatchRecord, setDispatchRecord] = useState<DispatchRecord | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isReleasing, setIsReleasing] = useState(false);

  // Derive step from record state – source of truth lives in WatermelonDB
  const currentStep: 1 | 2 | 3 = (() => {
    if (!dispatchRecord?.preflightCompletedAt) return 1;
    if (!dispatchRecord?.weatherCompletedAt) return 2;
    return 3;
  })();

  // ─── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;

    // Observe flight reactively
    const flightSub = flightsCollection
      .query(Q.where('id', id))
      .observe()
      .subscribe(async (flights) => {
        if (!flights.length) return;
        const f = flights[0];
        setFlight(f);

        // Load associated aircraft (not reactive – status fetched on mount)
        const acList = await aircraftCollection
          .query(Q.where('registration', f.aircraftRegistration))
          .fetch();
        setAircraft(acList[0] ?? null);
      });

    // Observe dispatch record reactively (so UI updates when we write)
    const recordSub = dispatchCollection
      .query(Q.where('flight_id', id))
      .observe()
      .subscribe((records) => {
        setDispatchRecord(records[0] ?? null);
      });

    // Bootstrap: ensure a dispatch record exists for this flight
    const bootstrap = setTimeout(async () => {
      try {
        const flights = await flightsCollection.query(Q.where('id', id)).fetch();
        if (!flights.length) {
          setIsBooting(false);
          return;
        }
        const f = flights[0];
        const existing = await dispatchCollection
          .query(Q.where('flight_id', id))
          .fetch();

        if (!existing.length) {
          await database.write(async () => {
            await dispatchCollection.create((r: DispatchRecord) => {
              r.flightId = id;
              r.remoteFlightId = f.remoteId ?? '';
              r.preflightChecks = JSON.stringify(DEFAULT_CHECKLIST);
              r.preflightNotes = '';
              r.preflightBy = '';
              r.notamAcknowledged = false;
              r.weatherDecision = '';
              r.releasedBy = '';
              r.releaseSignature = '';
              r.status = 'PENDING';
              r.isSynced = false;
              r.createdAt = Date.now();
              r.updatedAt = Date.now();
            });
          });
        }
      } finally {
        setIsBooting(false);
      }
    }, 150);

    return () => {
      flightSub.unsubscribe();
      recordSub.unsubscribe();
      clearTimeout(bootstrap);
    };
  }, [id]);

  // ─── Step 1: Pre-flight complete ───────────────────────────────────────────

  const handlePreflightComplete = useCallback(
    async (checks: PreflightCheck[], notes: string, by: string) => {
      if (!dispatchRecord) return;
      await database.write(async () => {
        await dispatchRecord.update((r) => {
          r.preflightChecks = JSON.stringify(checks);
          r.preflightNotes = notes;
          r.preflightBy = by;
          r.preflightCompletedAt = Date.now();
          r.status = 'BRIEFING';
          r.updatedAt = Date.now();
        });
      });
    },
    [dispatchRecord]
  );

  // ─── Step 2: Weather briefing complete ────────────────────────────────────

  const handleWeatherComplete = useCallback(
    async (
      weatherData: WeatherData,
      notamAcknowledged: boolean,
      decision: WeatherDecision
    ) => {
      if (!dispatchRecord || !flight) return;

      if (decision === 'NO_GO') {
        Alert.alert(
          '⛔ NO-GO Decision',
          'The weather decision is NO-GO. This flight will be cancelled and logged.',
          [
            { text: 'Go Back', style: 'cancel' },
            {
              text: 'Confirm NO-GO & Cancel',
              style: 'destructive',
              onPress: async () => {
                await database.write(async () => {
                  await dispatchRecord.update((r) => {
                    r.weatherData = JSON.stringify(weatherData);
                    r.notamAcknowledged = notamAcknowledged;
                    r.weatherDecision = decision;
                    r.weatherCompletedAt = Date.now();
                    r.status = 'CANCELLED';
                    r.updatedAt = Date.now();
                  });
                  await flight.update((f) => {
                    f.status = 'CANCELLED';
                  });
                });
                // Enqueue for server sync
                await enqueueSync(
                  'dispatch_records',
                  'create',
                  dispatchRecord.id,
                  { status: 'CANCELLED', weather_decision: 'NO_GO' }
                );
                Alert.alert(
                  'Flight Cancelled',
                  'The flight has been cancelled and logged. Notify crew.',
                  [{ text: 'Done', onPress: () => router.back() }]
                );
              },
            },
          ]
        );
        return;
      }

      // GO decision – advance to Step 3
      await database.write(async () => {
        await dispatchRecord.update((r) => {
          r.weatherData = JSON.stringify(weatherData);
          r.notamAcknowledged = notamAcknowledged;
          r.weatherDecision = decision;
          r.weatherCompletedAt = Date.now();
          r.updatedAt = Date.now();
        });
      });
    },
    [dispatchRecord, flight, router]
  );

  // ─── Step 3: Release ──────────────────────────────────────────────────────

  const handleRelease = useCallback(
    async (releasedBy: string, etaMinutes: number, signature: string) => {
      if (!dispatchRecord || !flight) return;
      setIsReleasing(true);

      try {
        const releasedAt = Date.now();

        // Write locally first (offline-first guarantee)
        await database.write(async () => {
          await dispatchRecord.update((r) => {
            r.releasedBy = releasedBy;
            r.releasedAt = releasedAt;
            r.releaseSignature = signature;
            r.etaMinutes = etaMinutes;
            r.status = 'RELEASED';
            r.isSynced = false;
            r.updatedAt = Date.now();
          });
          await flight.update((f) => {
            f.status = 'DISPATCHED';
          });
        });

        // Build full payload for server sync
        const syncPayload = {
          remote_flight_id: dispatchRecord.remoteFlightId,
          preflight_checks: dispatchRecord.preflightChecks,
          preflight_notes: dispatchRecord.preflightNotes,
          preflight_by: dispatchRecord.preflightBy,
          preflight_completed_at: dispatchRecord.preflightCompletedAt,
          weather_data: dispatchRecord.weatherData,
          notam_acknowledged: dispatchRecord.notamAcknowledged,
          weather_decision: dispatchRecord.weatherDecision,
          weather_completed_at: dispatchRecord.weatherCompletedAt,
          released_by: releasedBy,
          released_at: releasedAt,
          release_signature: signature,
          eta_minutes: etaMinutes,
          status: 'RELEASED',
        };

        await enqueueSync(
          'dispatch_records',
          'create',
          dispatchRecord.id,
          syncPayload
        );

        // Push immediately if online (don't block UI on failure)
        if (isConnected) {
          pushPending().catch((e) =>
            console.warn('[Dispatch] Immediate sync failed, queued:', e)
          );
        }

        const etaTime = new Date(
          flight.scheduledStart + etaMinutes * 60_000
        ).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        Alert.alert(
          '✅ CLEARED TO FLY',
          `${flight.aircraftRegistration} released by ${releasedBy}.\n\nETA back: ${etaTime} (${etaMinutes} min)\n\n${isConnected ? 'Record synced to server.' : 'Will sync when connectivity restored.'}`,
          [{ text: 'Done', onPress: () => router.back() }]
        );
      } catch (err) {
        console.error('[Dispatch] Release error:', err);
        Alert.alert(
          'Release Failed',
          'Could not save dispatch record. Please try again.'
        );
      } finally {
        setIsReleasing(false);
      }
    },
    [dispatchRecord, flight, isConnected, router]
  );

  // ─── Guards ────────────────────────────────────────────────────────────────

  // Booting / not yet loaded
  if (isBooting || (!dispatchRecord && !isBooting)) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.amber} />
        <Text style={styles.loadingText}>Loading flight…</Text>
      </View>
    );
  }

  // Aircraft AOG – hard block
  if (aircraft?.status === 'AOG') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Dispatch Blocked" onBack={() => router.back()} />
        <View style={styles.blockScreen}>
          <View style={styles.aogIcon}>
            <Ionicons name="warning" size={52} color={C.aog} />
          </View>
          <Text style={styles.blockTitle}>AIRCRAFT GROUNDED</Text>
          <Text style={styles.blockSub}>AOG — {aircraft.registration}</Text>
          <Text style={styles.blockBody}>
            This aircraft has an active No-Go snag and cannot be dispatched.
            Dispatch is blocked until CAMO issues a Certificate of Release to
            Service (CRS) at the Amravati hub.
          </Text>
          <View style={styles.blockMeta}>
            <Ionicons name="construct-outline" size={14} color={C.caution} />
            <Text style={styles.blockMetaText}>
              {aircraft.openSnagsCount} open snag{aircraft.openSnagsCount !== 1 ? 's' : ''} on record
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Already released – show summary
  if (dispatchRecord?.status === 'RELEASED') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader
          title={`${flight?.aircraftRegistration ?? '–'} — Released`}
          onBack={() => router.back()}
        />
        <ReleasedSummary
          record={dispatchRecord}
          registration={flight?.aircraftRegistration ?? ''}
        />
      </View>
    );
  }

  // Normal state – need flight & record for the wizard
  if (!flight || !dispatchRecord) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Flight not found.</Text>
      </View>
    );
  }

  const flightData: FlightData = {
    id: flight.id,
    remoteId: flight.remoteId,
    aircraftRegistration: flight.aircraftRegistration,
    aircraftType: flight.aircraftType,
    instructorName: flight.instructorName,
    studentName: flight.studentName,
    scheduledStart: flight.scheduledStart,
    scheduledEnd: flight.scheduledEnd,
    flightType: flight.flightType as FlightType,
    exerciseNumber: flight.exerciseNumber,
    exerciseName: flight.exerciseName,
    base: flight.base,
    status: flight.status as FlightStatus,
    syncedAt: flight.syncedAt,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <ScreenHeader
        title={`${flight.aircraftRegistration}  ·  ${flight.flightType}`}
        subtitle={`${flight.instructorName}  /  ${flight.studentName}`}
        onBack={() => router.back()}
      />

      {/* ── Step wizard ─────────────────────────────────────────── */}
      <ProgressSteps currentStep={currentStep} />

      {/* ── Active step ─────────────────────────────────────────── */}
      {currentStep === 1 && (
        <PreFlightStep
          initialChecks={
            (() => {
              try {
                return JSON.parse(dispatchRecord.preflightChecks) as PreflightCheck[];
              } catch {
                return DEFAULT_CHECKLIST;
              }
            })()
          }
          preflightBy={dispatchRecord.preflightBy ?? ''}
          notes={dispatchRecord.preflightNotes ?? ''}
          onComplete={handlePreflightComplete}
        />
      )}

      {currentStep === 2 && (
        <WeatherStep
          base={flight.base}
          onComplete={handleWeatherComplete}
        />
      )}

      {currentStep === 3 && (
        <ReleaseStep
          flight={flightData}
          onRelease={handleRelease}
          isLoading={isReleasing}
        />
      )}
    </View>
  );
}

// ─── Screen-level sub-components ─────────────────────────────────────────────

function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={26} color={C.amber} />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {/* Spacer to keep title centred on tablets */}
      <View style={{ width: 42 }} />
    </View>
  );
}

function ReleasedSummary({
  record,
  registration,
}: {
  record: DispatchRecord;
  registration: string;
}) {
  const releasedTime = record.releasedAt
    ? new Date(record.releasedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '–';

  return (
    <View style={styles.releasedWrap}>
      <View style={styles.releasedIcon}>
        <Ionicons name="checkmark-circle" size={64} color={C.go} />
      </View>
      <Text style={styles.releasedTitle}>FLIGHT RELEASED</Text>
      <Text style={styles.releasedReg}>{registration}</Text>

      <View style={styles.releasedCard}>
        <SummaryRow label="Released at" value={releasedTime} />
        <SummaryRow label="Released by" value={record.releasedBy ?? '–'} />
        <SummaryRow label="ETA (minutes)" value={String(record.etaMinutes ?? '–')} />
        <SummaryRow label="Weather decision" value={record.weatherDecision ?? '–'} />
        <SummaryRow
          label="Sync status"
          value={record.isSynced ? 'Synced ✓' : 'Pending sync…'}
          valueColor={record.isSynced ? C.go : C.caution}
        />
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: { color: C.textMuted, fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 4,
    paddingVertical: 12,
    gap: 4,
  },
  backBtn: { padding: 8, minWidth: 42, alignItems: 'center' },
  headerText: { flex: 1 },
  headerTitle: {
    color: C.textPrimary,
    fontSize: isTablet ? 18 : 15,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  headerSub: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },

  // AOG block
  blockScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 14,
  },
  aogIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.aogMuted,
    borderWidth: 2,
    borderColor: `${C.aog}55`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  blockTitle: {
    color: C.aog,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  blockSub: {
    color: C.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  blockBody: {
    color: C.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 360,
    marginTop: 8,
  },
  blockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.cautionMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  blockMetaText: { color: C.caution, fontSize: 13, fontWeight: '600' },

  // Released summary
  releasedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  releasedIcon: { marginBottom: 8 },
  releasedTitle: {
    color: C.go,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  releasedReg: {
    color: C.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  releasedCard: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    width: isTablet ? 440 : width - 48,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  summaryLabel: { color: C.textMuted, fontSize: 13 },
  summaryValue: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
});
