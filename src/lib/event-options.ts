import type commonEn from '@/i18n/en/common'

/**
 * Budget ranges offered on both the public inquiry form and the staff lead form.
 * `value` is what is stored on the lead (kept in English); `key` is its translated label.
 */
export const BUDGET_TIERS: { value: string; key: keyof typeof commonEn.budgetTiers }[] = [
  { value: 'Under ETB 100,000', key: 'under100k' },
  { value: 'ETB 100,000–300,000', key: 'from100to300k' },
  { value: 'ETB 300,000–600,000', key: 'from300to600k' },
  { value: 'Over ETB 600,000', key: 'over600k' },
]
