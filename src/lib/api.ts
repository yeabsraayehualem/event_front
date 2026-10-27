const configuredApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
const loopbackHosts = new Set(['localhost', '127.0.0.1','82.25.116.35'])

function getApiBaseUrl() {
  const url = new URL(configuredApiBase)
  if (typeof window !== 'undefined'
    && loopbackHosts.has(url.hostname)
    && loopbackHosts.has(window.location.hostname)) {
    // Keep the frontend and API on the same site so the Django session cookie is sent.
    url.hostname = window.location.hostname
  }
  return url.toString().replace(/\/$/, '')
}

export const apiBaseUrl = getApiBaseUrl()
