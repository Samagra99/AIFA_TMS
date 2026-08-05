import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../theme';
import { useCreateGrade } from '../../../api/hooks';
import { Button } from '../../../components/ui';

export default function GradeScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { colors, fonts, fontSizes, spacing } = useTheme();
  const { mutate: submitGrade, isPending } = useCreateGrade();
  
  const [selectedGrade, setSelectedGrade] = useState<number>(3);
  const [notes, setNotes] = useState('');

  const gradeLabels: Record<number, string> = {
    1: 'Unsatisfactory',
    2: 'Below Average',
    3: 'Average',
    4: 'Above Average',
    5: 'Excellent'
  };

  const handleSubmit = () => {
    if (!params.flightId || !params.studentId || !params.exerciseId) {
      Alert.alert('Error', 'Missing flight or student information for grading.');
      return;
    }
    submitGrade({
      flight: params.flightId as string,
      student: params.studentId as string,
      exercise: params.exerciseId as string,
      grade: selectedGrade,
      instructor_notes: notes,
    }, {
      onSuccess: () => {
        Alert.alert('Success', 'Grade submitted.');
        router.back();
      }
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: spacing.md,
    },
    headerCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    headerTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.lg,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    headerSub: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.sm,
      color: colors.subtext,
    },
    sectionTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.md,
      color: colors.text,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    gradeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    gradeButton: {
      flex: 1,
      marginHorizontal: spacing.xs / 2,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      alignItems: 'center',
    },
    gradeButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    gradeText: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.md,
      color: colors.text,
    },
    gradeTextSelected: {
      color: '#ffffff',
    },
    gradeLabel: {
      fontFamily: fonts.medium,
      fontSize: fontSizes.sm,
      color: colors.primary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    textArea: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: spacing.md,
      fontFamily: fonts.regular,
      fontSize: fontSizes.md,
      color: colors.text,
      minHeight: 120,
      textAlignVertical: 'top',
      marginBottom: spacing.xl,
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>{params.studentName || 'Student Name'}</Text>
          <Text style={styles.headerSub}>Aircraft: {params.tailNumber || 'N/A'} • Flight Type: {params.flightType || 'N/A'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Select Exercise</Text>
        <View style={[styles.headerCard, { paddingVertical: spacing.sm }]} >
          <Text style={styles.headerSub}>Exercise: {params.exerciseCode || 'N/A'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Grade</Text>
        <View style={styles.gradeContainer}>
          {[1, 2, 3, 4, 5].map((grade) => (
            <Pressable 
              key={grade}
              onPress={() => setSelectedGrade(grade)}
              style={[
                styles.gradeButton,
                selectedGrade === grade && styles.gradeButtonSelected
              ]}
            >
              <Text style={[
                styles.gradeText,
                selectedGrade === grade && styles.gradeTextSelected
              ]}>
                {grade}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.gradeLabel}>{gradeLabels[selectedGrade]}</Text>

        <Text style={styles.sectionTitle}>Instructor Notes</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Enter notes on performance..."
          placeholderTextColor={colors.subtext}
          value={notes}
          onChangeText={setNotes}
        />

        <Button onPress={handleSubmit} loading={isPending}>Submit Grade</Button>
      </ScrollView>
    </SafeAreaView>
  );
}
