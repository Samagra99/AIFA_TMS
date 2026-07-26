import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle, Animated } from 'react-native';
import { useTheme } from '../../theme';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'aog' | 'info';

export interface BadgeProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  text?: string;
  style?: ViewStyle;
}

export function Badge({ variant = 'default', children, text, style }: BadgeProps) {
  const { colors } = useTheme();
  const content = children ?? text;

  const getVariantStyles = (): { container: ViewStyle; text: { color: string } } => {
    switch (variant) {
      case 'primary':
      case 'info': return { container: { backgroundColor: colors.primary + '20' }, text: { color: colors.primary } };
      case 'success': return { container: { backgroundColor: colors.success + '20' }, text: { color: colors.success } };
      case 'warning': return { container: { backgroundColor: colors.warning + '20' }, text: { color: colors.warning } };
      case 'danger': return { container: { backgroundColor: colors.danger + '20' }, text: { color: colors.danger } };
      case 'aog': return { container: { backgroundColor: '#ef4444' + '20' }, text: { color: '#ef4444' } }; // Use danger/red for AOG
      case 'default':
      default:
        return { container: { backgroundColor: colors.border }, text: { color: colors.textSecondary } };
    }
  };

  const vs = getVariantStyles();

  return (
    <View style={[styles.badge, vs.container, style]}>
      <Text style={[styles.text, vs.text]}>{content}</Text>
    </View>
  );
}

export function FlightStatusPill({ status, style }: { status: string; style?: ViewStyle }) {
  let variant: BadgeVariant = 'default';
  const lower = status.toLowerCase();
  
  if (lower.includes('sched') || lower === 'scheduled') variant = 'primary';
  else if (lower.includes('air') || lower === 'airborne' || lower === 'enroute') variant = 'success';
  else if (lower.includes('delay') || lower === 'delayed') variant = 'warning';
  else if (lower.includes('cancel') || lower === 'cancelled') variant = 'danger';
  else if (lower === 'arrived' || lower === 'completed') variant = 'default';

  return <Badge variant={variant} style={style}>{status.toUpperCase()}</Badge>;
}

export function AircraftStatusPill({ status, style }: { status: string; style?: ViewStyle }) {
  const lower = status.toLowerCase();
  let variant: BadgeVariant = 'success';
  const isAog = lower === 'aog' || lower === 'grounded';
  
  if (isAog) variant = 'aog';
  else if (lower.includes('maint') || lower === 'maintenance') variant = 'warning';

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAog) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isAog, pulseAnim]);

  return (
    <View style={[styles.aircraftContainer, style]}>
      {isAog && (
        <Animated.View 
          style={[styles.pulseDot, { opacity: pulseAnim, backgroundColor: '#ef4444' }]} 
        />
      )}
      <Badge variant={variant}>{status.toUpperCase()}</Badge>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    borderWidth: 0,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  aircraftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  }
});
