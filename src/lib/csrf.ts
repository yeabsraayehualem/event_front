import { apiBaseUrl } from '@/lib/api'

/** Fetch a fresh Django CSRF token for an unsafe (POST/PATCH) request. */
export async function fetchCsrfToken() {
  const response = await fetch(`${apiBaseUrl}/user/csrf/`, {
    credentials: 'include', headers: { Accept: 'application/json' },
  })
  const body: unknown = await response.json()
  const token = typeof body === 'object' && body !== null && 'csrf_token' in body
    ? (body as { csrf_token?: unknown }).csrf_token
    : undefined
  if (!response.ok || typeof token !== 'string') {
    throw new Error('Could not prepare a secure request. Reload the page and try again.')
  }
  return token
}
