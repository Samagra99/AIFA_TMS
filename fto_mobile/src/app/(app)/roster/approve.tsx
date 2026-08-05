import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { 
  useAllPlansForRequest, 
  useApproveRoster, 
  useRejectRoster, 
  useApproveOverride, 
  useRejectCFIOverride 
} from '../../../api/hooks';
import { useTheme } from '../../../theme';
import { Card, Button, Input, Spinner, Badge } from '../../../components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CFIApproveRosterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const theme = useTheme();
  const styles = createStyles(theme);

  const requestId = (params.requestId as string) || ''; 
  const { data: plans, isLoading } = useAllPlansForRequest(requestId);
  
  const approveRoster = useApproveRoster();
  const rejectRoster = useRejectRoster();
  const approveOverride = useApproveOverride();
  const rejectOverride = useRejectCFIOverride();

  const [rejectReason, setRejectReason] = useState('');

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Spinner size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const handleBiometricAuth = async (callback: () => void) => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to Approve Roster',
      });
      if (result.success) {
        callback();
      } else {
        Alert.alert('Authentication failed', 'Could not verify identity.');
      }
    } else {
      // Fallback to direct approval if biometrics unavailable (in real app, ask for PIN)
      callback();
    }
  };

  const handleApprove = () => {
    handleBiometricAuth(() => {
      approveRoster.mutate({ id: requestId }, {
        onSuccess: () => {
          Alert.alert('Success', 'Roster approved and published.');
          router.back();
        }
      });
    });
  };

  const handleReject = () => {
    if (!rejectReason) {
      Alert.alert('Error', 'Please provide a reason for rejection.');
      return;
    }
    rejectRoster.mutate({ id: requestId, comments: rejectReason }, {
      onSuccess: () => {
        Alert.alert('Success', 'Roster rejected.');
        router.back();
      }
    });
  };

  const handleOverrideAction = (entryId: string, action: 'approve' | 'reject') => {
    if (action === 'approve') {
      approveOverride.mutate(entryId);
    } else {
      rejectOverride.mutate(entryId);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Review Roster Plan</Text>

        {!plans || plans.length === 0 ? (
          <Text style={styles.emptyText}>No plans submitted yet.</Text>
        ) : (
          plans.map((plan: any) => (
            <Card key={plan.id} style={styles.planCard}>
              <View style={styles.planHeader}>
                <Text style={styles.instructorName}>{plan.instructor_name || plan.instructor?.name}</Text>
                <Badge variant="primary">{`${plan.entries?.length || 0} Entries`}</Badge>
              </View>

              {plan.entries?.map((entry: any) => (
                <View key={entry.id} style={[styles.entryRow, entry.cfi_override_requested && styles.overrideBg]}>
                  <View style={styles.entryDetails}>
                    <Text style={styles.studentName}>{entry.student_name || entry.student?.name}</Text>
                    <Text style={styles.entrySub}>
                      {entry.exercise_code} • {entry.estimated_duration_min}m
                    </Text>
                  </View>
                  
                  {entry.cfi_override_requested ? (
                    <View style={styles.overrideActions}>
                      <Badge variant="warning">OVERRIDE REQ</Badge>
                      <View style={styles.overrideBtns}>
                        <TouchableOpacity 
                          style={[styles.smallBtn, { backgroundColor: theme.colors.success }]}
                          onPress={() => handleOverrideAction(entry.id, 'approve')}
                        >
                          <Text style={styles.smallBtnText}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.smallBtn, { backgroundColor: theme.colors.danger }]}
                          onPress={() => handleOverrideAction(entry.id, 'reject')}
                        >
                          <Text style={styles.smallBtnText}>✗</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Badge variant="success">OK</Badge>
                  )}
                </View>
              ))}
            </Card>
          ))
        )}

        <View style={styles.actionContainer}>
          <Input 
            placeholder="Reason for rejection (if rejecting)"
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            style={styles.reasonInput}
          />
          
          <Button 
            title="Approve Roster" 
            onPress={handleApprove} 
            loading={approveRoster.isPending}
            style={styles.actionBtn}
          />
          <Button 
            title="Reject Roster" 
            onPress={handleReject} 
            loading={rejectRoster.isPending}
            variant="danger"
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  planCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  instructorName: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  overrideBg: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)', // amber tinted bg
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 4,
  },
  entryDetails: {
    flex: 1,
  },
  studentName: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  entrySub: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.subtext,
  },
  overrideActions: {
    alignItems: 'flex-end',
  },
  overrideBtns: {
    flexDirection: 'row',
    marginTop: 4,
  },
  smallBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  smallBtnText: {
    color: '#fff',
    fontFamily: theme.fonts.bold,
  },
  actionContainer: {
    marginTop: theme.spacing.lg,
  },
  reasonInput: {
    height: 80,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.md,
  },
  actionBtn: {
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.md,
    color: theme.colors.subtext,
    textAlign: 'center',
  }
});
