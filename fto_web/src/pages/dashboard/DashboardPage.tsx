import { useAuthStore } from '@/stores'
import { OpsDashboardPage }        from './OpsDashboardPage'
import { InstructorDashboardPage } from './InstructorDashboardPage'
import { StudentDashboardPage }    from './StudentDashboardPage'

export function DashboardPage() {
  const { user } = useAuthStore()

  if (user?.role === 'instructor') return <InstructorDashboardPage />
  if (user?.role === 'student')    return <StudentDashboardPage />
  return <OpsDashboardPage />
}