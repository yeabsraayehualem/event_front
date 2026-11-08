import i18n, { intlLocale } from '@/i18n'
import type { Choice } from '../procurement/types'

export type HROptions = {
  skills: Array<{ id: number; name: string }>
  events: Array<{ id: number; name: string; event_date: string; location: string }>
  employees: Array<{ id: number; full_name: string; job_title: string; wage_basis: string; rate: string; employment_type: string; skills: string[] }>
  employment_types: Choice[]
  wage_bases: Choice[]
  id_types: Choice[]
  shift_statuses: Choice[]
  payment_methods: Choice[]
  can_edit: boolean
  can_pay: boolean
}

export type EmployeeListItem = {
  id: number
  full_name: string
  phone: string
  job_title: string
  employment_type: string
  employment_type_label: string
  wage_basis: string
  wage_basis_label: string
  rate: string
  skills: Array<{ id: number; name: string }>
  id_verified: boolean
  active: boolean
  upcoming_shifts: number
}

export type Payout = { id: number; reference: string; date: string }

export type EmployeeShift = {
  id: number
  event_id: number
  event_name: string
  role: string
  start: string
  end: string
  status: string
  status_label: string
  amount: string
  payout: Payout | null
}

export type Employee = EmployeeListItem & {
  skill_ids: number[]
  id_type: string
  id_type_label: string
  id_number: string
  id_document_url: string | null
  emergency_contact: string
  payment_account: string
  hire_date: string | null
  notes: string
  shifts: EmployeeShift[]
  totals: { events_worked: number; no_shows: number; paid_total: string }
}

export type Conflict = { id: number; event_id: number; event_name: string; role: string; start: string; end: string }

export type Shift = {
  id: number
  employee: number
  employee_name: string
  employee_phone: string
  event: number
  event_name: string
  event_date: string
  role: string
  start: string
  end: string
  status: string
  status_label: string
  wage_basis: string
  wage_basis_label: string
  rate: string
  units: string
  amount: string
  payable: boolean
  notes: string
  payout: Payout | null
  pay_run: { id: number; reference: string; status: string } | null
  conflicts: Conflict[]
}

export function rateLabel(basis: string, rate: string | number) {
  const amount = new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(Number(rate))
  return i18n.t(basis === 'monthly' ? 'crew:perMonth' : basis === 'daily' ? 'crew:perDay' : 'crew:perEvent', { amount })
}

export function timeRange(start: string, end: string) {
  const format = (value: string) => new Date(value).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' })
  return `${format(start)}–${format(end)}`
}
