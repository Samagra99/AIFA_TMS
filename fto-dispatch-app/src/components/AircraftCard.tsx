import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Aircraft } from '../db/models/Aircraft';
import { Badge } from './ui/Badge';
import { C, AIRCRAFT_STATUS_COLOR } from '../theme/colors';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const CARD_WIDTH = isTablet ? (width - 60) / 3 : (width - 44) / 2;

interface AircraftCardProps {
  aircraft: Aircraft;
}

export function AircraftCard({ aircraft }: AircraftCardProps) {
  const statusColor = AIRCRAFT_STATUS_COLOR[aircraft.status] ?? C.textMuted;
  const isAog = aircraft.status === 'AOG';
  const isFerryBlocked = aircraft.isFerryBlocked;
  const remainingPct = Math.min(
    (aircraft.remainingHours / Math.max(aircraft.ferryBufferHours * 10, 100)) * 100,
    100
  );

  return (
    <View
      style={[
        styles.card,
        isAog && styles.cardAog,
        { width: CARD_WIDTH },
      ]}
    >
      {/* Top row: registration + status dot */}
      <View style={styles.header}>
        <Text style={styles.registration}>{aircraft.registration}</Text>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
      </View>
      <Text style={styles.type}>{aircraft.type}</Text>

      {/* Status badge */}
      <View style={styles.badgeRow}>
        <Badge label={aircraft.status} kind="aircraft" />
        {isFerryBlocked && (
          <Badge
            label="FERRY HOLD"
            color={C.caution}
            bgColor={C.cautionMuted}
          />
        )}
      </View>

      {/* Hours */}
      <View style={styles.hoursRow}>
        <HoursStat label="TTAF" value={aircraft.totalAirframeHours} />
        <HoursStat label="SL 100H" value={aircraft.hoursSince100h} />
        <HoursStat label="REM" value={aircraft.remainingHours} highlight={aircraft.remainingHours < 10} />
      </View>

      {/* Remaining hours bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${remainingPct}%`,
              backgroundColor: aircraft.remainingHours < 5 ? C.aog : aircraft.remainingHours < 15 ? C.caution : C.go,
            },
          ]}
        />
      </View>
      <Text style={styles.barLabel}>{aircraft.remainingHours.toFixed(1)} hr remaining</Text>

      {/* Ferry block notice */}
      {isFerryBlocked && (
        <View style={styles.ferryNotice}>
          <Ionicons name="airplane" size={12} color={C.caution} />
          <Text style={styles.ferryText}>Ferry to AMRAVATI before next sortie</Text>
        </View>
      )}

      {/* Snag indicator */}
      {aircraft.openSnagsCount > 0 && (
        <View style={styles.snagRow}>
          <Ionicons name="warning" size={12} color={isAog ? C.aog : C.caution} />
          <Text style={[styles.snagText, isAog && styles.snagTextAog]}>
            {aircraft.openSnagsCount} open snag{aircraft.openSnagsCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

function HoursStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueWarn]}>
        {value.toFixed(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    padding: 14,
    margin: 6,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  cardAog: {
    borderColor: `${C.aog}55`,
    backgroundColor: '#160B0B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  registration: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  type: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stat: { alignItems: 'center' },
  statLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statValueWarn: { color: C.aog },
  barTrack: {
    height: 4,
    backgroundColor: C.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
  barLabel: {
    color: C.textMuted,
    fontSize: 10,
    textAlign: 'right',
    marginTop: -2,
  },
  ferryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.cautionMuted,
    borderRadius: 6,
    padding: 6,
  },
  ferryText: { color: C.caution, fontSize: 11, fontWeight: '600', flex: 1 },
  snagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  snagText: { color: C.caution, fontSize: 11 },
  snagTextAog: { color: C.aog },
});
