import i18n, { intlLocale } from '@/i18n'
export type PackageContent = {
  id: number
  name: string
  description: string
}

export type Package = {
  id: number
  name: string
  description?: string
  price?: string
  contents: PackageContent[]
}

export type Plan = {
  id: number
  name: string
  description?: string
  image?: string | null
  packages: Package[]
  event_types?: { id: number; name: string }[]
}

export const ordinal = (index: number) => String(index + 1).padStart(2, '0')

export function currency(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return i18n.t('currency.requestQuote')
  return new Intl.NumberFormat(intlLocale(), {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
  }).format(amount)
}
