import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute }   from './ProtectedRoute'
import { RoleGuard }        from './RoleGuard'
import { AppLayout }        from '@/layouts/AppLayout'
import { AuthLayout }       from '@/layouts/AuthLayout'
import { LoginPage }        from '@/pages/auth/LoginPage'
import { DashboardPage }    from '@/pages/dashboard/DashboardPage'
import { FleetStatusPage }  from '@/pages/fleet/FleetStatusPage'
import { RosterPage }       from '@/pages/scheduling/RosterPage'
import { DispatchPage }     from '@/pages/dispatch/DispatchPage'
import { StudentsPage }     from '@/pages/students/StudentsPage'
import { InstructorsPage }  from '@/pages/instructors/InstructorsPage'
import { UsersPage }        from '@/pages/users/UsersPage'
import { SyllabusPage }     from '@/pages/syllabus/SyllabusPage'
import { MaintenancePage }  from '@/pages/maintenance/MaintenancePage'
import { CompliancePage }   from '@/pages/compliance/CompliancePage'
import { NotFoundPage }     from '@/pages/NotFoundPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'
import DGCAAuditDashboard from '@/pages/DGCAAuditDashboard'
import Reports from '@/pages/Reports'
import { BAModulePage } from '@/pages/dispatch/BAModulePage'
import { WeatherPage } from '@/pages/weather/WeatherPage'
import { NavigationPage } from '@/pages/navigation/NavigationPage'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },

  {
    element: <AuthLayout />,
    children: [{ path: 'login', element: <LoginPage /> }],
  },

  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      {
        path: 'fleet',
        element: (
          <RoleGuard roles={['superadmin','cfi','instructor','dispatcher','camo', 'student']}>
            <FleetStatusPage />
          </RoleGuard>
        ),
      },
      {
        path: 'roster',
        element: (
          <RoleGuard roles={['superadmin','cfi','instructor','dispatcher', 'student']}>
            <RosterPage />
          </RoleGuard>
        ),
      },
      {
        path: 'dispatch',
        element: (
          <RoleGuard roles={['superadmin','cfi','instructor','dispatcher', 'student', 'doctor']}>
            <DispatchPage />
          </RoleGuard>
        ),
      },
      {
        path: 'ba-module',
        element: (
          <RoleGuard roles={['superadmin','doctor']}>
            <BAModulePage />
          </RoleGuard>
        ),
      },
      {
        path: 'weather',
        element: (
          <RoleGuard roles={['superadmin','cfi','instructor','dispatcher', 'data_officer']}>
            <WeatherPage />
          </RoleGuard>
        ),
      },
      {
        path: 'navigation',
        element: (
          <RoleGuard roles={['superadmin','cfi','instructor','dispatcher']}>
            <NavigationPage />
          </RoleGuard>
        ),
      },
      {
        path: 'students',
        element: (
          <RoleGuard roles={['superadmin','cfi','instructor', 'dispatcher']}>
            <StudentsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'instructors',
        element: (
          <RoleGuard roles={['superadmin','cfi']}>
            <InstructorsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'users',
        element: (
          <RoleGuard roles={['superadmin', 'cfi']}>
            <UsersPage />
          </RoleGuard>
        ),
      },
      {
        path: 'syllabus',
        element: (
          <RoleGuard roles={['superadmin','cfi','instructor']}>
            <SyllabusPage />
          </RoleGuard>
        ),
      },
      {
        path: 'maintenance',
        element: (
          <RoleGuard roles={['superadmin','camo']}>
            <MaintenancePage />
          </RoleGuard>
        ),
      },
      {
        path: 'compliance',
        element: (
          <RoleGuard roles={['superadmin','cfi','safety_officer']}>
            <CompliancePage />
          </RoleGuard>
        ),
      },
      {
        path: 'audit',
        element: (
          <RoleGuard roles={['superadmin', 'cfi', 'safety_officer']}>
            <DGCAAuditDashboard />
          </RoleGuard>
        ),
      },
      {
        path: 'reports',
        element: (
          <RoleGuard roles={['superadmin', 'cfi', 'safety_officer', 'dispatcher']}>
            <Reports />
          </RoleGuard>
        ),
      },
      { path: 'unauthorized', element: <UnauthorizedPage /> },
      { path: '*',            element: <NotFoundPage /> },
    ],
  },
])
