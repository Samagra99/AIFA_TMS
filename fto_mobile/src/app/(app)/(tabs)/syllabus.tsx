import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useTheme } from '../../../theme';
import { useSyllabusStages, useSyllabusExercises } from '../../../api/hooks';

export default function SyllabusScreen() {
  const { colors, fonts, fontSizes, spacing } = useTheme();
  const { data: stagesData, isLoading, refetch } = useSyllabusStages();
  const stages = stagesData?.results || stagesData || [];
  const [refreshing, setRefreshing] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: spacing.md,
    },
    stageCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    stageHeader: {
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    stageTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.md,
      color: colors.text,
    },
    exercisesContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    exerciseRow: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    exerciseCode: {
      fontFamily: fonts.bold,
      fontSize: fontSizes.sm,
      color: colors.primary,
      width: 60,
    },
    exerciseTitle: {
      fontFamily: fonts.regular,
      fontSize: fontSizes.sm,
      color: colors.text,
      flex: 1,
    },
    passGrade: {
      fontFamily: fonts.medium,
      fontSize: fontSizes.xs,
      color: colors.subtext,
      marginLeft: spacing.sm,
    }
  });

  const ExercisesList = ({ stageId }: { stageId: string }) => {
    const { data: exercisesData } = useSyllabusExercises({ stage: stageId });
    const exercises = exercisesData?.results || exercisesData || [];
    
    return (
      <View style={styles.exercisesContainer}>
        {Array.isArray(exercises) && exercises.map((ex: any) => (
          <View key={ex.id} style={styles.exerciseRow}>
            <Text style={styles.exerciseCode}>{ex.code}</Text>
            <Text style={styles.exerciseTitle}>{ex.title}</Text>
            <Text style={styles.passGrade}>Pass: {ex.pass_grade || 'N/A'}</Text>
          </View>
        ))}
        {(!exercises || exercises.length === 0) && (
          <View style={styles.exerciseRow}>
            <Text style={styles.exerciseTitle}>No exercises found</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {Array.isArray(stages) && stages.map((stage: any) => (
          <View key={stage.id} style={styles.stageCard}>
            <TouchableOpacity 
              style={styles.stageHeader}
              onPress={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
            >
              <Text style={styles.stageTitle}>{stage.name || stage.title || `Stage ${stage.stage_number}`}</Text>
              <Text style={styles.stageTitle}>{expandedStage === stage.id ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            
            {expandedStage === stage.id && (
              <ExercisesList stageId={stage.id} />
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
