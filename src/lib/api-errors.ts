/** Turn a DRF error body ({detail}, {message}, or {field: [errors]}) into one readable line. */
export function getErrorMessage(data: unknown, fallback: string, labels: Record<string, string> = {}) {
  if (typeof data !== 'object' || data === null) return fallback
  const values = data as Record<string, unknown>
  if (typeof values.detail === 'string') return values.detail
  if (typeof values.message === 'string' && !values.data) return values.message
  const parts = Object.entries(values).map(([field, message]) => {
    const text = Array.isArray(message) ? message.join(', ') : String(message)
    return field === 'non_field_errors' ? text : `${labels[field] ?? field.replace(/_/g, ' ')}: ${text}`
  })
  return parts.join(' · ') || fallback
}
