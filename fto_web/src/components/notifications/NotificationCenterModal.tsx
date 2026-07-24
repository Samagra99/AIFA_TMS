import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from '@/api/hooks/useNotifications'
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertOctagon,
  Info,
  ExternalLink,
  ShieldAlert,
  Clock,
  Wrench,
  Calendar,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

interface Props {
  open: boolean
  onClose: () => void
}

export function NotificationCenterModal({ open, onClose }: Props) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'warning' | 'critical'>('all')
  const { data, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const navigate = useNavigate()

  const notifications = data?.results ?? []

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'warning') return n.severity === 'warning'
    if (filter === 'critical') return n.severity === 'critical'
    return true
  })

  const getCategoryIcon = (cat: AppNotification['category']) => {
    switch (cat) {
      case 'rest_rules':
      case 'fdtl':
        return <Clock className="h-4 w-4 text-amber-500" />
      case 'license_expiry':
        return <ShieldAlert className="h-4 w-4 text-red-500" />
      case 'aircraft_maint':
        return <Wrench className="h-4 w-4 text-orange-500" />
      case 'flight_schedule':
        return <Calendar className="h-4 w-4 text-blue-500" />
      default:
        return <Bell className="h-4 w-4 text-primary-500" />
    }
  }

  const getSeverityBadge = (sev: AppNotification['severity']) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertOctagon className="h-3 w-3 text-red-600" /> CRITICAL
          </span>
        )
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3 text-amber-600" /> WARNING
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Info className="h-3 w-3 text-blue-600" /> INFO
          </span>
        )
    }
  }

  const handleAction = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id)
    if (n.action_url) {
      navigate(n.action_url)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Operational Notifications & Alerts" size="lg">
      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
          <div className="flex gap-1.5">
            {(['all', 'unread', 'warning', 'critical'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  filter === tab
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="xs"
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
            className="gap-1 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark All as Read
          </Button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[60vh] overflow-y-auto space-y-2.5 pr-1">
          {isLoading ? (
            <p className="py-8 text-center text-xs text-slate-400">Loading notifications…</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Bell className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium">No notifications found</p>
            </div>
          ) : (
            filtered.map(n => (
              <div
                key={n.id}
                onClick={() => handleAction(n)}
                className={`group cursor-pointer rounded-xl border p-3.5 transition-all hover:border-primary-300 dark:hover:border-primary-700 ${
                  n.is_read
                    ? 'border-slate-200 bg-white opacity-75 dark:border-slate-700 dark:bg-slate-800'
                    : 'border-primary-200 bg-primary-50/50 dark:border-primary-900/50 dark:bg-primary-950/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-white p-2 shadow-sm dark:bg-slate-700 shrink-0">
                    {getCategoryIcon(n.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary-500" />
                        )}
                      </div>
                      {getSeverityBadge(n.severity)}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {n.message}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{dayjs(n.created_at).format('DD MMM YYYY, HH:mm')}</span>
                      {n.action_url && (
                        <span className="inline-flex items-center gap-1 font-semibold text-primary-600 dark:text-primary-400 group-hover:underline">
                          View details <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
