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
  if (!Number.isFinite(amount) || amount <= 0) return 'Quote on request'
  return new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(amount)
}
