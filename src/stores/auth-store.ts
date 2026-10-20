import { create } from 'zustand'

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
  clearError: () => void
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

function getErrorMessage(response: ApiResponse) {
  const message = response.message ?? response.detail
  return typeof message === 'string'
    ? message
    : 'Invalid credentials. Please try again.'
}

export const useAuthStore = create<AuthState>((set) => ({
  loginResponse: null,
  error: null,
  isLoading: false,
  clearError: () => set({ error: null }),
  login: async (credentials) => {
    set({ error: null, isLoading: true })

    try {
      if (!apiBaseUrl) {
        throw new Error('VITE_API_BASE_URL is not configured.')
      }

      const response = await fetch(`${apiBaseUrl}/user/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })

      const body: unknown = await response.json()
      const result =
        typeof body === 'object' && body !== null
          ? (body as ApiResponse)
          : { data: body }

      // Keep the complete backend response in app state, including error responses.
      set({ loginResponse: result })

      if (!response.ok) {
        throw new Error(getErrorMessage(result))
      }

      const token = result.token ?? result.access_token
      if (typeof token === 'string') {
        localStorage.setItem('auth_token', token)
      }
    } catch (error) {
      const message =
        error instanceof TypeError
          ? 'Unable to reach the server. Please check your connection.'
          : error instanceof Error
            ? error.message
            : 'Unable to sign in. Please try again.'
      set({ error: message })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },
}))
