import { Outlet, Navigate } from 'react-router-dom'
import { Plane } from 'lucide-react'
import { useAuthStore } from '@/stores'
import { useThemeInit } from '@/hooks/useTheme'
import { Toaster } from 'sonner'

export function AuthLayout() {
  useThemeInit()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated())
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
            <Plane className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Amravati FTO</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Flight Training Management</p>
        </div>
        <Outlet />
      </div>
      <Toaster position="top-center" richColors />
    </div>
  )
}
