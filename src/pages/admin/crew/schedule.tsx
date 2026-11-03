import { useCallback, useEffect, useRef, useState } from 'react'
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
  throw new Error(getErrorMessage(data, 'Could not book this person.', { employee: 'Person', end: 'End' }))
}

export function CrewSchedulePage() {
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
    apiRequest<HROptions>('/hr/options/', { signal: controller.signal, fallback: 'Could not load crew options.' })
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
      setShifts(await apiRequest<Shift[]>(`/hr/shifts/?event=${eventId}`, { signal, fallback: 'Could not load the crew for this event.' }))
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
    apiRequest<Shift[]>(`/hr/shifts/?start_date=${isoOf(start)}&end_date=${isoOf(end)}`, { signal: controller.signal, fallback: 'Could not load the month’s crew.' })
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
    if (!eventId || !booking.employee || !bookingDate) { setError('Choose a person and a date.'); return }
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
        if (window.confirm(`${result.message}\n\n${list}\n\nBook anyway?`)) await book(true)
        return
      }
      setBooking((current) => ({ ...current, employee: '', role: '' }))
      setNotice(`${result.shift?.employee_name} booked.`)
      await loadShifts()
      refreshCalendar()
    } catch (bookError) {
      setError(bookError instanceof Error ? bookError.message : 'Could not book this person.')
    } finally {
      setBusyId(null)
    }
  }

  async function patchShift(shift: Shift, changes: Record<string, unknown>) {
    setBusyId(shift.id)
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<Shift>(`/hr/shifts/${shift.id}/`, { method: 'PATCH', body: { ...changes, allow_conflict: true }, fallback: 'Could not update this shift.' })
      setShifts((current) => current?.map((item) => item.id === shift.id ? updated : item) ?? current)
      if (changes.status) refreshCalendar()
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Could not update this shift.')
    } finally {
      setBusyId(null)
    }
  }

  async function removeShift(shift: Shift) {
    if (!window.confirm(`Remove ${shift.employee_name} from ${shift.event_name}?`)) return
    setBusyId(shift.id)
    setError('')
    try {
      await apiRequest(`/hr/shifts/${shift.id}/`, { method: 'DELETE', fallback: 'Could not remove this shift.' })
      setShifts((current) => current?.filter((item) => item.id !== shift.id) ?? current)
      refreshCalendar()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove this shift.')
    } finally {
      setBusyId(null)
    }
  }

  async function pay(shift: Shift) {
    if (!window.confirm(`Pay ${shift.employee_name} ${formatMoney(shift.amount)} for ${shift.event_name}? This records an expense on the event.`)) return
    setBusyId(shift.id)
    setError('')
    try {
      const updated = await apiRequest<Shift>(`/hr/shifts/${shift.id}/payout/`, { method: 'POST', body: { payment_method: payMethod }, fallback: 'Could not pay this shift.' })
      setShifts((current) => current?.map((item) => item.id === shift.id ? updated : item) ?? current)
      setNotice(`${shift.employee_name} paid (${updated.payout?.reference}).`)
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : 'Could not pay this shift.')
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
            <p className="dash-eyebrow">Crew</p>
            <h1 className="dash-title">Event schedule</h1>
          </div>
          <select className="o-input crew-event-picker" aria-label="Event" value={eventId} onChange={(change) => selectEvent(change.target.value)}>
            <option value="">Choose an event…</option>
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
        {options && !eventId && <p className="dash-empty">Pick an event on the calendar to see and book its crew.</p>}

        {options && event && (
          <>
            <h2 className="crew-section-title">{event.name}</h2>
            <div className="proc-budget crew-summary">
              <div><span>Event</span><strong>{formatDualDate(event.event_date)}</strong><small>{event.location}</small></div>
              <div><span>Crew booked</span><strong>{new Set(counted.map((shift) => shift.employee)).size}</strong><small>{counted.length} shifts</small></div>
              <div><span>Crew cost</span><strong>{formatMoney(crewCost)}</strong><small>Freelance pay; salaried staff are on payroll</small></div>
              <div><span>Paid so far</span><strong>{formatMoney(paid)}</strong></div>
            </div>

            {editable && (
              <section className="dash-card crew-booking" aria-label="Book someone">
                <h2 className="proc-subhead">Book someone</h2>
                <div className="crew-booking-row">
                  <select className="o-input" aria-label="Filter by skill" value={skill} onChange={(change) => setSkill(change.target.value)}>
                    <option value="">Any skill</option>
                    {options.skills.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                  </select>
                  <select className="o-input crew-person" aria-label="Person" value={booking.employee} onChange={(change) => setBooking({ ...booking, employee: change.target.value })}>
                    <option value="">Choose a person</option>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {rateLabel(person.wage_basis, person.rate)}</option>)}
                  </select>
                  <input className="o-input" aria-label="Role on this event" placeholder={selectedPerson?.job_title || selectedPerson?.skills[0] || 'Role, e.g. Usher'} value={booking.role} onChange={(change) => setBooking({ ...booking, role: change.target.value })} />
                </div>
                <div className="crew-booking-row">
                  <EthiopianDateInput value={bookingDate} onChange={(iso) => setBooking({ ...booking, date: iso })} />
                  <input className="o-input crew-time" type="time" aria-label="Start time" value={booking.startTime} onChange={(change) => setBooking({ ...booking, startTime: change.target.value })} />
                  <span aria-hidden="true">→</span>
                  <EthiopianDateInput value={bookingEndDate} min={bookingDate || undefined} onChange={(iso) => setBooking({ ...booking, endDate: iso })} />
                  <input className="o-input crew-time" type="time" aria-label="End time" value={booking.endTime} onChange={(change) => setBooking({ ...booking, endTime: change.target.value })} />
                  <button type="button" className="o-btn o-btn-primary" disabled={busyId === 'new' || !booking.employee} onClick={() => void book()}>{busyId === 'new' ? 'Booking…' : 'Book'}</button>
                </div>
              </section>
            )}

            <section className="dash-card dash-card--flush">
              <div className="dash-card-head crew-table-head">
                <h2>Crew on this event</h2>
                {options.can_pay && (
                  <label className="proc-toggle">Pay by
                    <select className="o-input proc-select" value={payMethod} onChange={(change) => setPayMethod(change.target.value)}>
                      {options.payment_methods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {!visibleShifts ? <div className="o-form-loading" role="status"><span /><span /><span /></div> : visibleShifts.length === 0 ? <p className="dash-empty">Nobody booked yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="dash-table crew-table">
                    <thead><tr>
                      <th scope="col">Person</th><th scope="col">Role</th><th scope="col">When</th><th scope="col">Status</th>
                      <th scope="col" className="o-num">Days</th><th scope="col" className="o-num">Amount</th><th scope="col">Pay</th>
                      {editable && <th scope="col"><span className="sr-only">Actions</span></th>}
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
                              {shift.conflicts.length > 0 && <div className="proc-warning crew-clash">Also booked: {shift.conflicts.map((clash) => clash.event_name).join(', ')}</div>}
                            </td>
                            <td>{shift.role}</td>
                            <td className="dash-muted">{formatDualDate(startParts.date)}<div>{timeRange(shift.start, shift.end)}</div></td>
                            <td>
                              {locked ? <span className={`proc-status crew-status--${shift.status}`}>{shift.status_label}</span> : (
                                <select className="o-input crew-status-select" aria-label={`Status of ${shift.employee_name}`} value={shift.status} disabled={busyId === shift.id} onChange={(change) => void patchShift(shift, { status: change.target.value })}>
                                  {options.shift_statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                </select>
                              )}
                            </td>
                            <td className="o-num">
                              {shift.wage_basis !== 'daily' ? <span className="dash-muted">—</span> : locked ? Number(shift.units) : (
                                <input className="o-input o-num crew-units" type="number" min="0" step="0.5" aria-label="Days worked" defaultValue={Number(shift.units)} key={shift.units}
                                  onBlur={(change) => { if (Number(change.target.value) !== Number(shift.units)) void patchShift(shift, { units: change.target.value }) }} />
                              )}
                            </td>
                            <td className="o-num">{shift.payable ? formatMoney(shift.amount) : <span className="dash-muted">Salaried</span>}</td>
                            <td>
                              {shift.payout ? <AccessLink module="expenses" to={`/dashboard/expenses/${shift.payout.id}`} className="proc-status proc-status--received">Paid · {shift.payout.reference}</AccessLink>
                                : shift.pay_run ? <AccessLink module="payroll" to={`/dashboard/payroll/${shift.pay_run.id}`} className="proc-status proc-status--submitted">On {shift.pay_run.reference}</AccessLink>
                                : !shift.payable ? <span className="dash-muted">Payroll</span>
                                : shift.status !== 'completed' ? <span className="dash-muted">After the event</span>
                                : options.can_pay ? <button type="button" className="o-btn o-btn-primary o-btn-sm" disabled={busyId === shift.id || Number(shift.amount) <= 0} onClick={() => void pay(shift)}>Pay {formatMoney(shift.amount)}</button>
                                : <span className="dash-muted">Waiting for finance</span>}
                            </td>
                            {editable && (
                              <td className="o-list-actions">
                                {!shift.payout && !shift.pay_run && <button type="button" className="o-btn o-btn-link o-btn-sm o-btn-danger" aria-label={`Remove ${shift.employee_name}`} title="Remove" disabled={busyId === shift.id} onClick={() => void removeShift(shift)}>🗑</button>}
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
