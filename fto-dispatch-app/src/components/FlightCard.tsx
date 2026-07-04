import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Flight } from '../db/models/Flight';
import { Badge } from './ui/Badge';
import { C, FLIGHT_STATUS_COLOR } from '../theme/colors';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

interface FlightCardProps {
  flight: Flight;
  onPress: (flight: Flight) => void;
  isAogAffected?: boolean;
}

export function FlightCard({ flight, onPress, isAogAffected }: FlightCardProps) {
  const startTime = formatTime(flight.scheduledStart);
  const endTime = formatTime(flight.scheduledEnd);
  const canDispatch = flight.status === 'SCHEDULED';
  const statusColor = FLIGHT_STATUS_COLOR[flight.status] ?? C.textMuted;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(flight)}
      disabled={!canDispatch && flight.status !== 'DISPATCHED'}
      style={[
        styles.card,
        isAogAffected && styles.cardAog,
        flight.status === 'COMPLETE' && styles.cardComplete,
      ]}
    >
      {/* Left accent stripe - flight type color */}
      <View style={[styles.stripe, { backgroundColor: flightTypeColor(flight.flightType) }]} />

      <View style={styles.body}>
        {/* Row 1: Time + Aircraft */}
        <View style={styles.row}>
          <View style={styles.timeBlock}>
            <Text style={styles.time}>{startTime}</Text>
            <Text style={styles.timeSep}>–</Text>
            <Text style={styles.time}>{endTime}</Text>
          </View>

          <View style={styles.aircraftBlock}>
            <Text style={styles.registration}>{flight.aircraftRegistration}</Text>
            <Text style={styles.acType}>{flight.aircraftType}</Text>
          </View>

          <View style={styles.badgesBlock}>
            <Badge label={flight.flightType} kind="flightType" small />
            <View style={{ height: 4 }} />
            <Badge label={flight.status} kind="flight" small />
          </View>
        </View>

        {/* Row 2: Crew */}
        <View style={styles.crewRow}>
          <Ionicons name="person" size={13} color={C.textMuted} />
          <Text style={styles.crewText}>{flight.instructorName}</Text>
          <Text style={styles.crewDivider}>·</Text>
          <Ionicons name="school" size={13} color={C.textMuted} />
          <Text style={styles.crewText}>{flight.studentName}</Text>
        </View>

        {/* Row 3: Exercise (if set) + base */}
        {(flight.exerciseName || flight.exerciseNumber) && (
          <Text style={styles.exercise} numberOfLines={1}>
            Ex {flight.exerciseNumber}: {flight.exerciseName}
          </Text>
        )}

        {/* AOG warning */}
        {isAogAffected && (
          <View style={styles.aogBadge}>
            <Ionicons name="warning" size={12} color={C.aog} />
            <Text style={styles.aogText}>AOG – Aircraft grounded</Text>
          </View>
        )}
      </View>

      {/* Right chevron / dispatch CTA */}
      {canDispatch && (
        <View style={styles.cta}>
          <Text style={styles.ctaLabel}>DISPATCH</Text>
          <Ionicons name="chevron-forward" size={18} color={C.amber} />
        </View>
      )}

      {flight.status === 'DISPATCHED' && (
        <View style={styles.cta}>
          <Ionicons name="checkmark-circle" size={22} color={C.go} />
        </View>
      )}

      {/* Left border that pulses colour by status */}
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
    </TouchableOpacity>
  );
}

function flightTypeColor(type: string): string {
  switch (type) {
    case 'DUAL': return C.flightDual;
    case 'SOLO':
    case 'LOCAL_SOLO': return C.flightSolo;
    case 'CHECK': return C.flightCheck;
    case 'IFOX': return C.flightIfox;
    default: return C.textMuted;
  }
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    borderRadius: 14,
    marginHorizontal: isTablet ? 20 : 16,
    marginVertical: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 96,
  },
  cardAog: {
    borderColor: `${C.aog}66`,
    backgroundColor: '#1A1010',
  },
  cardComplete: { opacity: 0.55 },
  stripe: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 110,
  },
  time: {
    color: C.textPrimary,
    fontSize: isTablet ? 17 : 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeSep: { color: C.textMuted, fontSize: 13 },
  aircraftBlock: { flex: 1 },
  registration: {
    color: C.textPrimary,
    fontSize: isTablet ? 18 : 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  acType: {
    color: C.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  badgesBlock: { alignItems: 'flex-end' },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  crewText: {
    color: C.textSecondary,
    fontSize: 13,
  },
  crewDivider: {
    color: C.textMuted,
    marginHorizontal: 4,
  },
  exercise: {
    color: C.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  aogBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  aogText: {
    color: C.aog,
    fontSize: 12,
    fontWeight: '700',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
    gap: 4,
  },
  ctaLabel: {
    color: C.amber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusDot: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 3,
    bottom: 0,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    opacity: 0.6,
  },
});
