import { useEffect, useState } from 'react'
import { apiBaseUrl } from '@/lib/api'

/** What the signed-in role may do: `{ module: ['view', 'create', 'edit', 'approve', …] }`. Mirrors utils/rbac.py. */
export type Permissions = Record<string, string[]>

export type Profile = {
  id: number
  phone: string
  first_name: string
  last_name: string
  email: string
  role: string
  permissions: Permissions
}

let cached: Promise<Profile | null> | null = null
let resolved: Profile | null | undefined
const listeners = new Set<() => void>()

function loadProfile() {
  cached ??= fetch(`${apiBaseUrl}/user/profile/`, { credentials: 'include', headers: { Accept: 'application/json' } })
    .then(async (response) => (response.ok ? ((await response.json())?.data as Profile) : null))
    .catch(() => null)
    .then((profile) => {
      resolved = profile
      if (!profile) cached = null // try again next time
      return profile
    })
  return cached
}

/** Forget the cached profile, e.g. after signing in or out, so the next page loads the new user's access. */
export function clearProfileCache() {
  cached = null
  resolved = undefined
  listeners.forEach((listener) => listener())
}

/** The signed-in profile plus whether it is still loading, so pages can tell "loading" from "signed out". */
export function useProfileStatus(): { profile: Profile | null; loading: boolean } {
  const [state, setState] = useState<{ profile: Profile | null; loading: boolean }>(
    () => (resolved === undefined ? { profile: null, loading: true } : { profile: resolved, loading: false }),
  )
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const listener = () => setVersion((value) => value + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  useEffect(() => {
    let active = true
    void loadProfile().then((profile) => { if (active) setState({ profile, loading: false }) })
    return () => { active = false }
  }, [version])

  return state
}

/** The signed-in user's profile, loaded once per page session. */
export function useProfile() {
  return useProfileStatus().profile
}

/** True when the profile's role may perform `action` in `module`. */
export function can(profile: Profile | null | undefined, module: string, action = 'view') {
  return Boolean(profile?.permissions?.[module]?.includes(action))
}

export const canManageCatalog = (profile: Profile | null) => can(profile, 'catalog', 'edit')
