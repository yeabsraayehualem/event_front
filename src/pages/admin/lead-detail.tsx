import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

type LeadStatus = 'lead' | 'contacted' | 'consultation_scheduled' | 'quotation_sent' | 'negotiation' | 'won' | 'lost' | 'cancelled'
type Lead = {
  id: number
  customer: { id: number; name: string; phone: string }
  plan: { id: number; name: string; packages: { id: number; name: string }[] }
  package: { id: number; name: string; contents?: { id: number; name: string; description: string }[] } | null
  date: string
  plan_date: string
  location: string
  status: LeadStatus
  status_label: string
  notes: string
  event_type: string
  guest_count: number | null
  budget_tier: string
  requirements: string
  assigned_sales_person: string | null
  assigned_sales_person_id: number | null
  can_assign_sales: boolean
  available_sales_people: { id: number; name: string }[]
  event_id: number | null
}

const statuses: { value: LeadStatus; label: string }[] = [
  { value: 'lead', label: 'New lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'consultation_scheduled', label: 'Consultation scheduled' },
  { value: 'quotation_sent', label: 'Quotation sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'cancelled', label: 'Cancelled' },
]

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('en-ET', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function responseMessage(body: unknown) {
  if (typeof body !== 'object' || body === null) return 'We could not save this lead.'
  if ('detail' in body && typeof body.detail === 'string') return body.detail
  if ('status' in body && Array.isArray(body.status)) return body.status.join(' ')
  return 'We could not save this lead.'
}

export function LeadDetailPage() {
  const { leadId } = useParams()
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const [lead, setLead] = useState<Lead | null>(null)
  const [status, setStatus] = useState<LeadStatus>('lead')
  const [notes, setNotes] = useState('')
  const [planDate, setPlanDate] = useState('')
  const [location, setLocation] = useState('')
  const [packageId, setPackageId] = useState('')
  const [salesPersonId, setSalesPersonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showEventPrompt, setShowEventPrompt] = useState(false)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [eventCreated, setEventCreated] = useState<number | null>(null)

  const loadLead = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/crm/sales/leads/${leadId}/`, {
        credentials: 'include', signal, headers: { Accept: 'application/json' },
      })
      const body: unknown = await response.json()
      if (response.status === 401 || response.status === 403) {
        if (response.status === 403) throw new Error(responseMessage(body))
        await logout()
        navigate('/login', { replace: true })
        return
      }
      if (response.status === 404) throw new Error('This lead is no longer available in your sales view.')
      if (!response.ok) throw new Error(responseMessage(body))
      const data = body as Lead
      setLead(data)
      setEventCreated(data.event_id)
      if (data.status === 'won' && !data.event_id) setShowEventPrompt(true)
      setStatus(data.status)
      setNotes(data.notes ?? '')
      setPlanDate(data.plan_date)
      setLocation(data.location ?? '')
      setPackageId(data.package ? String(data.package.id) : '')
      setSalesPersonId(data.assigned_sales_person_id ? String(data.assigned_sales_person_id) : '')
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [leadId, logout, navigate])

  useEffect(() => {
    const controller = new AbortController()
    void loadLead(controller.signal)
    return () => controller.abort()
  }, [loadLead])

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!leadId) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/user/csrf/`, {
        credentials: 'include', headers: { Accept: 'application/json' },
      })
      const csrfBody: unknown = await csrfResponse.json()
      const csrfToken = typeof csrfBody === 'object' && csrfBody !== null && 'csrf_token' in csrfBody
        ? (csrfBody as { csrf_token?: unknown }).csrf_token
        : undefined
      if (!csrfResponse.ok || typeof csrfToken !== 'string') {
        throw new Error('Could not prepare the secure session for saving this lead. Please reload and try again.')
      }
      const response = await fetch(`${apiBaseUrl}/crm/sales/leads/${leadId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          status,
          notes,
          plan_date: planDate,
          location,
          package_id: packageId ? Number(packageId) : null,
          ...(lead?.can_assign_sales
            ? { assigned_sales_person_id: salesPersonId ? Number(salesPersonId) : null }
            : {}),
        }),
      })
      const body: unknown = await response.json()
      if (response.status === 401 || response.status === 403) {
        if (response.status === 403) throw new Error(responseMessage(body))
        await logout()
        navigate('/login', { replace: true })
        return
      }
      if (!response.ok) throw new Error(responseMessage(body))
      const updated = body as Lead
      setLead(updated)
      setEventCreated(updated.event_id)
      setStatus(updated.status)
      setNotes(updated.notes ?? '')
      setPlanDate(updated.plan_date)
      setLocation(updated.location ?? '')
      setPackageId(updated.package ? String(updated.package.id) : '')
      setSalesPersonId(updated.assigned_sales_person_id ? String(updated.assigned_sales_person_id) : '')
      setSaved(true)
      if (updated.status === 'won' && !updated.event_id) setShowEventPrompt(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save this lead.')
    } finally {
      setSaving(false)
    }
  }

  async function createEventFromLead() {
    if (!leadId) return
    setCreatingEvent(true)
    setError('')
    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/user/csrf/`, { credentials: 'include' })
      const csrfBody: unknown = await csrfResponse.json()
      const csrfToken = typeof csrfBody === 'object' && csrfBody !== null && 'csrf_token' in csrfBody
        ? (csrfBody as { csrf_token?: unknown }).csrf_token : undefined
      if (!csrfResponse.ok || typeof csrfToken !== 'string') throw new Error('Could not prepare a secure event creation request.')
      const response = await fetch(`${apiBaseUrl}/crm/sales/leads/${leadId}/convert/`, {
        method: 'POST', credentials: 'include',
        headers: { Accept: 'application/json', 'X-CSRFToken': csrfToken },
      })
      const body: unknown = await response.json()
      if (!response.ok) throw new Error(responseMessage(body))
      const data = typeof body === 'object' && body !== null && 'data' in body
        ? (body as { data?: { id?: number } }).data : undefined
      const createdEventId = data?.id
      if (typeof createdEventId !== 'number') throw new Error('The event was created, but its reference was missing from the response.')
      setEventCreated(createdEventId)
      setShowEventPrompt(false)
      setLead((current) => current ? { ...current, event_id: createdEventId } : current)
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : 'We could not create the event.')
    } finally {
      setCreatingEvent(false)
    }
  }

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5">
            <Link to="/dashboard/leads" className="text-xs font-semibold uppercase tracking-[.12em] text-[#756039] hover:text-[#a64f42]">← Back to leads</Link>
          </div>
          {loading && <div className="dashboard-message" role="status">Loading lead details…</div>}
          {error && <section className="dashboard-message dashboard-message--error" role="alert"><div><strong>There’s a problem with this lead.</strong><p>{error}</p></div><button type="button" onClick={() => { const controller = new AbortController(); void loadLead(controller.signal) }}>Try again <span>↻</span></button></section>}

          {lead && (
            <>
              {lead.status === 'won' && (
                <section className="mb-6 flex flex-wrap items-center justify-between gap-4 border border-[#d8cba8] bg-[#fffdf7] p-5" aria-label="Won lead event conversion">
                  <div><h2 className="font-serif text-lg text-[#294635]">This celebration is won</h2><p className="mt-1 text-sm text-[#77766c]">Create its event record to carry the confirmed details forward.</p>{eventCreated && <p className="mt-2 text-sm font-semibold text-[#28513c]" role="status">Event #{eventCreated} is linked to this lead.</p>}</div>
                  {!eventCreated && <button type="button" onClick={() => setShowEventPrompt(true)} className="min-h-11 bg-[#28513c] px-5 text-xs font-semibold uppercase tracking-[.1em] text-[#fff9e9] hover:bg-[#1d3d2c]">Create event <span className="ml-2 text-[#e1c779]">↗</span></button>}
                </section>
              )}
              <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="dashboard-date mb-2">Lead workspace · #{lead.id}</p>
                  <h1 className="dashboard-title text-3xl font-semibold tracking-tight">{lead.customer.name}</h1>
                  <p className="dashboard-subtitle">Inquiry received {formatDate(lead.date)}</p>
                </div>
                <a href={`tel:${lead.customer.phone}`} className="inline-flex min-h-11 items-center border border-[#28513c] bg-[#28513c] px-5 text-xs font-semibold uppercase tracking-[.1em] text-[#fff9e9] hover:bg-[#1d3d2c]">Call customer <span className="ml-3 text-[#e1c779]">↗</span></a>
              </header>

              <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
                <section className="dashboard-card p-5 sm:p-7">
                  <div className="mb-6">
                    <h2>Event request</h2>
                    <p className="mt-1 text-sm text-slate-500">The details shared by the customer</p>
                  </div>
                  <dl className="grid gap-5 sm:grid-cols-2">
                    <div><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Customer phone</dt><dd className="text-sm font-medium text-[#294635]">{lead.customer.phone}</dd></div>
                    <div><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Event date</dt><dd className="text-sm font-medium text-[#294635]">{formatDate(lead.plan_date)}</dd></div>
                    <div><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Plan</dt><dd className="text-sm font-medium text-[#294635]">{lead.plan.name}</dd></div>
                    <div><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Package</dt><dd className="text-sm font-medium text-[#294635]">{lead.package?.name ?? 'No package selected'}</dd></div>
                    <div><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Event type</dt><dd className="text-sm font-medium text-[#294635]">{lead.event_type || 'Not provided'}</dd></div>
                    <div><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Estimated guests</dt><dd className="text-sm font-medium text-[#294635]">{lead.guest_count ?? 'Not provided'}</dd></div>
                    <div><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Budget range</dt><dd className="text-sm font-medium text-[#294635]">{lead.budget_tier || 'Not provided'}</dd></div>
                    <div className="sm:col-span-2"><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Requirements</dt><dd className="whitespace-pre-wrap text-sm font-medium text-[#294635]">{lead.requirements || 'No additional requirements provided'}</dd></div>
                    <div className="sm:col-span-2"><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Location</dt><dd className="text-sm font-medium text-[#294635]">{lead.location || 'Not provided'}</dd></div>
                  </dl>
                  {lead.package?.contents?.length ? (
                    <div className="mt-7 border-t border-[#e8e1d2] pt-5">
                      <h3 className="mb-3 font-serif text-lg text-[#294635]">Package includes</h3>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {lead.package.contents.map((content) => <li key={content.id} className="border-l-2 border-[#d2b267] pl-3"><span className="block text-sm font-medium text-[#294635]">{content.name}</span>{content.description && <span className="mt-1 block text-xs text-[#898679]">{content.description}</span>}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </section>

                <form onSubmit={saveLead} className="dashboard-card p-5 sm:p-7">
                  <div className="mb-6">
                    <h2>Work this lead</h2>
                    <p className="mt-1 text-sm text-slate-500">Record your follow-up and move it through the pipeline.</p>
                  </div>
                  <label className="mb-5 block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Lead status</span>
                    <select value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)} className="min-h-11 w-full border border-[#d8cba8] bg-[#fffdf7] px-3 text-sm text-[#294635] outline-none focus:border-[#28513c]">
                      {statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="mb-5 block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Agreed package</span>
                    <select value={packageId} onChange={(event) => setPackageId(event.target.value)} className="min-h-11 w-full border border-[#d8cba8] bg-[#fffdf7] px-3 text-sm text-[#294635] outline-none focus:border-[#28513c]">
                      <option value="">No package selected</option>
                      {lead.plan.packages.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                    <span className="mt-2 block text-xs text-[#898679]">Choose the package agreed with the customer.</span>
                  </label>
                  <label className="mb-5 block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Event date</span>
                    <input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)} className="min-h-11 w-full border border-[#d8cba8] bg-[#fffdf7] px-3 text-sm text-[#294635] outline-none focus:border-[#28513c]" />
                  </label>
                  <label className="mb-5 block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Event location</span>
                    <input type="text" maxLength={255} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Venue or neighborhood" className="min-h-11 w-full border border-[#d8cba8] bg-[#fffdf7] px-3 text-sm text-[#294635] outline-none placeholder:text-[#aaa597] focus:border-[#28513c]" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Follow-up notes</span>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={7} placeholder="Add the conversation, next steps, or details to remember…" className="w-full resize-y border border-[#d8cba8] bg-[#fffdf7] p-3 text-sm leading-6 text-[#294635] outline-none placeholder:text-[#aaa597] focus:border-[#28513c]" />
                  </label>
                  {lead.can_assign_sales ? (
                    <label className="mt-5 block">
                      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#898679]">Assign sales person</span>
                      <select value={salesPersonId} onChange={(event) => setSalesPersonId(event.target.value)} className="min-h-11 w-full border border-[#d8cba8] bg-[#fffdf7] px-3 text-sm text-[#294635] outline-none focus:border-[#28513c]">
                        <option value="">Unassigned</option>
                        {lead.available_sales_people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                      </select>
                    </label>
                  ) : (
                    <p className="mt-4 text-xs text-[#898679]">Assigned to {lead.assigned_sales_person ?? 'no sales person yet'}</p>
                  )}
                  {saved && <p className="mt-4 text-sm font-medium text-[#42674b]" role="status">Lead updates saved.</p>}
                  <button type="submit" disabled={saving} className="mt-5 min-h-12 w-full bg-[#28513c] px-5 text-xs font-semibold uppercase tracking-[.12em] text-[#fff9e9] transition-colors hover:bg-[#1d3d2c] disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving updates…' : 'Save lead updates'}</button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>
      {showEventPrompt && lead?.status === 'won' && !eventCreated && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#17251d]/55 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="won-event-title" className="w-full max-w-md border border-[#d8cba8] bg-[#fffdf7] p-7 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#a64f42]">A new beginning</p>
            <h2 id="won-event-title" className="mt-2 font-serif text-2xl text-[#294635]">Create the event now?</h2>
            <p className="mt-3 text-sm leading-6 text-[#77766c]">The confirmed customer, celebration, date, package, and location will be carried into an event record.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowEventPrompt(false)} className="min-h-11 border border-[#d8cba8] px-4 text-sm text-[#53614a]">Later</button>
              <button type="button" disabled={creatingEvent} onClick={() => void createEventFromLead()} className="min-h-11 bg-[#28513c] px-5 text-sm font-semibold text-white disabled:opacity-60">{creatingEvent ? 'Creating…' : 'Create event'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
