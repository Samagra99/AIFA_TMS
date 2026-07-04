import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateUser } from '@/api/hooks/useUsers'
import { useBases } from '@/api/hooks'
import { Button } from '@/components/ui'
import { roleName } from '@/lib/utils'
import { Eye, EyeOff, User, GraduationCap, Wrench, ShieldCheck, IndianRupee, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/api/types'

const ROLE_OPTIONS: { value: UserRole; label: string; icon: React.ComponentType<{className?:string}>; description: string }[] = [
  { value: 'instructor',     label: 'Instructor',            icon: User,          description: 'Flies with students, submits daily plans, grades sorties' },
  { value: 'cfi',            label: 'Chief Flight Instructor',icon: ShieldCheck,  description: 'Full oversight — approves overrides, manages roster' },
  { value: 'student',        label: 'Student Pilot',         icon: GraduationCap, description: 'Trainee — view-only access to schedule and logbook' },
  { value: 'dispatcher',     label: 'Dispatcher',            icon: Users,         description: 'Operations desk — clears aircraft, manages daily roster' },
  { value: 'camo',           label: 'CAMO Manager',          icon: Wrench,        description: 'Airworthiness — issues CRS, tracks maintenance' },
  { value: 'safety_officer', label: 'Safety Officer',        icon: ShieldCheck,   description: 'SMS occurrence register, hazard management' },
  { value: 'finance',        label: 'Finance Manager',       icon: IndianRupee,   description: 'Billing, GST invoices, EMI plans' },
]

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name:  z.string().min(1, 'Required'),
  email:      z.string().email('Enter a valid email'),
  phone:      z.string().optional(),
  role:       z.enum(['instructor','cfi','student','dispatcher','camo','safety_officer','finance']),
  home_base:  z.string().uuid('Select a base').optional().or(z.literal('')),
  password:   z.string().min(8, 'Minimum 8 characters'),
})
type FormData = z.infer<typeof schema>

interface Props { onSuccess?: () => void }

export function CreateUserForm({ onSuccess }: Props) {
  const [showPw, setShowPw] = useState(false)
  const createUser = useCreateUser()
  const { data: basesData } = useBases()

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'instructor' },
  })
  const selectedRole = watch('role')

  const onSubmit = async (data: FormData) => {
    try {
      const payload = { ...data, home_base: data.home_base || null }
      const user = await createUser.mutateAsync(payload)
      toast.success(`${user.first_name} ${user.last_name} onboarded as ${roleName(user.role)}`)
      onSuccess?.()
    } catch (err: any) {
      const detail = err?.response?.data?.errors?.email?.[0]
        ?? err?.response?.data?.detail
        ?? 'Failed to create user'
      toast.error(detail)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Role picker */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Role *
        </label>
        <Controller name="role" control={control} render={({ field }) => (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ROLE_OPTIONS.map(r => {
              const Icon = r.icon
              const isSelected = field.value === r.value
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => field.onChange(r.value)}
                  title={r.description}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all',
                    isSelected
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-semibold leading-tight">{r.label}</span>
                </button>
              )
            })}
          </div>
        )} />
        {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
        <p className="mt-1.5 text-xs text-slate-400">
          {ROLE_OPTIONS.find(r => r.value === selectedRole)?.description}
        </p>
      </div>

      {/* Name */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            First Name *
          </label>
          <input {...register('first_name')}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500
              dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          {errors.first_name && <p className="mt-1 text-xs text-red-600">{errors.first_name.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Last Name *
          </label>
          <input {...register('last_name')}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500
              dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          {errors.last_name && <p className="mt-1 text-xs text-red-600">{errors.last_name.message}</p>}
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email *
          </label>
          <input type="email" {...register('email')} placeholder="name@fto.aero"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500
              dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Phone
          </label>
          <input {...register('phone')} placeholder="+91 98765 43210"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500
              dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
        </div>
      </div>

      {/* Home base */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Home Base
        </label>
        <select {...register('home_base')}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-500
            dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          <option value="">No base assigned</option>
          {basesData?.results.map(b => (
            <option key={b.id} value={b.id}>{b.name} ({b.icao_code})</option>
          ))}
        </select>
      </div>

      {/* Temp password */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Temporary Password *
        </label>
        <div className="relative">
          <input type={showPw ? 'text' : 'password'} {...register('password')}
            placeholder="Minimum 8 characters"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-10 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500
              dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        <p className="mt-1 text-xs text-slate-400">
          Share this with the new user — they should change it on first login.
        </p>
      </div>

      {/* Role-specific note */}
      {selectedRole === 'student' && (
        <div className="rounded-lg bg-primary-50 border border-primary-200 px-4 py-3 text-xs
          text-primary-700 dark:bg-primary-950 dark:border-primary-800 dark:text-primary-300">
          A Student profile will be auto-created. Add SPL, medical, and instructor
          assignment details from the Students page after onboarding.
        </div>
      )}
      {(selectedRole === 'instructor' || selectedRole === 'cfi') && (
        <div className="rounded-lg bg-primary-50 border border-primary-200 px-4 py-3 text-xs
          text-primary-700 dark:bg-primary-950 dark:border-primary-800 dark:text-primary-300">
          An Instructor profile will be auto-created with default FDTL limits
          (8h daily / 30h weekly / 100h monthly). Assign students from the Roster → Plans tab.
        </div>
      )}

      <Button type="submit" loading={createUser.isPending} className="w-full" size="lg">
        Onboard User
      </Button>
    </form>
  )
}
