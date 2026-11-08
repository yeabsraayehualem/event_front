import i18n from '@/i18n'
import { create } from 'zustand'
import { apiBaseUrl } from '@/lib/api'
import { clearProfileCache } from '@/lib/use-profile'

type LoginCredentials = {
  phone: string
  password: string
}

type ApiResponse = Record<string, unknown>

type AuthState = {
  loginResponse: ApiResponse | null
  error: string | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

// Sign-in failures are a fixed set, so show our own translated text rather than the server's English.
function getErrorMessage() {
  return i18n.t('auth:invalidCredentials')
}

export const useAuthStore = create<AuthState>((set) => ({
  loginResponse: null,
  error: null,
  isLoading: false,
  clearError: () => set({ error: null }),
  logout: async () => {
    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/user/csrf/`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (csrfResponse.ok) {
        const csrfBody: unknown = await csrfResponse.json()
        const csrfToken =
          typeof csrfBody === 'object' && csrfBody !== null && 'csrf_token' in csrfBody
            ? (csrfBody as { csrf_token?: unknown }).csrf_token
            : undefined

        if (typeof csrfToken === 'string') {
          await fetch(`${apiBaseUrl}/user/logout/`, {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json', 'X-CSRFToken': csrfToken },
          })
        }
      }
    } catch {
      // Clear local state and redirect even if the API cannot be reached.
    } finally {
      localStorage.removeItem('auth_token')
      clearProfileCache()
      set({ loginResponse: null, error: null, isLoading: false })
    }
  },
  login: async (credentials) => {
    set({ error: null, isLoading: true })

    try {
      const response = await fetch(`${apiBaseUrl}/user/login/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })

      const body: unknown = await response.json()
      const result =
        typeof body === 'object' && body !== null
          ? (body as ApiResponse)
          : { data: body }

      if (!response.ok) {
        throw new Error(getErrorMessage())
      }

      const sessionResponse = await fetch(`${apiBaseUrl}/user/profile/`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!sessionResponse.ok) {
        throw new Error(i18n.t('auth:sessionNotKept'))
      }

      // Keep the complete backend response in app state after the session is confirmed.
      clearProfileCache()
      set({ loginResponse: result })

      const token = result.token ?? result.access_token
      if (typeof token === 'string') {
        localStorage.setItem('auth_token', token)
      }
    } catch (error) {
      const message =
        error instanceof TypeError
          ? i18n.t('auth:unreachable')
          : error instanceof Error
            ? error.message
            : i18n.t('auth:failed')
      set({ error: message })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },
}))
