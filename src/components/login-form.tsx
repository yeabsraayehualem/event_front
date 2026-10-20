import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'

const loginSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginForm() {
  const navigate = useNavigate()
  const { error: serverError, isLoading, login, clearError } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    clearError()
    try {
      await login({ phone: data.phone, password: data.password })
      navigate('/dashboard')
    } catch {
      // The store keeps the error message for display below.
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-md"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="phone"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Phone
          </label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="09********/07********"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
            className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm placeholder:text-slate-400 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
            {...register('phone')}
          />
          {errors.phone && (
            <p id="phone-error" className="mt-2 text-sm text-red-600">
              {errors.phone.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm placeholder:text-slate-400 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
            {...register('password')}
          />
          {errors.password && (
            <p id="password-error" className="mt-2 text-sm text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>
      </div>

      {serverError && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200"
        >
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        className="mt-7 h-12 w-full rounded-xl bg-indigo-700 text-sm font-semibold text-white shadow-lg shadow-indigo-700/15 hover:bg-indigo-800"
        disabled={isLoading}
      >
        {isLoading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
