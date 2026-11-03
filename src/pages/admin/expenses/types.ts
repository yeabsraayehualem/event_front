export type Expense = {
  id: number
  reference: string
  date: string
  category: number
  category_name: string
  description: string
  source: 'manual' | 'purchase_order'
  source_label: string
  event: number | null
  event_name: string | null
  vendor: number | null
  vendor_name: string | null
  purchase_order: number | null
  purchase_order_reference: string | null
  scheduled_payment: number | null
  scheduled_payment_label: string | null
  payee: string
  amount: string
  tax: string
  total: string
  payment_method: string
  payment_method_label: string
  receipt_number: string
  receipt_url: string | null
  notes: string
  created_by_name: string | null
  created_at: string
}

export type BillableOrder = {
  id: number
  reference: string
  vendor_name: string
  event_name: string
  subtotal: string
  total: string
  remaining: string
  payments: Array<{ id: number; label: string; amount: string; due_date: string | null; bill_id: number | null }>
}

export type ExpenseOptions = {
  categories: Array<{ id: number; name: string }>
  events: Array<{ id: number; name: string; event_date: string }>
  vendors: Array<{ id: number; name: string }>
  payment_methods: Array<{ value: string; label: string }>
  purchase_orders: BillableOrder[]
}

const round = (value: number) => Math.round(value * 100) / 100

/** Split a payable amount on an order into its untaxed part and tax, in the order's own proportion. */
export function splitPayable(payable: number, order: BillableOrder) {
  const total = Number(order.total)
  const amount = total > 0 ? round((payable * Number(order.subtotal)) / total) : payable
  return { amount: amount.toFixed(2), tax: round(payable - amount).toFixed(2) }
}
