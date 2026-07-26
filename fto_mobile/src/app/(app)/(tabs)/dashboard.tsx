/**
 * Dashboard Tab — Role-based dashboard routing.
 * Renders the appropriate dashboard based on the user's role,
 * exactly matching the web app's DashboardPage.tsx pattern.
 */
import React from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { InstructorDashboard } from '../../../components/dashboard/InstructorDashboard';
import { StudentDashboard } from '../../../components/dashboard/StudentDashboard';
import { OpsDashboard } from '../../../components/dashboard/OpsDashboard';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  if (role === 'student') return <StudentDashboard />;
  if (role === 'instructor' || role === 'cfi') return <InstructorDashboard />;
  return <OpsDashboard />;
}
