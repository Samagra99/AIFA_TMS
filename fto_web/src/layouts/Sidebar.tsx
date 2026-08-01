import { NavLink } from 'react-router-dom'
import { cn, roleName } from '@/lib/utils'
import { useAuthStore, useUIStore } from '@/stores'
import { NAV_ROLES } from '@/lib/constants'
import {
  LayoutDashboard, Plane, CalendarDays, Send,
  Users, UserCog, GraduationCap, BookOpen, Wrench, ShieldCheck,
  ChevronLeft, ChevronRight, FileText, ClipboardCheck, CloudSun, Stethoscope
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard, key: 'dashboard'   },
  { to: '/users',       label: 'Users',       icon: UserCog,         key: 'users'       },
  { to: '/fleet',       label: 'Fleet Status', icon: Plane,           key: 'fleet'       },
  { to: '/roster',      label: 'Daily Roster', icon: CalendarDays,    key: 'roster'      },
  { to: '/dispatch',    label: 'Dispatch',     icon: Send,            key: 'dispatch'    },
  { to: '/ba-module',   label: 'BA Module',    icon: Stethoscope,     key: 'ba_module'   },
  { to: '/weather',     label: 'Weather',      icon: CloudSun,        key: 'weather'     },
  { to: '/students',    label: 'Students',     icon: Users,           key: 'students'    },
  { to: '/instructors', label: 'Instructors',  icon: GraduationCap,   key: 'instructors' },
  { to: '/syllabus',    label: 'Syllabus',     icon: BookOpen,        key: 'syllabus'    },
  { to: '/maintenance', label: 'Maintenance',  icon: Wrench,          key: 'maintenance' },
  // { to: '/inventory',   label: 'Inventory',    icon: Package,         key: 'inventory'   },
  { to: '/compliance',  label: 'Safety & SMS', icon: ShieldCheck,     key: 'compliance'  },
  // { to: '/finance',     label: 'Finance',      icon: IndianRupee,     key: 'finance'     },
  { to: '/reports',  label: 'DGCA Reports', icon: FileText,     key: 'reports'  },
  { to: '/audit',     label: 'Audit',      icon: ClipboardCheck,     key: 'audit'     },
]

export function Sidebar() {
  const { user, hasRole } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()

  const visible = NAV.filter(item => {
    const allowed = NAV_ROLES[item.key]
    return !allowed || hasRole(...allowed)
  })

  return (
    <aside className={cn(
      'flex flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-700 dark:bg-slate-900',
      sidebarOpen ? 'w-56' : 'w-16'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center border-b border-slate-200 dark:border-slate-700',
        sidebarOpen ? 'justify-between px-4' : 'justify-center'
      )}>
        {sidebarOpen && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600">
              <Plane className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">Amravati FTO</p>
              <p className="truncate text-[10px] text-slate-500">Management Platform</p>
            </div>
          </div>
        )}
        {!sidebarOpen && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <Plane className="h-4 w-4 text-white" />
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {visible.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} title={label} className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            !sidebarOpen && 'justify-center'
          )}>
            <Icon className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      {user && (
        <div className={cn(
          'border-t border-slate-200 p-3 dark:border-slate-700',
          !sidebarOpen && 'flex justify-center'
        )}>
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={user.full_name} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                  {user.full_name}
                </p>
                <p className="truncate text-[10px] text-slate-500">{roleName(user.role)}</p>
              </div>
            </div>
          ) : (
            <Avatar name={user.full_name} />
          )}
        </div>
      )}
    </aside>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
      {initials}
    </div>
  )
}
