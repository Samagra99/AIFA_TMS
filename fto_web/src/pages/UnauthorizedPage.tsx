import { Link } from 'react-router-dom'
export function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-bold text-slate-200 dark:text-slate-700">403</p>
      <p className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-300">Access denied</p>
      <p className="mt-2 text-sm text-slate-500">You don't have permission to view this page.</p>
      <Link to="/dashboard" className="mt-6 text-sm text-primary-600 hover:underline">Back to dashboard</Link>
    </div>
  )
}
