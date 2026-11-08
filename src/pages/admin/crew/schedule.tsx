import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { AccessLink } from '@/components/admin/access-link'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { apiBaseUrl } from '@/lib/api'
import { apiRequest } from '@/lib/api-request'
import { getErrorMessage } from '@/lib/api-errors'
import { fetchCsrfToken } from '@/lib/csrf'
import { formatDualDate, parseIsoDate, todayUtc } from '@/lib/ethiopian-calendar'
import { formatMoney, joinDateTime, splitDateTime } from '../procurement/types'
import { calendarRange, isoOf, monthStart } from './calendar-range'
import { CrewCalendar } from './crew-calendar'
import { rateLabel, timeRange, type Conflict, type HROptions, type Shift } from './types'

type Booking = { employee: string; role: string; date: string; startTime: string; endDate: string; endTime: string }

const COUNTED = new Set(['scheduled', 'confirmed', 'completed'])

/** POST a booking; returns the clashes instead of throwing when the person is double-booked. */
async function createShift(body: Record<string, unknown>): Promise<{ shift?: Shift; conflicts?: Conflict[]; message?: string }> {
  const response = await fetch(`${apiBaseUrl}/hr/shifts/`, {
    method: 'POST', credentials: 'include', body: JSON.stringify(body),
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': await fetchCsrfToken() },
  })
  const data = await response.json() as Record<string, unknown>
  if (response.ok) return { shift: data as unknown as Shift }
  if (Array.isArray(data.conflicts)) return { conflicts: data.conflicts as Conflict[], message: String(data.detail ?? '') }
  throw new Error(getErrorMessage(data, i18n.t('crew:schedule.bookFailed'), { employee: i18n.t('crew:schedule.person'), end: i18n.t('crew:schedule.end') }))
}

export function CrewSchedulePage() {
  const { t } = useTranslation('crew')
  const [searchParams, setSearchParams] = useSearchParams()
  const eventId = searchParams.get('event') ?? ''
  const [options, setOptions] = useState<HROptions | null>(null)
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [booking, setBooking] = useState<Booking>({ employee: searchParams.get('employee') ?? '', role: '', date: '', startTime: '08:00', endDate: '', endTime: '18:00' })
  const [skill, setSkill] = useState('')
  const [payMethod, setPayMethod] = useState('bank_transfer')
  const [busyId, setBusyId] = useState<number | 'new' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [month, setMonth] = useState(() => monthStart(todayUtc()))
  const [monthShifts, setMonthShifts] = useState<Shift[]>([])
  const [monthLoading, setMonthLoading] = useState(true)
  const [calendarKey, setCalendarKey] = useState(0)
  const crewSection = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<HROptions>('/hr/options/', { signal: controller.signal, fallback: t('loadOptions') })
      .then((loaded) => {
        setOptions(loaded)
        // Opened with ?event=… (e.g. from a person's page): show that event's month.
        const linked = loaded.events.find((item) => String(item.id) === new URLSearchParams(window.location.search).get('event'))
        const linkedDate = linked ? parseIsoDate(linked.event_date) : null
        if (linkedDate) setMonth(monthStart(linkedDate))
      })
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [])

  const loadShifts = useCallback(async (signal?: AbortSignal) => {
    if (!eventId) return
    try {
      setShifts(await apiRequest<Shift[]>(`/hr/shifts/?event=${eventId}`, { signal, fallback: t('schedule.loadShifts') }))
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
    }
  }, [eventId])

  useEffect(() => {
    const controller = new AbortController()
    void loadShifts(controller.signal)
    return () => controller.abort()
  }, [loadShifts])

  // Everyone booked on any event shown in the calendar month.
  useEffect(() => {
    const controller = new AbortController()
    const [start, end] = calendarRange(month)
    apiRequest<Shift[]>(`/hr/shifts/?start_date=${isoOf(start)}&end_date=${isoOf(end)}`, { signal: controller.signal, fallback: t('schedule.loadMonth') })
      .then((loaded) => { setMonthShifts(loaded); setMonthLoading(false) })
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') { setError(loadError.message); setMonthLoading(false) } })
    return () => controller.abort()
  }, [month, calendarKey])

  const refreshCalendar = () => setCalendarKey((key) => key + 1)

  function selectEvent(id: string) {
    setSearchParams(id ? { event: id } : {})
    setShifts(null)
    setBooking((current) => ({ ...current, date: '', endDate: '' }))
    setNotice('')
    const picked = options?.events.find((item) => String(item.id) === id)
    const pickedDate = picked ? parseIsoDate(picked.event_date) : null
    if (pickedDate && monthStart(pickedDate).getTime() !== month.getTime()) { setMonthLoading(true); setMonth(monthStart(pickedDate)) }
    requestAnimationFrame(() => crewSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const event = options?.events.find((item) => String(item.id) === eventId)
  // Default the booking to the event day once an event is chosen.
  const bookingDate = booking.date || event?.event_date || ''
  const bookingEndDate = booking.endDate || bookingDate
  const visibleShifts = eventId ? shifts?.filter((shift) => String(shift.event) === eventId) ?? null : null

  async function book(allowConflict = false) {
    if (!eventId || !booking.employee || !bookingDate) { setError(t('schedule.needPersonDate')); return }
    setBusyId('new')
    setError('')
    setNotice('')
    try {
      const body: Record<string, unknown> = {
        event: Number(eventId), employee: Number(booking.employee),
        start: joinDateTime(bookingDate, booking.startTime), end: joinDateTime(bookingEndDate, booking.endTime),
        allow_conflict: allowConflict,
      }
      if (booking.role.trim()) body.role = booking.role.trim()
      const result = await createShift(body)
      if (result.conflicts) {
        const list = result.conflicts.map((clash) => `• ${clash.event_name} (${clash.role}), ${timeRange(clash.start, clash.end)}`).join('\n')
        if (window.confirm(`${result.message}\n\n${list}\n\n${t('schedule.bookAnyway')}`)) await book(true)
        return
      }
      setBooking((current) => ({ ...current, employee: '', role: '' }))
      setNotice(t('schedule.booked', { name: result.shift?.employee_name }))
      await loadShifts()
      refreshCalendar()
    } catch (bookError) {
      setError(bookError instanceof Error ? bookError.message : t('schedule.bookFailed'))
    } finally {
      setBusyId(null)
    }
  }

  async function patchShift(shift: Shift, changes: Record<string, unknown>) {
    setBusyId(shift.id)
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<Shift>(`/hr/shifts/${shift.id}/`, { method: 'PATCH', body: { ...changes, allow_conflict: true }, fallback: t('schedule.updateFailed') })
      setShifts((current) => current?.map((item) => item.id === shift.id ? updated : item) ?? current)
      if (changes.status) refreshCalendar()
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : t('schedule.updateFailed'))
    } finally {
      setBusyId(null)
    }
  }

  async function removeShift(shift: Shift) {
    if (!window.confirm(t('schedule.confirmRemove', { name: shift.employee_name, event: shift.event_name }))) return
    setBusyId(shift.id)
    setError('')
    try {
      await apiRequest(`/hr/shifts/${shift.id}/`, { method: 'DELETE', fallback: t('schedule.removeFailed') })
      setShifts((current) => current?.filter((item) => item.id !== shift.id) ?? current)
      refreshCalendar()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('schedule.removeFailed'))
    } finally {
      setBusyId(null)
    }
  }

  async function pay(shift: Shift) {
    if (!window.confirm(t('schedule.confirmPay', { name: shift.employee_name, amount: formatMoney(shift.amount), event: shift.event_name }))) return
    setBusyId(shift.id)
    setError('')
    try {
      const updated = await apiRequest<Shift>(`/hr/shifts/${shift.id}/payout/`, { method: 'POST', body: { payment_method: payMethod }, fallback: t('schedule.payFailed') })
      setShifts((current) => current?.map((item) => item.id === shift.id ? updated : item) ?? current)
      setNotice(t('schedule.paid', { name: shift.employee_name, reference: updated.payout?.reference }))
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : t('schedule.payFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const counted = (visibleShifts ?? []).filter((shift) => COUNTED.has(shift.status))
  const crewCost = counted.reduce((sum, shift) => sum + Number(shift.amount), 0)
  const paid = (visibleShifts ?? []).filter((shift) => shift.payout).reduce((sum, shift) => sum + Number(shift.amount), 0)
  const people = (options?.employees ?? []).filter((person) => !skill || person.skills.includes(skill))
  const selectedPerson = options?.employees.find((person) => String(person.id) === booking.employee)
  const editable = options?.can_edit ?? false

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">{t('eyebrow')}</p>
            <h1 className="dash-title">{t('schedule.title')}</h1>
          </div>
          <select className="o-input crew-event-picker" aria-label={t('schedule.event')} value={eventId} onChange={(change) => selectEvent(change.target.value)}>
            <option value="">{t('schedule.chooseEvent')}</option>
            {options?.events.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatDualDate(item.event_date)}</option>)}
          </select>
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {notice && <p className="o-inline-notice" role="status">{notice}</p>}
        {!options && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
        {options && (
          <CrewCalendar
            month={month}
            onMonthChange={(next) => { setMonthLoading(true); setMonth(next) }}
            events={options.events}
            shifts={monthShifts}
            selectedEventId={eventId}
            onSelect={(id) => selectEvent(String(id))}
            loading={monthLoading}
          />
        )}

        <div ref={crewSection} className="crew-section-anchor" />
        {options && !eventId && <p className="dash-empty">{t('schedule.pickEvent')}</p>}

        {options && event && (
          <>
            <h2 className="crew-section-title">{event.name}</h2>
            <div className="proc-budget crew-summary">
              <div><span>{t('schedule.event')}</span><strong>{formatDualDate(event.event_date)}</strong><small>{event.location}</small></div>
              <div><span>{t('schedule.crewBooked')}</span><strong>{new Set(counted.map((shift) => shift.employee)).size}</strong><small>{t('schedule.shifts', { count: counted.length })}</small></div>
              <div><span>{t('schedule.crewCost')}</span><strong>{formatMoney(crewCost)}</strong><small>{t('schedule.crewCostHint')}</small></div>
              <div><span>{t('schedule.paidSoFar')}</span><strong>{formatMoney(paid)}</strong></div>
            </div>

            {editable && (
              <section className="dash-card crew-booking" aria-label={t('schedule.bookSomeone')}>
                <h2 className="proc-subhead">{t('schedule.bookSomeone')}</h2>
                <div className="crew-booking-row">
                  <select className="o-input" aria-label={t('schedule.filterBySkill')} value={skill} onChange={(change) => setSkill(change.target.value)}>
                    <option value="">{t('schedule.anySkill')}</option>
                    {options.skills.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                  </select>
                  <select className="o-input crew-person" aria-label={t('schedule.person')} value={booking.employee} onChange={(change) => setBooking({ ...booking, employee: change.target.value })}>
                    <option value="">{t('schedule.choosePerson')}</option>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {rateLabel(person.wage_basis, person.rate)}</option>)}
                  </select>
                  <input className="o-input" aria-label={t('schedule.roleLabel')} placeholder={selectedPerson?.job_title || selectedPerson?.skills[0] || t('schedule.rolePlaceholder')} value={booking.role} onChange={(change) => setBooking({ ...booking, role: change.target.value })} />
                </div>
                <div className="crew-booking-row">
                  <EthiopianDateInput value={bookingDate} onChange={(iso) => setBooking({ ...booking, date: iso })} />
                  <input className="o-input crew-time" type="time" aria-label={t('schedule.startTime')} value={booking.startTime} onChange={(change) => setBooking({ ...booking, startTime: change.target.value })} />
                  <span aria-hidden="true">→</span>
                  <EthiopianDateInput value={bookingEndDate} min={bookingDate || undefined} onChange={(iso) => setBooking({ ...booking, endDate: iso })} />
                  <input className="o-input crew-time" type="time" aria-label={t('schedule.endTime')} value={booking.endTime} onChange={(change) => setBooking({ ...booking, endTime: change.target.value })} />
                  <button type="button" className="o-btn o-btn-primary" disabled={busyId === 'new' || !booking.employee} onClick={() => void book()}>{busyId === 'new' ? t('schedule.booking') : t('schedule.book')}</button>
                </div>
              </section>
            )}

            <section className="dash-card dash-card--flush">
              <div className="dash-card-head crew-table-head">
                <h2>{t('schedule.crewOnEvent')}</h2>
                {options.can_pay && (
                  <label className="proc-toggle">{t('schedule.payBy')}
                    <select className="o-input proc-select" value={payMethod} onChange={(change) => setPayMethod(change.target.value)}>
                      {options.payment_methods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {!visibleShifts ? <div className="o-form-loading" role="status"><span /><span /><span /></div> : visibleShifts.length === 0 ? <p className="dash-empty">{t('schedule.nobody')}</p> : (
                <div className="overflow-x-auto">
                  <table className="dash-table crew-table">
                    <thead><tr>
                      <th scope="col">{t('schedule.person')}</th><th scope="col">{t('schedule.role')}</th><th scope="col">{t('schedule.when')}</th><th scope="col">{t('schedule.status')}</th>
                      <th scope="col" className="o-num">{t('schedule.days')}</th><th scope="col" className="o-num">{t('schedule.amount')}</th><th scope="col">{t('schedule.pay')}</th>
                      {editable && <th scope="col"><span className="sr-only">{t('schedule.actions')}</span></th>}
                    </tr></thead>
                    <tbody>
                      {visibleShifts.map((shift) => {
                        const locked = Boolean(shift.payout || shift.pay_run) || !editable
                        const startParts = splitDateTime(shift.start)
                        return (
                          <tr key={shift.id} className={shift.conflicts.length ? 'is-dirty' : ''}>
                            <td>
                              <Link to={`/dashboard/crew/${shift.employee}`} className="dash-row-title">{shift.employee_name}</Link>
                              <div className="cat-muted">{shift.employee_phone}</div>
                              {shift.conflicts.length > 0 && <div className="proc-warning crew-clash">{t('schedule.alsoBooked', { events: shift.conflicts.map((clash) => clash.event_name).join(', ') })}</div>}
                            </td>
                            <td>{shift.role}</td>
                            <td className="dash-muted">{formatDualDate(startParts.date)}<div>{timeRange(shift.start, shift.end)}</div></td>
                            <td>
                              {locked ? <span className={`proc-status crew-status--${shift.status}`}>{shift.status_label}</span> : (
                                <select className="o-input crew-status-select" aria-label={t('schedule.statusOf', { name: shift.employee_name })} value={shift.status} disabled={busyId === shift.id} onChange={(change) => void patchShift(shift, { status: change.target.value })}>
                                  {options.shift_statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                </select>
                              )}
                            </td>
                            <td className="o-num">
                              {shift.wage_basis !== 'daily' ? <span className="dash-muted">—</span> : locked ? Number(shift.units) : (
                                <input className="o-input o-num crew-units" type="number" min="0" step="0.5" aria-label={t('schedule.daysWorked')} defaultValue={Number(shift.units)} key={shift.units}
                                  onBlur={(change) => { if (Number(change.target.value) !== Number(shift.units)) void patchShift(shift, { units: change.target.value }) }} />
                              )}
                            </td>
                            <td className="o-num">{shift.payable ? formatMoney(shift.amount) : <span className="dash-muted">{t('schedule.salaried')}</span>}</td>
                            <td>
                              {shift.payout ? <AccessLink module="expenses" to={`/dashboard/expenses/${shift.payout.id}`} className="proc-status proc-status--received">{t('schedule.paidRef', { reference: shift.payout.reference })}</AccessLink>
                                : shift.pay_run ? <AccessLink module="payroll" to={`/dashboard/payroll/${shift.pay_run.id}`} className="proc-status proc-status--submitted">{t('schedule.onRun', { reference: shift.pay_run.reference })}</AccessLink>
                                : !shift.payable ? <span className="dash-muted">{t('schedule.payroll')}</span>
                                : shift.status !== 'completed' ? <span className="dash-muted">{t('schedule.afterEvent')}</span>
                                : options.can_pay ? <button type="button" className="o-btn o-btn-primary o-btn-sm" disabled={busyId === shift.id || Number(shift.amount) <= 0} onClick={() => void pay(shift)}>{t('schedule.payAmount', { amount: formatMoney(shift.amount) })}</button>
                                : <span className="dash-muted">{t('schedule.waitingFinance')}</span>}
                            </td>
                            {editable && (
                              <td className="o-list-actions">
                                {!shift.payout && !shift.pay_run && <button type="button" className="o-btn o-btn-link o-btn-sm o-btn-danger" aria-label={t('schedule.removePerson', { name: shift.employee_name })} title={t('schedule.remove')} disabled={busyId === shift.id} onClick={() => void removeShift(shift)}>🗑</button>}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  )
}
