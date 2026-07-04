import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FlightData } from '../../types';
import { Button } from '../ui/Button';
import { C } from '../../theme/colors';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const SIG_W = isTablet ? Math.min(width - 120, 600) : width - 64;
const SIG_H = 160;

const ETA_OPTIONS = [30, 45, 60, 75, 90, 105, 120];

interface ReleaseStepProps {
  flight: FlightData;
  onRelease: (releasedBy: string, etaMinutes: number, signature: string) => void;
  isLoading?: boolean;
}

export function ReleaseStep({ flight, onRelease, isLoading }: ReleaseStepProps) {
  const [releasedBy, setReleasedBy] = useState('');
  const [eta, setEta] = useState<number | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const currentPath = useRef('');
  const sigContainerRef = useRef<View>(null);

  // ─── SVG signature via PanResponder ─────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
      },

      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        // Force re-render by touching state via functional update
        setPaths((prev) => [...prev.slice(0, -1), currentPath.current]);
      },

      onPanResponderRelease: () => {
        if (currentPath.current) {
          setPaths((prev) => {
            const withoutLast = prev.filter((p) => p !== currentPath.current);
            return [...withoutLast, currentPath.current];
          });
          currentPath.current = '';
        }
      },
    })
  ).current;

  const clearSignature = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaths([]);
    currentPath.current = '';
  }, []);

  const hasSignature = paths.length > 0;
  const canRelease =
    releasedBy.trim().length >= 2 && eta !== null && hasSignature;

  const handleRelease = async () => {
    if (!canRelease) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Serialize paths as a simple SVG string for storage
    const svgData = paths.join('|');
    onRelease(releasedBy.trim(), eta!, svgData);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Flight summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>RELEASE CLEARANCE</Text>
          <View style={styles.summaryGrid}>
            <SummaryStat label="Aircraft" value={flight.aircraftRegistration} highlight />
            <SummaryStat label="Type" value={flight.aircraftType} />
            <SummaryStat label="Instructor" value={flight.instructorName} />
            <SummaryStat label="Student" value={flight.studentName} />
            <SummaryStat
              label="ETD"
              value={formatTime(flight.scheduledStart)}
              highlight
            />
            <SummaryStat label="Flight Type" value={flight.flightType} />
          </View>
          {flight.exerciseName && (
            <Text style={styles.exercise}>
              Exercise {flight.exerciseNumber}: {flight.exerciseName}
            </Text>
          )}
        </View>

        {/* Released by */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Authorised by (Dispatcher / CFI)</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.amber} />
            <TextInput
              style={styles.input}
              value={releasedBy}
              onChangeText={setReleasedBy}
              placeholder="Full name of releasing officer"
              placeholderTextColor={C.textMuted}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* ETA selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Estimated flight time (minutes)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.etaRow}>
              {ETA_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.etaChip, eta === opt && styles.etaChipSelected]}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEta(opt);
                  }}
                >
                  <Text
                    style={[styles.etaChipText, eta === opt && styles.etaChipTextSelected]}
                  >
                    {opt}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {eta !== null && (
            <Text style={styles.etaInfo}>
              ETA back by{' '}
              <Text style={styles.etaInfoBold}>
                {formatEta(flight.scheduledStart, eta)}
              </Text>
            </Text>
          )}
        </View>

        {/* Signature canvas */}
        <View style={styles.section}>
          <View style={styles.sigHeader}>
            <Text style={styles.sectionLabel}>Dispatcher signature</Text>
            {hasSignature && (
              <TouchableOpacity onPress={clearSignature} style={styles.clearBtn}>
                <Ionicons name="trash-outline" size={14} color={C.aog} />
                <Text style={styles.clearLabel}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View
            ref={sigContainerRef}
            style={styles.sigCanvas}
            {...panResponder.panHandlers}
          >
            <Svg width={SIG_W} height={SIG_H}>
              {paths.map((d, i) => (
                <Path
                  key={i}
                  d={d}
                  stroke={C.amber}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
            </Svg>
            {!hasSignature && (
              <View style={styles.sigPlaceholder} pointerEvents="none">
                <Ionicons name="create-outline" size={24} color={C.textMuted} />
                <Text style={styles.sigPlaceholderText}>Sign here</Text>
              </View>
            )}
          </View>
          <Text style={styles.sigNote}>
            Signature confirms aircraft is airworthy, crew is fit, and conditions
            are suitable for the planned flight under DGCA CAR regulations.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Release button */}
      <View style={styles.footer}>
        {!canRelease && (
          <Text style={styles.footerHint}>
            {!releasedBy.trim() ? 'Enter releasing officer name' : !eta ? 'Select flight duration' : 'Add signature to release'}
          </Text>
        )}
        <Button
          label="RELEASE — Clear to Fly"
          variant={canRelease ? 'primary' : 'secondary'}
          size="lg"
          fullWidth
          disabled={!canRelease}
          loading={isLoading}
          onPress={handleRelease}
        />
      </View>
    </View>
  );
}

function SummaryStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHL]}>{value}</Text>
    </View>
  );
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatEta(startMs: number, etaMinutes: number): string {
  const eta = new Date(startMs + etaMinutes * 60_000);
  return eta.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: isTablet ? 24 : 16, gap: 20 },
  summaryCard: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  summaryTitle: {
    color: C.amber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stat: { width: '46%', gap: 2 },
  statLabel: { color: C.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  statValueHL: { color: C.textPrimary, fontWeight: '800', fontSize: 16 },
  exercise: { color: C.textMuted, fontSize: 12, fontStyle: 'italic' },
  section: { gap: 8 },
  sectionLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgInput,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderStrong,
    paddingHorizontal: 14,
    gap: 10,
    height: 52,
  },
  input: { flex: 1, color: C.textPrimary, fontSize: 15 },
  etaRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  etaChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: C.bgCard,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  etaChipSelected: { backgroundColor: C.amber, borderColor: C.amber },
  etaChipText: { color: C.textSecondary, fontWeight: '700', fontSize: 14 },
  etaChipTextSelected: { color: C.textInverse },
  etaInfo: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  etaInfoBold: { color: C.textPrimary, fontWeight: '700' },
  sigHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearLabel: { color: C.aog, fontSize: 12, fontWeight: '600' },
  sigCanvas: {
    width: SIG_W,
    height: SIG_H,
    backgroundColor: C.bgInput,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignSelf: Platform.OS === 'ios' ? 'center' : undefined,
  },
  sigPlaceholder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  sigPlaceholderText: { color: C.textMuted, fontSize: 13 },
  sigNote: {
    color: C.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 10,
    backgroundColor: C.bg,
  },
  footerHint: { color: C.textMuted, fontSize: 12, textAlign: 'center' },
});
