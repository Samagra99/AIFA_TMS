import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { 
  useTechLog, 
  useClearDispatch, 
  useAcceptAircraft, 
  useCloseout 
} from '../../../api/hooks';
import { useTheme } from '../../../theme';
import { Card, Button, Input, Spinner, Badge } from '../../../components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DispatchDetailScreen() {
  const { flightId } = useLocalSearchParams();
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const { data: techLog, isLoading } = useTechLog(flightId as string);
  const clearDispatch = useClearDispatch();
  const acceptAircraft = useAcceptAircraft();
  const closeout = useCloseout();

  // Step 1 State
  const [briefingCompleted, setBriefingCompleted] = useState(false);
  const [baTestCleared, setBaTestCleared] = useState(false);
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
        promptMessage: 'Authenticate to sign',
      });
      if (result.success) {
        callback();
      } else {
        Alert.alert('Authentication failed', 'Please try again or use PIN.');
      }
    } else {
      Alert.alert('Biometrics not available', 'Please enter your PIN instead.');
    }
  };

  const handleClearDispatch = () => {
    if (!briefingCompleted || !baTestCleared || !dispatcherPin) {
      Alert.alert('Error', 'Please complete all fields and enter PIN');
      return;
    }
    clearDispatch.mutate({
      id: techLog?.id || (flightId as string),
      dispatcher_pin: dispatcherPin,
      preflight_briefing_completed: briefingCompleted,
      ba_test_cleared: baTestCleared,
      cfi_override: false,
    }, {
      onSuccess: () => router.back()
    });
  };

  const handleAcceptAircraft = () => {
    if (!hobbsOut || !tachoOut) {
      Alert.alert('Error', 'Please enter Hobbs and Tacho Out values');
      return;
    }
    const payload = {
      id: techLog?.id || (flightId as string),
      hobbs_out: String(hobbsOut),
      tacho_out: String(tachoOut),
      crew_pin: crewPin
    };

    if (!crewPin) {
      handleBiometricAuth(() => acceptAircraft.mutate(payload, { onSuccess: () => router.back() }));
    } else {
      acceptAircraft.mutate(payload, { onSuccess: () => router.back() });
    }
  };

  const handleCloseout = () => {
    if (!hobbsIn || !tachoIn || !offBlockTime || !onBlockTime) {
      Alert.alert('Error', 'Please fill in all times');
      return;
    }
    
    const payload = {
      id: techLog?.id || (flightId as string),
      hobbs_in: String(hobbsIn),
      tacho_in: String(tachoIn),
      off_block_time: offBlockTime,
      on_block_time: onBlockTime,
      nil_defects: nilDefects,
      snags: nilDefects ? [] : [{ description: snagDescription, category: isGo ? 'go' : 'no_go', triggers_aog: !isGo }],
      crew_pin: closeoutPin
    };

    if (!closeoutPin) {
      handleBiometricAuth(() => closeout.mutate(payload, { onSuccess: () => router.back() }));
    } else {
      closeout.mutate(payload, { onSuccess: () => router.back() });
    }
  };

  const renderComplianceItem = (label: string, isCompliant: boolean) => (
    <View style={styles.complianceRow}>
      <Text style={styles.complianceLabel}>{label}</Text>
      <Badge variant={isCompliant ? 'success' : 'danger'}>{isCompliant ? 'OK' : 'FAIL'}</Badge>
    </View>
  );

  const status = techLog?.status || 'open';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Flight Tech Log</Text>
          <Badge variant="primary">{status.toUpperCase()}</Badge>
        </View>

        {status === 'open' && !techLog?.dispatch_cleared_at && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Step 1: Dispatch Clearance</Text>
            
            <View style={styles.complianceGrid}>
              {renderComplianceItem('Medical', true)}
              {renderComplianceItem('SPL Valid', true)}
              {renderComplianceItem('FDTL Checks', true)}
              {renderComplianceItem('Aircraft Status', true)}
              {renderComplianceItem('Ferry Requirements', true)}
              {renderComplianceItem('Crosswind Limits', true)}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Briefing Completed</Text>
              <Switch value={briefingCompleted} onValueChange={setBriefingCompleted} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.label}>BA Test Cleared</Text>
              <Switch value={baTestCleared} onValueChange={setBaTestCleared} />
            </View>

            <Input
              placeholder="Dispatcher PIN"
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

        {status === 'open' && techLog?.dispatch_cleared_at && !techLog?.accepted_at && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Step 2: Aircraft Acceptance</Text>
            
            <Input
              placeholder="Hobbs Out"
              value={hobbsOut}
              onChangeText={setHobbsOut}
              keyboardType="decimal-pad"
            />
            <Input
              placeholder="Tacho Out"
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
              title="Accept Aircraft"
              onPress={handleAcceptAircraft}
              loading={acceptAircraft.isPending}
              style={styles.actionBtn}
            />
          </Card>
        )}

        {status === 'open' && techLog?.accepted_at && (
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
                {!isGo && <Text style={styles.aogWarning}>Warning: This will ground the aircraft (AOG)</Text>}
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
