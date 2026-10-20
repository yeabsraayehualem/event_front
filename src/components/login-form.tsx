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
      className="login-form"
    >
      <div className="login-fields">
        <div className="login-field">
          <label
            htmlFor="phone"
            className="login-field-label"
          >
            Staff phone number
          </label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="09********/07********"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
            className="staff-login-input"
            {...register('phone')}
          />
          {errors.phone && (
            <p id="phone-error" className="login-field-error">
              {errors.phone.message}
            </p>
          )}
        </div>
        <div className="login-field">
          <label
            htmlFor="password"
            className="login-field-label"
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
            className="staff-login-input"
            {...register('password')}
          />
          {errors.password && (
            <p id="password-error" className="login-field-error">
              {errors.password.message}
            </p>
          )}
        </div>
      </div>

      {serverError && (
        <p
          role="alert"
          className="login-server-error"
        >
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        className="staff-login-submit"
        disabled={isLoading}
      >
        {isLoading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
