import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'
import { landingPath } from '@/components/admin-navigation'
import type { Profile } from '@/lib/use-profile'
import { useTranslation } from 'react-i18next'

// Messages are translation keys, resolved when shown so they follow the current language.
const loginSchema = z.object({
  phone: z.string().min(1, 'phoneRequired'),
  password: z.string().min(1, 'passwordRequired'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginForm() {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
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
      const signedIn = (useAuthStore.getState().loginResponse?.data ?? null) as Profile | null
      navigate(landingPath(signedIn), { replace: true })
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
            {t('phone')}
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
              {t(errors.phone.message as 'phoneRequired')}
            </p>
          )}
        </div>
        <div className="login-field">
          <label
            htmlFor="password"
            className="login-field-label"
          >
            {t('password')}
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t('password')}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="staff-login-input"
            {...register('password')}
          />
          {errors.password && (
            <p id="password-error" className="login-field-error">
              {t(errors.password.message as 'passwordRequired')}
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
        {isLoading ? t('signingIn') : t('signIn')}
      </Button>
    </form>
  )
}
