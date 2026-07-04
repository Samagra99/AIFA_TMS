import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AlertData } from '../types';
import { Badge } from './ui/Badge';
import { C, SEVERITY_COLOR } from '../theme/colors';
import { useAlertsStore } from '../store/alerts.store';

interface AlertCardProps {
  alert: AlertData;
}

const ALERT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  AOG: 'airplane-outline',
  SNAG: 'construct-outline',
  WEATHER: 'thunderstorm-outline',
  FDTL: 'time-outline',
  MEDICAL: 'medical-outline',
};

export function AlertCard({ alert }: AlertCardProps) {
  const markRead = useAlertsStore((s) => s.markRead);
  const severityColor = SEVERITY_COLOR[alert.severity] ?? C.textSecondary;
  const icon = ALERT_ICON[alert.type] ?? 'warning-outline';

  const timeStr = new Date(alert.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => markRead(alert.id)}
      style={[
        styles.card,
        { borderLeftColor: severityColor },
        alert.isResolved && styles.resolved,
      ]}
    >
      {/* Unread dot */}
      {!alert.isRead && !alert.isResolved && (
        <View style={[styles.unreadDot, { backgroundColor: severityColor }]} />
      )}

      <View style={[styles.iconWrap, { backgroundColor: `${severityColor}20` }]}>
        <Ionicons name={icon} size={22} color={severityColor} />
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>{alert.title}</Text>
          <Text style={styles.time}>{timeStr}</Text>
        </View>

        <Text style={styles.message} numberOfLines={2}>{alert.message}</Text>

        <View style={styles.metaRow}>
          <Badge label={alert.severity} kind="severity" small />
          <Badge label={alert.type} small color={C.textMuted} bgColor={C.bgElevated} />
          {alert.affectedFlightsCount > 0 && (
            <Text style={styles.affected}>
              {alert.affectedFlightsCount} flight{alert.affectedFlightsCount > 1 ? 's' : ''} affected
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'flex-start',
  },
  resolved: { opacity: 0.45 },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flex: 1, gap: 5 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  time: { color: C.textMuted, fontSize: 12 },
  message: { color: C.textSecondary, fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  affected: { color: C.caution, fontSize: 11, fontWeight: '600', alignSelf: 'center' },
});
