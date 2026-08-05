import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { useTheme } from '../../../theme';
import { Card, Button, Badge, Spinner } from '../../../components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlanRequests, useCreatePlanRequest } from '../../../api/hooks';

export default function RosterScreen() {
  const { data: requestsResp, isLoading, refetch } = usePlanRequests();
  const createPlanReq = useCreatePlanRequest();
  const requests = requestsResp?.results || (Array.isArray(requestsResp) ? requestsResp : []);
  const user = useAuthStore((state: any) => state.user);
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };
  const handleNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };
  const handleToday = () => setCurrentDate(new Date());

  if (isLoading && !requestsResp) {
    return (
      <View style={styles.center}>
        <Spinner size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const renderDispatcherRoster = () => (
    <View>
      <Button 
        title="Create Plan Request" 
        onPress={() => {
          const formattedDate = currentDate.toISOString().split('T')[0];
          createPlanReq.mutate({ plan_date: formattedDate }, {
            onSuccess: () => refetch()
          });
        }} 
        loading={createPlanReq.isPending}
        style={styles.createBtn} 
      />
      {requests.map((req: any) => (
        <Card key={req.id} style={styles.requestCard}>
          <View style={styles.reqHeader}>
            <Text style={styles.reqDate}>{new Date(req.plan_date || req.created_at).toLocaleDateString()}</Text>
            <Badge variant="primary">{req.status ? req.status.replace(/_/g, ' ').toUpperCase() : 'OPEN'}</Badge>
          </View>
          <Text style={styles.reqProgress}>{req.submitted_count || 0} / {req.total_instructors || 0} Instructors Submitted</Text>
        </Card>
      ))}
    </View>
  );

  const renderInstructorRoster = () => {
    const activeReq = requests.find((r: any) => r.status === 'open' || r.status === 'collecting');
    return (
      <View>
        {activeReq ? (
          <Card style={styles.requestCard}>
            <Text style={styles.reqTitle}>Action Required</Text>
            <Text style={styles.reqDate}>Plan requested for {new Date(activeReq.plan_date).toLocaleDateString()}</Text>
            <Button 
              title="Submit My Plan" 
              onPress={() => router.push({ pathname: '/(app)/roster/submit-plan', params: { requestId: activeReq.id } } as any)} 
              style={styles.actionBtn} 
            />
          </Card>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active plan requests right now.</Text>
          </View>
        )}
      </View>
    );
  };

  const renderCFIRoster = () => {
    const pendingReqs = requests.filter((r: any) => r.status === 'pending_cfi_approval');
    return (
      <View>
        {pendingReqs.map((req: any) => (
          <Card key={req.id} style={styles.requestCard}>
            <View style={styles.reqHeader}>
              <Text style={styles.reqDate}>{new Date(req.plan_date).toLocaleDateString()}</Text>
              <Badge variant="warning">PENDING APPROVAL</Badge>
            </View>
            <Button 
              title="Review & Approve" 
              onPress={() => router.push({ pathname: '/(app)/roster/approve', params: { requestId: req.id } } as any)} 
              style={styles.actionBtn} 
            />
          </Card>
        ))}
        {pendingReqs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No plans pending approval.</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.datePickerRow}>
        <TouchableOpacity onPress={handlePrevDay} style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleToday}>
          <Text style={styles.currentDateText}>{currentDate.toLocaleDateString()}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNextDay} style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>Next</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        {user?.role === 'dispatcher' && renderDispatcherRoster()}
        {user?.role === 'instructor' && renderInstructorRoster()}
        {(user?.role === 'cfi' || user?.role === 'superadmin') && renderCFIRoster()}
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
    backgroundColor: theme.colors.background,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateBtn: {
    padding: theme.spacing.sm,
  },
  dateBtnText: {
    fontFamily: theme.fonts.medium,
    color: theme.colors.primary,
    fontSize: theme.fontSizes.md,
  },
  currentDateText: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    fontSize: theme.fontSizes.lg,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  createBtn: {
    marginBottom: theme.spacing.md,
  },
  requestCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  reqTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.text,
    marginBottom: 4,
  },
  reqDate: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.text,
  },
  reqProgress: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.subtext,
  },
  actionBtn: {
    marginTop: theme.spacing.md,
  },
  emptyState: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.fontSizes.md,
    color: theme.colors.subtext,
  }
});
