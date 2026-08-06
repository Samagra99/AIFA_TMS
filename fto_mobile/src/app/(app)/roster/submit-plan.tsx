import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  useMyStudents, 
  useMyPlan, 
  useCreateInstructorPlan, 
  useAddPlanEntry, 
  useDeletePlanEntry,
  useSubmitPlan, 
  useMarkLeave 
} from '../../../api/hooks';
import { useTheme } from '../../../theme';
import { Card, Button, Input, Spinner, Badge } from '../../../components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SubmitPlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const theme = useTheme();
  const styles = createStyles(theme);

  const activeRequestId = (params.requestId as string) || '';
  const { data: students, isLoading: studentsLoading } = useMyStudents();
  const { data: plan, isLoading: planLoading, refetch: refetchPlan } = useMyPlan(activeRequestId);
  const createPlan = useCreateInstructorPlan();
  const addEntry = useAddPlanEntry();
  const deleteEntry = useDeletePlanEntry();
  const submitPlan = useSubmitPlan();
  const markLeave = useMarkLeave();

  const [searchQuery, setSearchQuery] = useState('');
  
  // Local state for forming a new entry
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [flightType, setFlightType] = useState('dual');
  
  // Characteristic Flags
  const [isCrossCountry, setIsCrossCountry] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [isInstrumentSimulated, setIsInstrumentSimulated] = useState(false);
  const [isInstrumentActual, setIsInstrumentActual] = useState(false);
  const [isSkillTest, setIsSkillTest] = useState(false);
  const [isSimulator, setIsSimulator] = useState(false);
  const [isFerry, setIsFerry] = useState(false);
  
  // External Examiner
  const [isExternalP1, setIsExternalP1] = useState(false);
  const [externalP1Name, setExternalP1Name] = useState('');

  const [duration, setDuration] = useState('1.5');
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const isLoading = studentsLoading || planLoading;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Spinner size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const handleCreatePlan = () => {
    createPlan.mutate({
      plan_request: activeRequestId,
      availability_start: '06:00',
      availability_end: '18:00',
      notes: 'Available all day'
    }, {
      onSuccess: () => refetchPlan()
    });
  };

  const handleAddEntry = () => {
    if (!plan) return;
    if (!selectedStudent) {
      Alert.alert('Error', 'Please select a student');
      return;
    }
    
    const exercise = selectedStudent.next_exercise_id || 'EX-1';

    addEntry.mutate({
      plan: plan.id,
      student: selectedStudent.student_id || selectedStudent.id,
      exercise: exercise,
      flight_type: flightType,
      is_cross_country: isCrossCountry,
      is_night: isNight,
      is_instrument_simulated: isInstrumentSimulated,
      is_instrument_actual: isInstrumentActual,
      is_skill_test: isSkillTest,
      is_simulator: isSimulator,
      is_ferry: isFerry,
      is_external_p1: isExternalP1,
      external_p1_name: externalP1Name,
      estimated_duration_min: Math.round(parseFloat(duration) * 60),
      cfi_override_requested: !!overrideReason,
      cfi_override_reason: overrideReason,
    }, {
      onSuccess: () => {
        setSelectedStudent(null);
        setNotes('');
        setOverrideReason('');
        refetchPlan();
      }
    });
  };

  const handleSubmitPlan = () => {
    if (!plan) return;
    submitPlan.mutate(plan.id, {
      onSuccess: () => {
        Alert.alert('Success', 'Plan submitted successfully');
        router.back();
      }
    });
  };

  const handleMarkLeave = () => {
    markLeave.mutate({ plan_request: activeRequestId }, {
      onSuccess: () => {
        Alert.alert('Success', 'Leave marked');
        router.back();
      }
    });
  };

  if (!plan) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>You do not have a draft plan for this request.</Text>
          <Button title="Start Draft Plan" onPress={handleCreatePlan} loading={createPlan.isPending} style={styles.marginTop} />
          <Button title="Mark Leave" onPress={handleMarkLeave} loading={markLeave.isPending} variant="secondary" style={styles.marginTop} />
        </View>
      </SafeAreaView>
    );
  }

  const filteredStudents = (students || []).filter((s: any) => 
    (s.student_name || s.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Submit Roster Plan</Text>
        
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Add Entry</Text>
          <Input 
            placeholder="Search students..." 
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          {!selectedStudent && (
            <View style={styles.studentList}>
              {filteredStudents.map((student: any) => (
                <TouchableOpacity 
                  key={student.student_id || student.id} 
                  style={styles.studentItem}
                  onPress={() => setSelectedStudent(student)}
                >
                  <Text style={styles.studentName}>{student.student_name || student.name}</Text>
                  <Badge variant="primary">{`${student.hours_total || '0'} hrs`}</Badge>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedStudent && (
            <View style={styles.selectedStudentContainer}>
              <View style={styles.selectedHeader}>
                <Text style={styles.selectedName}>{selectedStudent.student_name || selectedStudent.name}</Text>
                <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Next Exercise:</Text>
              <View style={styles.exerciseRow}>
                <Text style={styles.exerciseCode}>{selectedStudent.next_exercise_code || 'N/A'}</Text>
                {selectedStudent.next_prereq_met ? (
                  <Badge variant="success">Prereqs Met</Badge>
                ) : (
                  <Badge variant="warning">Prereqs Warning</Badge>
                )}
              </View>

              <Text style={styles.label}>Flight Type:</Text>
              <View style={styles.radioGroup}>
                {['dual', 'solo'].map(type => (
                  <TouchableOpacity 
                    key={type}
                    style={[styles.radioBtn, flightType === type && styles.radioBtnActive]}
                    onPress={() => setFlightType(type)}
                  >
                    <Text style={[styles.radioText, flightType === type && styles.radioTextActive]}>
                      {type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Flight Characteristics:</Text>
              <View style={styles.flagsContainer}>
                <TouchableOpacity style={[styles.flagBtn, isCrossCountry && styles.flagBtnActive]} onPress={() => setIsCrossCountry(!isCrossCountry)}>
                  <Text style={[styles.flagText, isCrossCountry && styles.flagTextActive]}>Cross-Country</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.flagBtn, isNight && styles.flagBtnActive]} onPress={() => setIsNight(!isNight)}>
                  <Text style={[styles.flagText, isNight && styles.flagTextActive]}>Night</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.flagBtn, isInstrumentSimulated && styles.flagBtnActive]} onPress={() => setIsInstrumentSimulated(!isInstrumentSimulated)}>
                  <Text style={[styles.flagText, isInstrumentSimulated && styles.flagTextActive]}>Inst (Sim)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.flagBtn, isInstrumentActual && styles.flagBtnActive]} onPress={() => setIsInstrumentActual(!isInstrumentActual)}>
                  <Text style={[styles.flagText, isInstrumentActual && styles.flagTextActive]}>Inst (Act)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.flagBtn, isSimulator && styles.flagBtnActive]} onPress={() => setIsSimulator(!isSimulator)}>
                  <Text style={[styles.flagText, isSimulator && styles.flagTextActive]}>Simulator (FSTD)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.flagBtn, isSkillTest && styles.flagBtnActive]} onPress={() => setIsSkillTest(!isSkillTest)}>
                  <Text style={[styles.flagText, isSkillTest && styles.flagTextActive]}>Skill Test</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.flagBtn, isFerry && styles.flagBtnActive]} onPress={() => setIsFerry(!isFerry)}>
                  <Text style={[styles.flagText, isFerry && styles.flagTextActive]}>Ferry Flight</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.examinerContainer}>
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsExternalP1(!isExternalP1)}>
                  <View style={[styles.checkbox, isExternalP1 && styles.checkboxActive]} />
                  <Text style={styles.checkboxLabel}>External P1 / DGCA Examiner</Text>
                </TouchableOpacity>
                {isExternalP1 && (
                  <Input 
                    value={externalP1Name}
                    onChangeText={setExternalP1Name}
                    placeholder="Enter Examiner Name & Desig..."
                    style={styles.marginTop}
                  />
                )}
              </View>

              <Text style={styles.label}>Duration (hrs):</Text>
              <Input 
                value={duration}
                onChangeText={setDuration}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Notes:</Text>
              <Input 
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes for CFI/Dispatch"
              />

              {!selectedStudent.next_prereq_met && (
                <>
                  <Text style={[styles.label, { color: theme.colors.warning }]}>Override Reason (Required for Prereq Warning):</Text>
                  <Input 
                    value={overrideReason}
                    onChangeText={setOverrideReason}
                    placeholder="Provide justification for CFI"
                  />
                </>
              )}

              <Button 
                title="Add Entry" 
                onPress={handleAddEntry} 
                loading={addEntry.isPending}
                style={styles.marginTop}
              />
            </View>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Draft Plan Entries</Text>
          {plan.entries?.length === 0 ? (
            <Text style={styles.emptyText}>No entries added yet.</Text>
          ) : (
            plan.entries?.map((entry: any, index: number) => (
              <View key={index} style={styles.entryRow}>
                <View>
                  <Text style={styles.entryStudent}>{entry.student_name || entry.student?.name}</Text>
                  <Text style={styles.entryDetails}>{entry.exercise_code} | {entry.estimated_duration_min}m</Text>
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => {
                  deleteEntry.mutate(entry.id, {
                    onSuccess: () => refetchPlan()
                  });
                }}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        <Button 
          title="Submit Plan" 
          onPress={handleSubmitPlan} 
          loading={submitPlan.isPending}
          disabled={plan.entries?.length === 0}
          style={styles.actionBtn}
        />
        <Button 
          title="Mark Leave Instead" 
          onPress={handleMarkLeave} 
          loading={markLeave.isPending}
          variant="secondary"
          style={styles.actionBtn}
        />
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
    padding: theme.spacing.xl,
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
  sectionCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  studentList: {
    maxHeight: 200,
    marginTop: theme.spacing.sm,
  },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  studentName: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  selectedStudentContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  selectedName: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.primary,
  },
  clearText: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.medium,
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.subtext,
    marginTop: theme.spacing.sm,
    marginBottom: 4,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: 4,
    marginBottom: theme.spacing.sm,
  },
  exerciseCode: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
  },
  radioBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  radioBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  radioText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.subtext,
  },
  radioTextActive: {
    color: '#fff',
  },
  marginTop: {
    marginTop: theme.spacing.md,
  },
  flagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
  },
  flagBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: theme.colors.background,
  },
  flagBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  flagText: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.subtext,
  },
  flagTextActive: {
    color: '#fff',
    fontFamily: theme.fonts.bold,
  },
  examinerContainer: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    marginVertical: theme.spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: 8,
    borderRadius: 3,
  },
  checkboxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  entryStudent: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  entryDetails: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.subtext,
  },
  removeBtn: {
    padding: theme.spacing.sm,
  },
  removeText: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
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
