import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { apiBaseUrl } from '@/lib/api'
import { en } from './en'
import { am } from './am'

export type Locale = 'am' | 'en'
export const DEFAULT_LOCALE: Locale = 'am'
export const STORAGE_KEY = 'hadafe-locale'

export const resources = { en, am } as const
export const defaultNS = 'common'

function storedLocale(): Locale {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'am' || value === 'en' ? value : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

function applyDocumentLanguage(lng: string) {
  document.documentElement.lang = lng
}

i18n.use(initReactI18next).init({
  resources,
  lng: storedLocale(),
  // Anything not yet translated shows in English instead of a raw key.
  fallbackLng: 'en',
  supportedLngs: ['am', 'en'],
  defaultNS,
  ns: Object.keys(en),
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyDocumentLanguage(i18n.language)
i18n.on('languageChanged', (lng) => {
  applyDocumentLanguage(lng)
  try {
    window.localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this visit only.
  }
})

// Tell the API which language to answer in (error messages, statuses, choice labels).
// Accept-Language is a CORS-safelisted header, so this needs no extra server CORS setup.
const nativeFetch = window.fetch.bind(window)
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!url.startsWith(apiBaseUrl)) return nativeFetch(input, init)
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  headers.set('Accept-Language', i18n.language === 'en' ? 'en' : 'am')
  return nativeFetch(input, { ...init, headers })
}

/** BCP 47 tag for Intl number/date formatting in the current language. */
export function intlLocale(lng: string = i18n.language) {
  return lng === 'am' ? 'am-ET' : 'en-ET'
}

export default i18n

const ROLES = ['super', 'admin', 'sales', 'finance', 'pm', 'hr', 'stock', 'staff'] as const

/** A staff role's display name in the current language (unknown roles shown as-is). */
export function roleLabel(role: string | undefined | null) {
  if (!role) return ''
  return (ROLES as readonly string[]).includes(role) ? i18n.t(`roles.${role as (typeof ROLES)[number]}`) : role
}

const LEAD_STATUSES = ['lead', 'contacted', 'consultation_scheduled', 'quotation_sent', 'negotiation', 'won', 'lost', 'cancelled'] as const

/** A lead stage's name in the current language; `fallback` (e.g. the server's label) for unknown stages. */
export function leadStatusLabel(status: string, fallback?: string) {
  return (LEAD_STATUSES as readonly string[]).includes(status)
    ? i18n.t(`leadStatus.${status as (typeof LEAD_STATUSES)[number]}`)
    : (fallback ?? status)
}

/** Whole numbers with the current language's grouping. */
export function formatNumber(value: number) {
  return new Intl.NumberFormat(intlLocale()).format(value)
}

/** An amount in birr, formatted for the current language (non-numbers returned unchanged). */
export function formatMoney(value: string | number) {
  const amount = Number(value)
  return Number.isFinite(amount)
    ? new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: 'ETB' }).format(amount)
    : String(value)
}
