import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { 
  useTechLog, 
  useCreateTechLog,
  useClearDispatch, 
  useAcceptAircraft, 
  useCloseout,
  useFlight
} from '../../../api/hooks';
import { useTheme } from '../../../theme';
import { Card, Button, Input, Spinner, Badge } from '../../../components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DispatchDetailScreen() {
  const { flightId } = useLocalSearchParams();
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const { data: flight, isLoading: flightLoading } = useFlight(flightId as string);
  const { data: techLog, isLoading: techLogLoading, refetch: refetchTechLog } = useTechLog(flightId as string);
  
  const createTechLog = useCreateTechLog();
  const clearDispatch = useClearDispatch();
  const acceptAircraft = useAcceptAircraft();
  const closeout = useCloseout();

  // Step 1 State
  const [briefingCompleted, setBriefingCompleted] = useState(true);
  const [baTestCleared, setBaTestCleared] = useState(true);
  const [dispatcherPin, setDispatcherPin] = useState('');

  // Step 2 State
  const [hobbsOut, setHobbsOut] = useState('');
  const [tachoOut, setTachoOut] = useState('');
  const [crewPin, setCrewPin] = useState('');

  // Step 3 State
  const [hobbsIn, setHobbsIn] = useState('');
  const [tachoIn, setTachoIn] = useState('');
  const [offBlockTime, setOffBlockTime] = useState('');
  const [onBlockTime, setOnBlockTime] = useState('');
  const [nilDefects, setNilDefects] = useState(true);
  const [snagDescription, setSnagDescription] = useState('');
  const [isGo, setIsGo] = useState(true);
  const [closeoutPin, setCloseoutPin] = useState('');

  const isLoading = flightLoading || techLogLoading;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Spinner size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const handleInitializeTechLog = () => {
    const aircraftId = flight?.aircraft;
    if (!flightId || !aircraftId) {
      Alert.alert('Error', 'Aircraft detail not found for this flight.');
      return;
    }
    createTechLog.mutate(
      { flight: flightId as string, aircraft: aircraftId },
      {
        onSuccess: () => {
          Alert.alert('Initialized', 'Tech Log initialized for flight.');
          refetchTechLog();
        },
        onError: (err: any) => {
          Alert.alert('Initialization Failed', err?.response?.data?.detail || 'Could not initialize Tech Log.');
        },
      }
    );
  };

  const handleBiometricAuth = async (callback: () => void) => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to sign',
      });
      if (result.success) {
        callback();
      } else {
        Alert.alert('Authentication failed', 'Please try again or enter your PIN.');
      }
    } else {
      Alert.alert('Biometrics not available', 'Please enter your PIN instead.');
    }
  };

  const handleClearDispatch = () => {
    if (!techLog?.id) {
      Alert.alert('Error', 'Tech Log not initialized yet. Please initialize first.');
      return;
    }
    if (!briefingCompleted || !baTestCleared || !dispatcherPin) {
      Alert.alert('Error', 'Please check Briefing & BA tests and enter Dispatcher PIN (e.g. 1234)');
      return;
    }
    clearDispatch.mutate({
      id: techLog.id,
      dispatcher_pin: dispatcherPin,
      preflight_briefing_completed: briefingCompleted,
      ba_test_cleared: baTestCleared,
      cfi_override: false,
    }, {
      onSuccess: () => {
        Alert.alert('Cleared', 'Aircraft cleared for dispatch!');
        refetchTechLog();
      },
      onError: (err: any) => {
        const detail = err?.response?.data?.detail || err?.response?.data?.rules?.detail || 'Dispatch verification failed.';
        Alert.alert('Dispatch Failed', detail);
      }
    });
  };

  const handleAcceptAircraft = () => {
    if (!techLog?.id) return;
    if (!hobbsOut || !tachoOut) {
      Alert.alert('Error', 'Please enter Hobbs and Tacho Out values.');
      return;
    }
    const payload = {
      id: techLog.id,
      hobbs_out: String(hobbsOut),
      tacho_out: String(tachoOut),
      crew_pin: crewPin
    };

    const executeAccept = () => {
      acceptAircraft.mutate(payload, {
        onSuccess: () => {
          Alert.alert('Accepted', 'Aircraft accepted by crew. Flight dispatched!');
          refetchTechLog();
        },
        onError: (err: any) => {
          Alert.alert('Acceptance Failed', err?.response?.data?.detail || 'Invalid PIN or meter readings.');
        }
      });
    };

    if (!crewPin) {
      handleBiometricAuth(executeAccept);
    } else {
      executeAccept();
    }
  };

  const handleCloseout = () => {
    if (!techLog?.id) return;
    if (!hobbsIn || !tachoIn || !offBlockTime || !onBlockTime) {
      Alert.alert('Error', 'Please fill in all Hobbs, Tacho, and Off/On Block times.');
      return;
    }
    
    const payload = {
      id: techLog.id,
      hobbs_in: String(hobbsIn),
      tacho_in: String(tachoIn),
      off_block_time: offBlockTime,
      on_block_time: onBlockTime,
      nil_defects: nilDefects,
      snags: nilDefects ? [] : [{ description: snagDescription, category: isGo ? 'go' : 'no_go', triggers_aog: !isGo }],
      crew_pin: closeoutPin
    };

    const executeCloseout = () => {
      closeout.mutate(payload, {
        onSuccess: () => {
          Alert.alert('Closed Out', 'Tech log closed out successfully!');
          router.back();
        },
        onError: (err: any) => {
          Alert.alert('Closeout Failed', err?.response?.data?.detail || 'Validation error during closeout.');
        }
      });
    };

    if (!closeoutPin) {
      handleBiometricAuth(executeCloseout);
    } else {
      executeCloseout();
    }
  };

  const renderComplianceItem = (label: string, isCompliant: boolean) => (
    <View style={styles.complianceRow}>
      <Text style={styles.complianceLabel}>{label}</Text>
      <Badge variant={isCompliant ? 'success' : 'danger'}>{isCompliant ? 'OK' : 'FAIL'}</Badge>
    </View>
  );

  const status = techLog?.status || flight?.status || 'scheduled';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Flight Tech Log</Text>
            <Text style={styles.subtitle}>
              {flight?.aircraft_detail?.tail_number || flight?.aircraft_name || 'Aircraft'} • {flight?.student_name || 'Sortie'}
            </Text>
          </View>
          <Badge variant="primary">{String(status).toUpperCase()}</Badge>
        </View>

        {/* Step 0: Initialize Tech Log if not created yet */}
        {!techLog && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Initialize Flight Tech Log</Text>
            <Text style={styles.infoText}>
              No Tech Log record found for this flight. Click below to initialize aircraft dispatch clearance.
            </Text>
            <Button
              title="Initialize Tech Log"
              onPress={handleInitializeTechLog}
              loading={createTechLog.isPending}
              style={styles.actionBtn}
            />
          </Card>
        )}

        {/* Step 1: Dispatch Clearance */}
        {techLog && !techLog.dispatch_cleared_at && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Step 1: Dispatch Clearance</Text>
            
            <View style={styles.complianceGrid}>
              {renderComplianceItem('Medical Status', true)}
              {renderComplianceItem('SPL Licence', true)}
              {renderComplianceItem('FDTL Checks', true)}
              {renderComplianceItem('Aircraft Status', true)}
              {renderComplianceItem('Ferry Requirements', true)}
              {renderComplianceItem('Crosswind Limits', true)}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Preflight Briefing Completed</Text>
              <Switch value={briefingCompleted} onValueChange={setBriefingCompleted} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>BA Test Cleared</Text>
              <Switch value={baTestCleared} onValueChange={setBaTestCleared} />
            </View>

            <Input
              placeholder="Dispatcher PIN (e.g. 1234)"
              value={dispatcherPin}
              onChangeText={setDispatcherPin}
              secureTextEntry
              keyboardType="number-pad"
            />

            <Button
              title="Clear for Dispatch"
              onPress={handleClearDispatch}
              loading={clearDispatch.isPending}
              style={styles.actionBtn}
            />
          </Card>
        )}

        {/* Step 2: Aircraft Acceptance */}
        {techLog && techLog.dispatch_cleared_at && !techLog.accepted_at && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Step 2: Aircraft Acceptance</Text>
            
            <Input
              placeholder="Hobbs Out (e.g. 150.2)"
              value={hobbsOut}
              onChangeText={setHobbsOut}
              keyboardType="decimal-pad"
            />
            <Input
              placeholder="Tacho Out (e.g. 142.1)"
              value={tachoOut}
              onChangeText={setTachoOut}
              keyboardType="decimal-pad"
            />
            <Input
              placeholder="Crew PIN (Leave blank for Biometrics)"
              value={crewPin}
              onChangeText={setCrewPin}
              secureTextEntry
              keyboardType="number-pad"
            />

            <Button
              title="Accept Aircraft & Depart"
              onPress={handleAcceptAircraft}
              loading={acceptAircraft.isPending}
              style={styles.actionBtn}
            />
          </Card>
        )}

        {/* Step 3: Post-Flight Closeout */}
        {techLog && techLog.accepted_at && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Step 3: Post-Flight Closeout</Text>
            
            <View style={styles.row}>
              <Input placeholder="Off-Block Time (HH:MM)" value={offBlockTime} onChangeText={setOffBlockTime} style={styles.flex1} />
              <View style={styles.spacer} />
              <Input placeholder="On-Block Time (HH:MM)" value={onBlockTime} onChangeText={setOnBlockTime} style={styles.flex1} />
            </View>
            
            <View style={styles.row}>
              <Input placeholder="Hobbs In" value={hobbsIn} onChangeText={setHobbsIn} keyboardType="decimal-pad" style={styles.flex1} />
              <View style={styles.spacer} />
              <Input placeholder="Tacho In" value={tachoIn} onChangeText={setTachoIn} keyboardType="decimal-pad" style={styles.flex1} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Nil Defects</Text>
              <Switch value={nilDefects} onValueChange={setNilDefects} />
            </View>

            {!nilDefects && (
              <View style={styles.defectsContainer}>
                <Input
                  placeholder="Snag Description"
                  value={snagDescription}
                  onChangeText={setSnagDescription}
                  multiline
                  style={styles.textArea}
                />
                <View style={styles.goNoGoRow}>
                  <TouchableOpacity onPress={() => setIsGo(true)} style={[styles.radioBtn, isGo && styles.radioBtnActive]}>
                    <Text style={[styles.radioText, isGo && styles.radioTextActive]}>GO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsGo(false)} style={[styles.radioBtn, !isGo && styles.radioBtnDangerActive]}>
                    <Text style={[styles.radioText, !isGo && styles.radioTextActive]}>NO-GO</Text>
                  </TouchableOpacity>
                </View>
                {isGo ? (
                  <Text style={[styles.aogWarning, { color: theme.colors.warning }]}>
                    Deferred Defect: Will be sent to CAMO for resolution timeline.
                  </Text>
                ) : (
                  <Text style={styles.aogWarning}>Warning: This will ground the aircraft (AOG)</Text>
                )}
              </View>
            )}

            <Input
              placeholder="Crew PIN (Leave blank for Biometrics)"
              value={closeoutPin}
              onChangeText={setCloseoutPin}
              secureTextEntry
              keyboardType="number-pad"
            />

            <Button
              title={!nilDefects && !isGo ? "Submit No-Go & Ground Aircraft" : "Close Tech Log"}
              onPress={handleCloseout}
              loading={closeout.isPending}
              variant={!nilDefects && !isGo ? "danger" : "primary"}
              style={styles.actionBtn}
            />
          </Card>
        )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.subtext,
    marginTop: 2,
  },
  infoText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.subtext,
    marginBottom: theme.spacing.md,
  },
  card: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  complianceGrid: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: 8,
  },
  complianceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  complianceLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  actionBtn: {
    marginTop: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  spacer: {
    width: theme.spacing.md,
  },
  defectsContainer: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: 8,
    marginBottom: theme.spacing.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  goNoGoRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
  },
  radioBtn: {
    flex: 1,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 4,
  },
  radioBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  radioBtnDangerActive: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger,
  },
  radioText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.subtext,
  },
  radioTextActive: {
    color: '#fff',
  },
  aogWarning: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    marginTop: theme.spacing.sm,
  }
});
