import { apiBaseUrl } from '@/lib/api'
import { fetchCsrfToken } from '@/lib/csrf'
import { getErrorMessage } from '@/lib/api-errors'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Fallback message, and readable names for field errors. */
  fallback?: string
  labels?: Record<string, string>
}

/** JSON request to the API with the session cookie and, for writes, a CSRF token. Throws a readable Error. */
export async function apiRequest<T>(path: string, { method = 'GET', body, signal, fallback = 'Something went wrong.', labels }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET') headers['X-CSRFToken'] = await fetchCsrfToken()
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method, credentials: 'include', signal, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data: unknown = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(getErrorMessage(data, fallback, labels))
  return data as T
}
