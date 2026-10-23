import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { RecordFormView } from '@/components/admin/record-form-view'

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
                <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e5e1d6] bg-white p-5 shadow-sm" aria-label="Won lead event conversion">
                  <div><h2 className="font-serif text-lg text-[#294635]">This celebration is won</h2><p className="mt-1 text-sm text-[#77766c]">Create its event record to carry the confirmed details forward.</p>{eventCreated && <p className="mt-2 text-sm font-semibold text-[#28513c]" role="status">Event #{eventCreated} is linked to this lead.</p>}</div>
                  {!eventCreated && <button type="button" onClick={() => setShowEventPrompt(true)} className="min-h-11 rounded-lg bg-[#28513c] px-5 text-xs font-semibold uppercase tracking-[.1em] text-[#fff9e9] hover:bg-[#1d3d2c]">Create event <span className="ml-2 text-[#e1c779]">↗</span></button>}
                </section>
              )}
              <RecordFormView
                modelName="Lead"
                title={lead.customer.name}
                subtitle={`Inquiry received ${formatDate(lead.date)}`}
                recordId={lead.id}
                backHref="/dashboard/leads"
                backLabel="All leads"
                status={status}
                statusOptions={statuses}
                onStatusChange={(value) => {
                  const selected = statuses.find((option) => option.value === value)
                  if (selected) setStatus(selected.value)
                }}
                headerFields={[
                  { name: 'customer_name', label: 'Customer', value: lead.customer.name, readOnly: true },
                  { name: 'phone', label: 'Phone', value: lead.customer.phone, type: 'tel', readOnly: true },
                  { name: 'plan', label: 'Event plan', value: lead.plan.name, readOnly: true },
                  {
                    name: 'package_id',
                    label: 'Package',
                    type: 'select',
                    value: packageId,
                    options: [
                      { value: '', label: 'No package selected' },
                      ...lead.plan.packages.map((item) => ({ value: String(item.id), label: item.name })),
                    ],
                  },
                  { name: 'plan_date', label: 'Event date', type: 'date', value: planDate, required: true },
                ]}
                sections={[
                  {
                    title: 'Celebration details',
                    description: 'The event information shared with the original inquiry.',
                    fields: [
                      { name: 'event_type', label: 'Event type', value: lead.event_type, readOnly: true },
                      { name: 'guest_count', label: 'Estimated guests', value: lead.guest_count, readOnly: true },
                      { name: 'budget_tier', label: 'Budget range', value: lead.budget_tier, readOnly: true },
                      { name: 'requirements', label: 'Customer requirements', value: lead.requirements, fullWidth: true, readOnly: true },
                      { name: 'location', label: 'Venue or location', value: location, placeholder: 'To be confirmed' },
                    ],
                  },
                  {
                    title: 'Follow-up',
                    description: 'Keep the sales team up to date on the next step.',
                    fields: [
                      { name: 'notes', label: 'Notes', type: 'textarea', value: notes, fullWidth: true, placeholder: 'Add discussion notes or the next step…' },
                      {
                        name: 'assigned_sales_person_id',
                        label: 'Assigned sales person',
                        type: 'select',
                        value: lead.can_assign_sales ? salesPersonId : lead.assigned_sales_person ?? 'Unassigned',
                        readOnly: !lead.can_assign_sales,
                        options: [
                          { value: '', label: 'Unassigned' },
                          ...lead.available_sales_people.map((person) => ({ value: String(person.id), label: person.name })),
                        ],
                      },
                    ],
                  },
                ]}
                onFieldChange={(name, value) => {
                  if (name === 'package_id') setPackageId(value)
                  if (name === 'plan_date') setPlanDate(value)
                  if (name === 'location') setLocation(value)
                  if (name === 'notes') setNotes(value)
                  if (name === 'assigned_sales_person_id') setSalesPersonId(value)
                }}
                onSubmit={saveLead}
                saving={saving}
                saved={saved}
                submitLabel="Save changes"
                submittingLabel="Saving changes…"
              />

            </>
          )}
        </div>
      </main>
      {showEventPrompt && lead?.status === 'won' && !eventCreated && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#17251d]/55 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="won-event-title" className="w-full max-w-md rounded-2xl border border-[#e5e1d6] bg-white p-7 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#a64f42]">A new beginning</p>
            <h2 id="won-event-title" className="mt-2 font-serif text-2xl text-[#294635]">Create the event now?</h2>
            <p className="mt-3 text-sm leading-6 text-[#77766c]">The confirmed customer, celebration, date, package, and location will be carried into an event record.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowEventPrompt(false)} className="min-h-11 rounded-lg border border-[#e5e1d6] px-4 text-sm text-[#53614a]">Later</button>
              <button type="button" disabled={creatingEvent} onClick={() => void createEventFromLead()} className="min-h-11 rounded-lg bg-[#28513c] px-5 text-sm font-semibold text-white disabled:opacity-60">{creatingEvent ? 'Creating…' : 'Create event'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
