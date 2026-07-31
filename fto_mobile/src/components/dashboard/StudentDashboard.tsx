import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useStudentSummary } from '../../api/hooks';
import { useTheme } from '../../theme';
import { Card, CardHeader, CardTitle, Badge, Spinner } from '../ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const StudentDashboard = () => {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useStudentSummary();
  const theme = useTheme();
  const styles = createStyles(theme);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Spinner size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load student dashboard</Text>
      </View>
    );
  }

  const {
    hours_total,
    hours_pic,
    hours_dual,
    hours_solo,
    target_licence,
    last_exercise,
    assigned_instructor,
    curriculum_progress,
  } = data;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top + 8, 20) }
        ]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, Student</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          <Badge variant="primary">{target_licence}</Badge>
        </View>

        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total</Text>
            <Text style={styles.kpiValue}>{hours_total}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PIC</Text>
            <Text style={styles.kpiValue}>{hours_pic}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Dual</Text>
            <Text style={styles.kpiValue}>{hours_dual}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Solo</Text>
            <Text style={styles.kpiValue}>{hours_solo}</Text>
          </View>
        </View>

        {last_exercise && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Last Sortie</CardTitle>
            </CardHeader>
            <View style={styles.exerciseRow}>
              <View>
                <Text style={styles.exerciseCode}>{last_exercise.code}</Text>
                <Text style={styles.exerciseTitle}>{last_exercise.title}</Text>
                <Text style={styles.exerciseDate}>{new Date(last_exercise.graded_at).toLocaleDateString()}</Text>
              </View>
              <View style={styles.exerciseGrade}>
                <Text style={styles.gradeText}>Grade: {last_exercise.grade}/5</Text>
                <Badge variant={last_exercise.passed ? 'success' : 'danger'}>
                  {last_exercise.passed ? 'Passed' : 'Failed'}
                </Badge>
              </View>
            </View>
          </Card>
        )}

        {assigned_instructor && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Assigned Instructor</CardTitle>
            </CardHeader>
            <View style={styles.instructorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {assigned_instructor.name.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.instructorName}>{assigned_instructor.name}</Text>
                <Text style={styles.instructorSub}>{assigned_instructor.email}</Text>
                <Text style={styles.instructorSub}>Licence: {assigned_instructor.fir_licence_number || 'N/A'}</Text>
              </View>
            </View>
          </Card>
        )}

        {curriculum_progress && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Curriculum Progress</CardTitle>
            </CardHeader>
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>Overall Progress</Text>
                <Text style={styles.progressText}>{curriculum_progress.progress_pct}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${curriculum_progress.progress_pct}%` }]} />
              </View>
              <Text style={styles.progressSub}>
                {curriculum_progress.passed_exercises} of {curriculum_progress.total_exercises} exercises passed
              </Text>

              {curriculum_progress.stages?.map((stage: any, index: number) => (
                <View key={index} style={styles.stageContainer}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageTitle}>Stage {stage.stage_number}: {stage.stage_title}</Text>
                    <Text style={styles.stagePct}>{stage.pct}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${stage.pct}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.medium,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  greeting: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  date: {
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.regular,
    color: theme.colors.subtext,
    marginBottom: theme.spacing.sm,
  },
  kpiContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  kpiCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    width: '23%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kpiLabel: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.subtext,
    fontFamily: theme.fonts.medium,
  },
  kpiValue: {
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    marginTop: 4,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  exerciseCode: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.md,
    color: theme.colors.primary,
  },
  exerciseTitle: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginTop: 4,
  },
  exerciseDate: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.subtext,
    marginTop: 4,
  },
  exerciseGrade: {
    alignItems: 'flex-end',
  },
  gradeText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: 4,
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  avatarText: {
    color: '#fff',
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
  },
  instructorName: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  instructorSub: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.subtext,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: theme.spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  progressSub: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.subtext,
    marginTop: 8,
    marginBottom: theme.spacing.md,
  },
  stageContainer: {
    marginTop: theme.spacing.sm,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stageTitle: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
  },
  stagePct: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
  },
});
