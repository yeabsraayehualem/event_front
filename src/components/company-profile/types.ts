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
}

export function currency(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return 'Request a quote'
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
  }).format(amount)
}
