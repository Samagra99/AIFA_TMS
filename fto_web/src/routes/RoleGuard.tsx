import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/api/types'

interface Props { roles: UserRole[]; children: React.ReactNode }

export function RoleGuard({ roles, children }: Props) {
  const hasRole = useAuthStore(s => s.hasRole(...roles))
  if (!hasRole) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}
