import { intlLocale } from '@/i18n'
export type Bracket = { upper_limit: string | null; rate: string }

export type PayrollRules = {
  employee_pension_rate: string
  employer_pension_rate: string
  freelance_withholding_rate: string
  tax_table_confirmed: boolean
  confirmed_at: string | null
  confirmed_by: string | null
  brackets: Bracket[]
}

export type RunTotals = {
  gross: string
  net: string
  income_tax: string
  pension_employee: string
  pension_employer: string
  withholding: string
  other_deductions: string
  employer_cost: string
  people: number
  held: number
}

export type RunStatus = 'draft' | 'approved' | 'paid' | 'cancelled'

export type PayRunListItem = {
  id: number
  reference: string
  period: string
  status: RunStatus
  status_label: string
  paid_on: string | null
  totals: RunTotals
  created_at: string
}

export type PayslipLine = {
  id: number
  kind: 'earning' | 'deduction'
  description: string
  amount: string
  shift: number | null
  event_name: string | null
  is_basic: boolean
}

export type Payslip = {
  id: number
  employee: number
  employee_name: string
  employee_phone: string
  job_title: string
  kind: 'salary' | 'freelance'
  kind_label: string
  held: boolean
  payment_account: string
  basic_salary: string
  gross: string
  income_tax: string
  pension_employee: string
  pension_employer: string
  withholding: string
  other_deductions: string
  net: string
  employer_cost: string
  notes: string
  lines: PayslipLine[]
}

export type PayRun = PayRunListItem & {
  payment_method: string
  notes: string
  approved_by_name: string | null
  approved_at: string | null
  payslips: Payslip[]
  warnings: Array<{ code: string; message: string }>
  rules: PayrollRules
  can_approve: boolean
}

export function monthLabel(period: string) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}
