import { addDays } from '@/lib/ethiopian-calendar'

/** ISO yyyy-mm-dd of a UTC calendar day. */
export const isoOf = (date: Date) => date.toISOString().slice(0, 10)

export function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/** Monday-first weeks covering the whole month: the date range the calendar shows. */
export function calendarRange(month: Date): [Date, Date] {
  const first = monthStart(month)
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
  const start = addDays(first, -((first.getUTCDay() + 6) % 7))
  const end = addDays(last, (7 - last.getUTCDay()) % 7)
  return [start, end]
}

