import i18n, { intlLocale } from '@/i18n'
export type CatalogEventType = { id?: number; name: string; lead_count?: number }

export type CatalogPlan = {
  id: number
  name: string
  description: string
  image_url: string | null
  event_types: CatalogEventType[]
  packages: { id: number; name: string; price: string; content_count: number }[]
  lead_count: number
}

export type CatalogPackage = {
  id: number
  plan: number
  plan_name: string
  name: string
  description: string
  price: string
  content_ids: number[]
  contents: { id: number; name: string }[]
  lead_count: number
}

export type CatalogContent = { id: number; name: string; description: string; package_count: number }

export function formatPrice(value: string | number) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return i18n.t('catalog:quoteOnRequest')
  return new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(amount)
}

/** Two-digit position label used across the catalog: 01, 02, … */
export const ordinal = (index: number) => String(index + 1).padStart(2, '0')

/** Sort cheapest first; unpriced ("quote on request") packages go last. */
export function byPrice<T extends { price: string }>(a: T, b: T) {
  const value = (item: T) => (Number(item.price) > 0 ? Number(item.price) : Number.POSITIVE_INFINITY)
  return value(a) - value(b)
}
