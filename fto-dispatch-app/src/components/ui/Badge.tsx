import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { C, AIRCRAFT_STATUS_COLOR, FLIGHT_STATUS_COLOR, FLIGHT_TYPE_COLOR } from '../../theme/colors';

type BadgeKind = 'aircraft' | 'flight' | 'flightType' | 'severity' | 'custom';

interface BadgeProps {
  label: string;
  kind?: BadgeKind;
  color?: string;       // For kind='custom'
  bgColor?: string;
  style?: ViewStyle;
  small?: boolean;
}

export function Badge({ label, kind = 'custom', color, bgColor, style, small }: BadgeProps) {
  const textColor = resolveTextColor(label, kind, color);
  const bg = bgColor ?? resolveBgColor(label, kind);

  return (
    <View style={[styles.base, small && styles.small, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, small && styles.textSmall, { color: textColor }]}>
        {label.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

function resolveTextColor(label: string, kind: BadgeKind, custom?: string): string {
  if (custom) return custom;
  switch (kind) {
    case 'aircraft': return AIRCRAFT_STATUS_COLOR[label] ?? C.textSecondary;
    case 'flight': return FLIGHT_STATUS_COLOR[label] ?? C.textSecondary;
    case 'flightType': return FLIGHT_TYPE_COLOR[label] ?? C.textSecondary;
    case 'severity': return severityColor(label);
    default: return C.textPrimary;
  }
}

function resolveBgColor(label: string, kind: BadgeKind): string {
  switch (kind) {
    case 'aircraft': {
      const c = AIRCRAFT_STATUS_COLOR[label];
      return c ? `${c}22` : C.bgElevated;
    }
    case 'flight': {
      const c = FLIGHT_STATUS_COLOR[label];
      return c ? `${c}22` : C.bgElevated;
    }
    case 'flightType': {
      const c = FLIGHT_TYPE_COLOR[label];
      return c ? `${c}22` : C.bgElevated;
    }
    case 'severity': return severityBg(label);
    default: return C.bgElevated;
  }
}

function severityColor(label: string): string {
  switch (label) {
    case 'CRITICAL': return C.aog;
    case 'HIGH': return C.caution;
    case 'MEDIUM': return C.info;
    default: return C.textSecondary;
  }
}

function severityBg(label: string): string {
  switch (label) {
    case 'CRITICAL': return C.aogMuted;
    case 'HIGH': return C.cautionMuted;
    case 'MEDIUM': return C.infoMuted;
    default: return C.bgElevated;
  }
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  textSmall: { fontSize: 10 },
});
