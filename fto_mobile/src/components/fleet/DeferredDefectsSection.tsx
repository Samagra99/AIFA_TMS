import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { useDeferredSnags, useSetDeferredSnagTimeline, useReclassifyNoGo } from '../../api/hooks';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme';
import { Badge, Button, Input } from '../ui';
import type { SnagEntry } from '../../types';

export function DeferredDefectsSection() {
  const user = useAuthStore((s) => s.user);
  const isCAMO = user?.role === 'camo';
  const { colors, fonts, fontSizes, spacing } = useTheme();

  const { data: snagsResp, isLoading, refetch } = useDeferredSnags();
  const setTimeline = useSetDeferredSnagTimeline();
  const reclassifyNoGo = useReclassifyNoGo();

  const [selectedSnag, setSelectedSnag] = useState<SnagEntry | null>(null);
  const [dueDateInput, setDueDateInput] = useState('');
  const [camoNotesInput, setCamoNotesInput] = useState('');

  const snagsList = snagsResp?.results || (Array.isArray(snagsResp) ? snagsResp : []);
  const activeDeferredSnags = snagsList.filter(
    (s: SnagEntry) => (s.category === 'go' || s.is_deferred) && !s.resolved_at
  );

  if (isLoading || activeDeferredSnags.length === 0) return null;

  const handleOpenTimelineModal = (snag: SnagEntry) => {
    setSelectedSnag(snag);
    setDueDateInput(snag.resolution_due_date || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
    setCamoNotesInput(snag.camo_notes || '');
  };

  const handleSaveTimeline = () => {
    if (!selectedSnag || !dueDateInput) return;
    setTimeline.mutate(
      {
        id: selectedSnag.id,
        resolution_due_date: dueDateInput,
        camo_notes: camoNotesInput,
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'CAMO resolution timeline saved.');
          setSelectedSnag(null);
          refetch();
        },
        onError: () => {
          Alert.alert('Error', 'Failed to set resolution timeline.');
        },
      }
    );
  };

  const handleReclassifyNoGo = (snag: SnagEntry) => {
    Alert.alert(
      'Ground Aircraft (NO-GO)',
      `Reclassify snag for "${snag.aircraft_tail_number || 'Aircraft'}" as NO-GO? This will immediately ground the aircraft (AOG).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ground Aircraft',
          style: 'destructive',
          onPress: () => {
            reclassifyNoGo.mutate(
              {
                id: snag.id,
                camo_notes: 'Reclassified as NO-GO (AOG) by CAMO inspection',
              },
              {
                onSuccess: () => {
                  Alert.alert('Grounded', 'Aircraft is now grounded (AOG).');
                  refetch();
                },
              }
            );
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: colors.warning,
      borderWidth: 1,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: spacing.xs,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.sm,
      color: colors.warning,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardOverdue: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerLight || 'rgba(239, 68, 68, 0.05)',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    tailNumber: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.md,
      color: colors.text,
    },
    description: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.sm,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
    metaText: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.xs,
      color: colors.subtext,
    },
    camoNotes: {
      fontFamily: fonts.medium,
      fontSize: fontSizes.xs,
      color: colors.primary,
      marginTop: spacing.xs,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: spacing.sm,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing.lg,
    },
    modalTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.lg,
      color: colors.text,
      marginBottom: spacing.md,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: spacing.md,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Active Deferred Defects ({activeDeferredSnags.length})</Text>
        </View>
        <Badge variant="warning">MEL / Deferrals</Badge>
      </View>

      {activeDeferredSnags.map((snag: SnagEntry) => {
        const isOverdue = snag.is_overdue || (snag.resolution_due_date && new Date(snag.resolution_due_date) < new Date());
        return (
          <View key={snag.id} style={[styles.card, isOverdue && styles.cardOverdue]}>
            <View style={styles.cardHeader}>
              <Text style={styles.tailNumber}>{snag.aircraft_tail_number || 'Aircraft Defect'}</Text>
              {isOverdue ? <Badge variant="danger">OVERDUE</Badge> : <Badge variant="warning">DEFERRED</Badge>}
            </View>
            <Text style={styles.description}>{snag.description}</Text>
            
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                Due: {snag.resolution_due_date ? new Date(snag.resolution_due_date).toLocaleDateString() : 'Timeline Pending'}
              </Text>
              <Text style={styles.metaText}>Reported: {new Date(snag.reported_at).toLocaleDateString()}</Text>
            </View>

            {!!snag.camo_notes && (
              <Text style={styles.camoNotes}>CAMO Note: {snag.camo_notes}</Text>
            )}

            {isCAMO && (
              <View style={styles.actionsRow}>
                <Button
                  variant="secondary"
                  size="xs"
                  onPress={() => handleOpenTimelineModal(snag)}
                >
                  Set Timeline
                </Button>
                <Button
                  variant="danger"
                  size="xs"
                  onPress={() => handleReclassifyNoGo(snag)}
                >
                  Ground (NO-GO)
                </Button>
              </View>
            )}
          </View>
        );
      })}

      {/* Modal for setting CAMO timeline */}
      <Modal visible={!!selectedSnag} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Defect Timeline</Text>
            <Input
              placeholder="Resolution Due Date (YYYY-MM-DD)"
              value={dueDateInput}
              onChangeText={setDueDateInput}
            />
            <Input
              placeholder="CAMO Notes / Action Plan"
              value={camoNotesInput}
              onChangeText={setCamoNotesInput}
              multiline
            />
            <View style={styles.modalButtons}>
              <Button variant="ghost" onPress={() => setSelectedSnag(null)}>
                Cancel
              </Button>
              <Button onPress={handleSaveTimeline} loading={setTimeline.isPending}>
                Save Timeline
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
