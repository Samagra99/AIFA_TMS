import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import { useAuthStore } from '@/stores'
import { useChangePassword, useSetMyPin } from '@/api/hooks/useUsers'
import { KeyRound, Shield, Lock } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
}

export function ProfileSettingsModal({ open, onClose }: Props) {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'password' | 'pin'>('password')
  
  // Password State
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // PIN State
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  const changePassword = useChangePassword()
  const setMyPin = useSetMyPin()

  if (!user) return null

  const isPinEligible = ['student', 'instructor', 'cfi', 'dispatcher'].includes(user.role)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }
    try {
      await changePassword.mutateAsync({ new_password: newPassword })
      toast.success('Password changed successfully. Please log in again.')
      setNewPassword('')
      setConfirmPassword('')
      onClose()
    } catch {
      toast.error('Failed to update password.')
    }
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error('PIN must be a 4-to-6 digit numeric code.')
      return
    }
    if (pin !== confirmPin) {
      toast.error('PIN confirmation does not match.')
      return
    }
    try {
      await setMyPin.mutateAsync(pin)
      toast.success('Operational Dispatch / Crew PIN set successfully!')
      setPin('')
      setConfirmPin('')
      onClose()
    } catch {
      toast.error('Failed to set PIN.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Account & Security Settings" size="md">
      <div className="space-y-4">
        {/* User Info Header */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800">
          <p className="font-semibold text-slate-900 dark:text-white">
            {user.full_name}
          </p>
          <p className="text-xs text-slate-500">{user.email} · Role: <span className="uppercase font-bold text-primary-600">{user.role}</span></p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === 'password'
                ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Lock className="h-3.5 w-3.5" /> Change Password
          </button>

          {isPinEligible && (
            <button
              onClick={() => setActiveTab('pin')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition-colors ${
                activeTab === 'pin'
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" /> Dispatch / Crew PIN
            </button>
          )}
        </div>

        {/* 1. PASSWORD FORM */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
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
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Confirm New Password *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" type="submit" loading={changePassword.isPending}>
                Update Password
              </Button>
            </div>
          </form>
        )}

        {/* 2. OPERATIONAL PIN FORM */}
        {activeTab === 'pin' && isPinEligible && (
          <form onSubmit={handlePinSubmit} className="space-y-4 pt-2">
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Shield className="h-4 w-4 text-amber-600" /> Strictly Self-Managed PIN Security
              </div>
              <p>Your 4-to-6 digit operational PIN is used for flight acceptance and dispatch signatures. Only you can configure your PIN.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                New Operational PIN (4 to 6 Digits) *
              </label>
              <input
                type="password"
                required
                maxLength={6}
                pattern="\d{4,6}"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 1234"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tracking-widest dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Confirm Operational PIN *
              </label>
              <input
                type="password"
                required
                maxLength={6}
                pattern="\d{4,6}"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Re-enter PIN"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tracking-widest dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" type="submit" loading={setMyPin.isPending}>
                Save Operational PIN
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
