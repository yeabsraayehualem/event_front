import i18n, { intlLocale } from '@/i18n'
export type RoleAccess = { module: string; actions: string[] }
export type RoleOption = { value: string; label: string; description: string; active_count: number; access?: RoleAccess[] }

export type StaffUser = {
  id: number
  phone: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  role: string
  role_label: string
  is_active: boolean
  last_login: string | null
  date_joined: string
  employee: { id: number; full_name: string } | null
  temporary_password?: string
}

export type UserOptions = {
  roles: RoleOption[]
  employees: Array<{ id: number; full_name: string; phone: string; user_id: number | null }>
  me: number
  is_super: boolean
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'
}

export function lastSeen(value: string | null) {
  if (!value) return i18n.t('users:neverSignedIn')
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  if (days <= 0) return i18n.t('users:today')
  if (days === 1) return i18n.t('users:yesterday')
  if (days < 30) return i18n.t('users:daysAgo', { count: days })
  return new Date(value).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
}
