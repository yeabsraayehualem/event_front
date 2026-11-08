import { ETHIOPIAN_MONTHS, addDays, parseIsoDate, toEthiopian, todayUtc } from '@/lib/ethiopian-calendar'
import { useTranslation } from 'react-i18next'
import i18n, { intlLocale } from '@/i18n'
import { calendarRange, isoOf, monthStart } from './calendar-range'
import type { HROptions, Shift } from './types'

type CalendarEvent = HROptions['events'][number]
type Crew = { count: number; names: string[] }

/** Short weekday names, Monday first, in the current language (5 Jan 2026 is a Monday). */
function weekdays() {
  const format = new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2026, 0, 5 + i))))
}
const BOOKED = new Set(['scheduled', 'confirmed', 'completed'])

function crewByEvent(shifts: Shift[]) {
  const crew = new Map<number, Map<number, string>>()
  for (const shift of shifts) {
    if (!BOOKED.has(shift.status)) continue
    const people = crew.get(shift.event) ?? new Map<number, string>()
    people.set(shift.employee, shift.employee_name)
    crew.set(shift.event, people)
  }
  return new Map<number, Crew>([...crew].map(([eventId, people]) => [eventId, { count: people.size, names: [...people.values()] }]))
}

function crewLabel(crew: Crew | undefined) {
  if (!crew?.count) return i18n.t('crew:calendar.noCrew')
  const shown = crew.names.slice(0, 2).map((name) => name.split(' ')[0]).join(', ')
  return crew.count > 2 ? `${shown} +${crew.count - 2}` : shown
}

type CrewCalendarProps = {
  month: Date
  onMonthChange: (month: Date) => void
  events: CalendarEvent[]
  shifts: Shift[]
  selectedEventId: string
  onSelect: (eventId: number) => void
  loading?: boolean
}

/** Month view of events with the crew booked on each. Collapses to an agenda list on narrow screens. */
export function CrewCalendar({ month, onMonthChange, events, shifts, selectedEventId, onSelect, loading = false }: CrewCalendarProps) {
  const { t } = useTranslation('crew')
  const [start, end] = calendarRange(month)
  const today = isoOf(todayUtc())
  const crew = crewByEvent(shifts)
  const byDay = new Map<string, CalendarEvent[]>()
  for (const event of events) byDay.set(event.event_date, [...(byDay.get(event.event_date) ?? []), event])

  const days: Date[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day)
  const inMonth = (day: Date) => day.getUTCMonth() === month.getUTCMonth()
  const monthEvents = events
    .filter((event) => { const date = parseIsoDate(event.event_date); return date !== null && inMonth(date) && date.getUTCFullYear() === month.getUTCFullYear() })
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
  const unstaffed = monthEvents.filter((event) => !crew.get(event.id)?.count).length

  // The Ethiopian months this Gregorian month overlaps, e.g. "Tikimt – Hidar 2019".
  const etFirst = toEthiopian(monthStart(month))
  const etLast = toEthiopian(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)))
  const lang = i18n.language === 'en' ? 'en' : 'am'
  const WEEKDAYS = weekdays()
  const etLabel = etFirst.month === etLast.month
    ? `${ETHIOPIAN_MONTHS[etFirst.month - 1][lang]} ${etFirst.year}`
    : `${ETHIOPIAN_MONTHS[etFirst.month - 1][lang]} – ${ETHIOPIAN_MONTHS[etLast.month - 1][lang]} ${etLast.year}`
  const shift = (months: number) => onMonthChange(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + months, 1)))

  function eventChip(event: CalendarEvent) {
    const people = crew.get(event.id)
    const selected = String(event.id) === selectedEventId
    return (
      <button
        key={event.id}
        type="button"
        className={`crew-cal-event${selected ? ' is-selected' : ''}${people?.count ? '' : ' is-unstaffed'}`}
        aria-pressed={selected}
        title={`${event.name}\n${people?.count ? people.names.join(', ') : t('calendar.noCrewBooked')}`}
        onClick={() => onSelect(event.id)}
      >
        <strong>{event.name}</strong>
        <span><b>{people?.count ?? 0}</b> {crewLabel(people)}</span>
      </button>
    )
  }

  return (
    <section className={`dash-card crew-cal${loading ? ' is-refreshing' : ''}`} aria-label={t('calendar.label')}>
      <div className="crew-cal-head">
        <div>
          <h2>{new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month)}</h2>
          <span className="cat-muted">{etLabel} {t('datePicker.era', { ns: 'common' })} · {t('calendar.events', { count: monthEvents.length })}{unstaffed ? ` · ${t('calendar.withoutCrew', { count: unstaffed })}` : ''}</span>
        </div>
        <div className="crew-cal-nav">
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={() => shift(-1)} aria-label={t('calendar.previous')}>‹</button>
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={() => onMonthChange(monthStart(todayUtc()))}>{t('calendar.today')}</button>
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={() => shift(1)} aria-label={t('calendar.next')}>›</button>
        </div>
      </div>

      <div className="crew-cal-grid" role="grid" aria-label={t('calendar.month')}>
        {WEEKDAYS.map((day) => <div key={day} className="crew-cal-weekday" role="columnheader">{day}</div>)}
        {days.map((day) => {
          const iso = isoOf(day)
          const et = toEthiopian(day)
          const dayEvents = byDay.get(iso) ?? []
          return (
            <div key={iso} role="gridcell" className={`crew-cal-day${inMonth(day) ? '' : ' is-outside'}${iso === today ? ' is-today' : ''}`}>
              <div className="crew-cal-date">
                <span>{day.getUTCDate()}</span>
                <small>{et.day === 1 ? `${lang === 'en' ? ETHIOPIAN_MONTHS[et.month - 1].en.slice(0, 3) : ETHIOPIAN_MONTHS[et.month - 1].am} 1` : et.day}</small>
              </div>
              {dayEvents.map(eventChip)}
            </div>
          )
        })}
      </div>

      <ul className="crew-cal-agenda">
        {monthEvents.map((event) => {
          const date = parseIsoDate(event.event_date)!
          const et = toEthiopian(date)
          return (
            <li key={event.id}>
              <div className="crew-cal-agenda-date">
                <strong>{date.getUTCDate()}</strong>
                <span>{WEEKDAYS[(date.getUTCDay() + 6) % 7]}</span>
                <small>{lang === 'en' ? ETHIOPIAN_MONTHS[et.month - 1].en.slice(0, 3) : ETHIOPIAN_MONTHS[et.month - 1].am} {et.day}</small>
              </div>
              {eventChip(event)}
            </li>
          )
        })}
        {monthEvents.length === 0 && <li className="dash-empty">{t('calendar.noEvents')}</li>}
      </ul>
    </section>
  )
}
