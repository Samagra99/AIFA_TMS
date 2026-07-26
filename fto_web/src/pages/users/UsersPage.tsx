import { useState } from 'react'
import {
  useUsersList, useDeactivateUser, useReactivateUser,
} from '@/api/hooks/useUsers'
import { useBases } from '@/api/hooks'
import { CreateUserForm } from '@/components/users/CreateUserForm'
import { AdminEditUserModal } from '@/components/users/AdminEditUserModal'
import { Card, Button, Badge, PageLoader, Modal } from '@/components/ui'
import { useAuthStore } from '@/stores'
import { roleName, cn } from '@/lib/utils'
import {
  UserPlus, Search, Mail, Phone, MapPin,
  ShieldCheck, ShieldOff, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import type { User } from '@/api/types'

const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: '',                label: 'All Roles' },
  { value: 'instructor',      label: 'Instructors' },
  { value: 'cfi',             label: 'CFI' },
  { value: 'student',         label: 'Students' },
  { value: 'dispatcher',      label: 'Dispatchers' },
  { value: 'camo',            label: 'CAMO' },
  { value: 'safety_officer',  label: 'Safety Officers' },
  { value: 'finance',         label: 'Finance' },
]

const ROLE_BADGE_VARIANT: Record<string, 'primary'|'success'|'warning'|'default'> = {
  superadmin:     'danger' as any,
  cfi:            'primary',
  instructor:     'primary',
  dispatcher:     'default',
  student:        'success',
  camo:           'warning',
  safety_officer: 'warning',
  finance:        'default',
}

export function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [baseFilter, setBaseFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const params: Record<string,string> = {}
  if (search)     params.search = search
  if (roleFilter) params.role   = roleFilter
  if (baseFilter) params.home_base = baseFilter
  if (!showInactive) params.is_active = 'true'

  const { data, isLoading } = useUsersList(params)
  const { data: basesData }  = useBases()
  const deactivate = useDeactivateUser()
  const reactivate = useReactivateUser()

  const users = data?.results ?? []

  // Only admin/CFI should reach this page (also enforced by RoleGuard on the route)
  const canManage = currentUser?.role && ['superadmin', 'cfi'].includes(currentUser.role)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Users</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data?.count ?? 0} {showInactive ? 'total' : 'active'} accounts
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Onboard User
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4
            -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4
              text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        </div>

        <select value={baseFilter} onChange={e => setBaseFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
            dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <option value="">All Bases</option>
          {basesData?.results.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded accent-primary-600" />
          Show inactive
        </label>
      </div>

      {/* Role filter pills */}
      <div className="flex gap-2 flex-wrap">
        {ROLE_FILTERS.map(f => {
          const count = f.value
            ? users.filter(u => u.role === f.value).length
            : users.length
          return (
            <button key={f.value || 'all'} onClick={() => setRoleFilter(f.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                roleFilter === f.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              )}>
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      <Card noPad>
        {isLoading ? <PageLoader /> : users.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <UserPlus className="mb-3 h-8 w-8 text-slate-200" />
            <p className="text-slate-500">No users found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50
              dark:border-slate-700 dark:bg-slate-800/50">
              <tr>
                {['Name','Role','Contact','Base','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                    uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {users.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  baseName={basesData?.results.find(b => b.id === u.home_base)?.name}
                  canManage={!!canManage}
                  onEdit={() => setEditingUser(u)}
                  onDeactivate={async () => {
                    try {
                      await deactivate.mutateAsync(u.id)
                      toast.success(`${u.first_name} ${u.last_name} deactivated`)
                    } catch { toast.error('Failed to deactivate') }
                  }}
                  onReactivate={async () => {
                    try {
                      await reactivate.mutateAsync(u.id)
                      toast.success(`${u.first_name} ${u.last_name} reactivated`)
                    } catch { toast.error('Failed to reactivate') }
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Onboard modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)}
        title="Onboard New User" size="lg">
        <CreateUserForm onSuccess={() => setShowCreate(false)} />
      </Modal>

      {/* Admin Edit User Modal */}
      <AdminEditUserModal
        open={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
      />
    </div>
  )
}

function UserRow({
  user: u, baseName, canManage, onEdit, onDeactivate, onReactivate,
}: {
  user: User
  baseName?: string
  canManage: boolean
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  return (
    <tr className={cn('hover:bg-slate-50 dark:hover:bg-slate-800',
      !u.is_active && 'opacity-50')}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
            bg-primary-600 text-[10px] font-bold text-white">
            {u.first_name[0]}{u.last_name[0]}
          </div>
          <span className="font-medium text-slate-900 dark:text-white">
            {u.first_name} {u.last_name}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={ROLE_BADGE_VARIANT[u.role] ?? 'default'}>
          {roleName(u.role)}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Mail className="h-3 w-3" /> {u.email}
        </div>
        {u.phone && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <Phone className="h-3 w-3" /> {u.phone}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {baseName ? (
          <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <MapPin className="h-3 w-3" /> {baseName}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {u.is_active
          ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <ShieldCheck className="h-3.5 w-3.5" /> Active
            </span>
          : <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
              <ShieldOff className="h-3.5 w-3.5" /> Inactive
            </span>}
      </td>
              <td className="px-4 py-3 text-right">
                {canManage && (
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={onEdit} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    {u.is_active ? (
                      <button onClick={onDeactivate} className="text-xs font-medium text-red-600 hover:underline">
                        Deactivate
                      </button>
                    ) : (
                      <button onClick={onReactivate} className="text-xs font-medium text-emerald-600 hover:underline">
                        Reactivate
                      </button>
                    )}
                  </div>
                )}
              </td>
    </tr>
  )
}
