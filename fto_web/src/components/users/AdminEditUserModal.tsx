import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import { useBases } from '@/api/hooks'
import { useUpdateUser, useAdminResetPassword } from '@/api/hooks/useUsers'
import { Lock, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { User } from '@/api/types'

interface Props {
  open: boolean
  user: User | null
  onClose: () => void
}

export function AdminEditUserModal({ open, user, onClose }: Props) {
  const { data: basesData } = useBases()
  const updateUser = useUpdateUser()
  const adminResetPassword = useAdminResetPassword()

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile')

  // Form States
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName]   = useState(user?.last_name ?? '')
  const [phone, setPhone]         = useState(user?.phone ?? '')
  const [homeBase, setHomeBase]   = useState(user?.home_base ?? '')

  // Password Reset State
  const [newPassword, setNewPassword] = useState('')

  if (!user) return null

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateUser.mutateAsync({
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        home_base: homeBase || null,
      })
      toast.success(`User ${firstName} ${lastName} updated successfully.`)
      onClose()
    } catch {
      toast.error('Failed to update user details.')
    }
  }

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.')
      return
    }
    try {
      await adminResetPassword.mutateAsync({ userId: user.id, new_password: newPassword })
      toast.success(`Password for ${user.first_name} ${user.last_name} reset successfully!`)
      setNewPassword('')
      onClose()
    } catch {
      toast.error('Failed to reset password.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit User — ${user.first_name} ${user.last_name}`} size="md">
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('profile')}
            className={`border-b-2 px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === 'profile'
                ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            User Details
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === 'password'
                ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Lock className="h-3.5 w-3.5" /> Reset Password
          </button>
        </div>

        {/* 1. EDIT PROFILE FORM */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Home Operating Base
              </label>
              <select
                value={homeBase ?? ''}
                onChange={e => setHomeBase(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">No Base Assigned</option>
                {basesData?.results.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.icao_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" type="submit" loading={updateUser.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        )}

        {/* 2. ADMIN PASSWORD RESET FORM */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordResetSubmit} className="space-y-4 pt-1">
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <ShieldAlert className="h-4 w-4 text-amber-600" /> Admin Password Override
              </div>
              <p>Resetting password will invalidate all active sessions for <strong>{user.email}</strong>, requiring them to log in with the new password.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                New Password *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" type="submit" loading={adminResetPassword.isPending}>
                Reset Password
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
