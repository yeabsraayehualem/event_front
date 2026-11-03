export type Choice = { value: string; label: string }
export type TaxProfile = { id: number; name: string; kind: string; rate: string; inclusive: boolean }

export type ProcurementOptions = {
  categories: Array<{ id: number; name: string }>
  vendors: Array<{ id: number; name: string; category: string; payment_terms: string }>
  events: Array<{ id: number; name: string; customer: string; event_date: string; location: string }>
  tax_profiles: TaxProfile[]
  line_kinds: Choice[]
  payment_terms: Choice[]
  document_kinds: Choice[]
  statuses: Choice[]
  can_approve: boolean
  can_set_budget: boolean
}

export type VendorListItem = {
  id: number
  name: string
  category: number
  category_name: string
  contact_person: string
  phone: string
  email: string
  active: boolean
  order_count: number
  committed_total: string
}

export type VendorDocument = {
  id: number
  kind: string
  kind_label: string
  file_name: string
  file_url: string | null
  expires_on: string | null
  is_expired: boolean
  uploaded_at: string
}

export type OrderStatus = 'draft' | 'submitted' | 'approved' | 'received' | 'cancelled'

export type VendorOrderSummary = {
  id: number
  reference: string
  event_id: number
  event_name: string
  event_date: string
  status: OrderStatus
  status_label: string
  total: string
}

export type Vendor = {
  id: number
  name: string
  category: number
  category_name: string
  contact_person: string
  phone: string
  email: string
  address: string
  tin_number: string
  license_number: string
  payment_terms: string
  payment_terms_label: string
  bank_name: string
  bank_account: string
  notes: string
  active: boolean
  documents: VendorDocument[]
  purchase_orders: VendorOrderSummary[]
}

export type PurchaseOrderListItem = {
  id: number
  reference: string
  vendor: number
  vendor_name: string
  vendor_category: string
  event: number
  event_name: string
  event_date: string
  order_date: string
  delivery_at: string | null
  status: OrderStatus
  status_label: string
  total: string
}

export type BudgetSummary = {
  event_id: number
  event_name: string
  budget: string | null
  committed: string
  pending: string
  remaining: string | null
}

export type PurchaseOrderLine = {
  id: number
  kind: string
  kind_label: string
  description: string
  quantity: string
  unit_price: string
  tax_profile_ids: number[]
  subtotal: string
  tax: string
  total: string
}

export type PaymentScheduleItem = {
  id: number
  label: string
  amount: string
  due_date: string | null
  bill: { id: number; reference: string; date: string } | null
}

export type OrderBill = { id: number; reference: string; date: string; total: string; payment_method: string; scheduled_payment: string | null }

export type PurchaseOrder = {
  id: number
  reference: string
  vendor: number
  vendor_name: string
  vendor_payment_terms: string
  event: number
  event_name: string
  event_date: string
  event_location: string
  status: OrderStatus
  status_label: string
  order_date: string
  delivery_at: string | null
  delivery_location: string
  notes: string
  subtotal: string
  tax: string
  total: string
  created_by_name: string | null
  approved_by_name: string | null
  approved_at: string | null
  lines: PurchaseOrderLine[]
  payment_schedule: PaymentScheduleItem[]
  budget: BudgetSummary
  can_approve: boolean
  bills: OrderBill[]
  billed_total: string
}

export type EventProcurement = BudgetSummary & { can_set_budget: boolean; orders: PurchaseOrderListItem[] }

export const ORDER_STATUSES: Choice[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Waiting approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'received', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' }).format(amount)
    : String(value)
}

/** Split an API datetime into the local date (YYYY-MM-DD) and time (HH:MM) the inputs use. */
export function splitDateTime(value: string | null): { date: string; time: string } {
  if (!value) return { date: '', time: '' }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' }
  const pad = (part: number) => String(part).padStart(2, '0')
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  }
}

export function joinDateTime(date: string, time: string): string | null {
  if (!date) return null
  return new Date(`${date}T${time || '09:00'}`).toISOString()
}
