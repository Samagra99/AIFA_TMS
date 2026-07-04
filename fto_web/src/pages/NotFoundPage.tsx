import { Link } from 'react-router-dom'
export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-bold text-slate-200 dark:text-slate-700">404</p>
      <p className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-300">Page not found</p>
      <Link to="/dashboard" className="mt-6 text-sm text-primary-600 hover:underline">Back to dashboard</Link>
    </div>
  )
}
