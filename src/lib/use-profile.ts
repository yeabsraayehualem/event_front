import { useEffect, useState } from 'react'
import { apiBaseUrl } from '@/lib/api'

export type Profile = { id: number; phone: string; first_name: string; last_name: string; email: string; role: string }

let cached: Promise<Profile | null> | null = null

function loadProfile() {
  cached ??= fetch(`${apiBaseUrl}/user/profile/`, { credentials: 'include', headers: { Accept: 'application/json' } })
    .then(async (response) => (response.ok ? ((await response.json())?.data as Profile) : null))
    .catch(() => null)
    .then((profile) => {
      if (!profile) cached = null // try again next time
      return profile
    })
  return cached
}

/** The signed-in user's profile, loaded once per page session. */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => {
    let active = true
    void loadProfile().then((loaded) => { if (active) setProfile(loaded) })
    return () => { active = false }
  }, [])
  return profile
}

export const canManageCatalog = (profile: Profile | null) => profile?.role === 'super' || profile?.role === 'admin'
