import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLogin } from '@/api/hooks'
import { Button } from '@/components/ui'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export function LoginPage() {
  const [showPw, setShowPw] = useState(false)
  const login = useLogin()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = (data: FormData) => login.mutate(data)

// console.log("REACT QUERY ERROR:", login.error)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">Sign in to your account</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email address
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@fto.aero"
            {...register('email')}
            className={cn(
              'w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-sm',
              'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500',
              'dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500',
              errors.email
                ? 'border-red-400 dark:border-red-600'
                : 'border-slate-300 dark:border-slate-600'
            )}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Password
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className={cn(
                'w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm shadow-sm',
                'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500',
                errors.password
                  ? 'border-red-400 dark:border-red-600'
                  : 'border-slate-300 dark:border-slate-600'
              )}
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {/* Server error */}
        {login.isError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
            Invalid email or password. Please try again.
          </div>
        )}

        <Button type="submit" className="w-full" loading={login.isPending} size="lg">
          Sign in
        </Button>
      </form>
    </div>
  )
}
