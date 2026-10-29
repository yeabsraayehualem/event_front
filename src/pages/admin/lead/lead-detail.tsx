import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { RecordFormView } from '@/components/admin/record-form-view'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { fetchCsrfToken } from '@/lib/csrf'

type LeadStatus = 'lead' | 'contacted' | 'consultation_scheduled' | 'quotation_sent' | 'negotiation' | 'won' | 'lost' | 'cancelled'
type Lead = {
  id: number
  customer: { id: number; name: string; phone: string }
  plan: { id: number; name: string; packages: { id: number; name: string }[]; event_types: { id: number; name: string }[] }
  package: { id: number; name: string; contents?: { id: number; name: string; description: string }[] } | null
  date: string
  plan_date: string
  location: string
  status: LeadStatus
  status_label: string
  notes: string
  event_type: string | null
  event_type_id: number | null
  guest_count: number | null
  budget_tier: string
  requirements: string
  assigned_sales_person: string | null
  assigned_sales_person_id: number | null
  can_assign_sales: boolean
  available_sales_people: { id: number; name: string }[]
  event_id: number | null
  invoice_ids: number[]
  project_ids: number[]
}

const statuses: { value: LeadStatus; label: string; folded?: boolean }[] = [
  { value: 'lead', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'consultation_scheduled', label: 'Consultation' },
  { value: 'quotation_sent', label: 'Quotation sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost', folded: true },
  { value: 'cancelled', label: 'Cancelled', folded: true },
]
const closedStatuses: LeadStatus[] = ['won', 'lost', 'cancelled']

function formatDate(value: string) {
  return formatDualDate(value)
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
  const [eventTypeId, setEventTypeId] = useState('')
  const [salesPersonId, setSalesPersonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [chatterKey, setChatterKey] = useState(0)

  const resetDraft = useCallback((data: Lead) => {
    setStatus(data.status)
    setNotes(data.notes ?? '')
    setPlanDate(data.plan_date)
    setLocation(data.location ?? '')
    setPackageId(data.package ? String(data.package.id) : '')
    setEventTypeId(data.event_type_id ? String(data.event_type_id) : '')
    setSalesPersonId(data.assigned_sales_person_id ? String(data.assigned_sales_person_id) : '')
  }, [])

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
      resetDraft(data)
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [leadId, logout, navigate, resetDraft])

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
      const csrfToken = await fetchCsrfToken()
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
          event_type_id: eventTypeId ? Number(eventTypeId) : null,
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
      resetDraft(updated)
      setSaved(true)
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save this lead.')
    } finally {
      setSaving(false)
    }
  }

  const dirty = Boolean(lead) && (
    status !== lead?.status
    || notes !== (lead?.notes ?? '')
    || planDate !== lead?.plan_date
    || location !== (lead?.location ?? '')
    || packageId !== (lead?.package ? String(lead.package.id) : '')
    || eventTypeId !== (lead?.event_type_id ? String(lead.event_type_id) : '')
    || (Boolean(lead?.can_assign_sales) && salesPersonId !== (lead?.assigned_sales_person_id ? String(lead.assigned_sales_person_id) : ''))
  )

  function changeStatus(value: string) {
    const selected = statuses.find((option) => option.value === value)
    if (selected) {
      setStatus(selected.value)
      setSaved(false)
    }
  }

  // Leads won before the automation existed: create whatever is still missing.
  async function completeWonLead() {
    if (!leadId) return
    setCompleting(true)
    setError('')
    try {
      const csrfToken = await fetchCsrfToken()
      const response = await fetch(`${apiBaseUrl}/crm/sales/leads/${leadId}/convert/`, {
        method: 'POST', credentials: 'include',
        headers: { Accept: 'application/json', 'X-CSRFToken': csrfToken },
      })
      const body: unknown = await response.json()
      if (!response.ok) throw new Error(responseMessage(body))
      await loadLead(new AbortController().signal)
      setChatterKey((key) => key + 1)
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'We could not create the event.')
    } finally {
      setCompleting(false)
    }
  }

  const ribbon = lead?.status === 'won' ? { label: 'Won', tone: 'success' as const }
    : lead?.status === 'lost' ? { label: 'Lost', tone: 'danger' as const }
    : lead?.status === 'cancelled' ? { label: 'Cancelled', tone: 'danger' as const }
    : null
  const packageContents = lead?.package?.contents ?? []
  const eventId = lead?.event_id ?? null
  const invoiceIds = lead?.invoice_ids ?? []
  const projectIds = lead?.project_ids ?? []
  const missingWonRecords = lead?.status === 'won' && (!eventId || !projectIds.length)

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {loading && !lead && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
          {error && <section className="dashboard-message dashboard-message--error" role="alert"><div><strong>There’s a problem with this lead.</strong><p>{error}</p></div>{!lead && <button type="button" onClick={() => { const controller = new AbortController(); void loadLead(controller.signal) }}>Try again <span>↻</span></button>}</section>}
          {!lead && !loading && !error && <p className="dashboard-message"><Link to="/dashboard/leads">Back to leads</Link></p>}

          {lead && (
            <RecordFormView
              modelName="Lead"
              title={lead.customer.name}
              subtitle={`Inquiry received ${formatDate(lead.date)}`}
              recordId={lead.id}
              backHref="/dashboard/leads"
              backLabel="Leads"
              ribbon={ribbon}
              status={status}
              statusOptions={statuses}
              onStatusChange={changeStatus}
              actionSlot={<>
                {missingWonRecords && (
                  <button type="button" className="o-btn o-btn-primary" disabled={completing} onClick={() => void completeWonLead()}>
                    {completing ? 'Creating…' : 'Create event, invoice & project'}
                  </button>
                )}
                {eventId && (
                  <Link to={`/dashboard/invoices/new?event=${eventId}`} className="o-btn o-btn-secondary">New invoice</Link>
                )}
                {status === 'won' && lead.status !== 'won' && (
                  <span className="o-statusbar-hint">Saving will create the event, a deposit invoice and a project.</span>
                )}
                {!closedStatuses.includes(status) && (
                  <button type="button" className="o-btn o-btn-secondary" onClick={() => changeStatus('won')}>Mark won</button>
                )}
                {!closedStatuses.includes(status) && (
                  <button type="button" className="o-btn o-btn-secondary" onClick={() => changeStatus('lost')}>Mark lost</button>
                )}
                {closedStatuses.includes(status) && status !== lead.status && (
                  <button type="button" className="o-btn o-btn-secondary" onClick={() => changeStatus(lead.status)}>Undo</button>
                )}
              </>}
              headerAside={<>
                <div className="o-stat-button">
                  <span className="o-stat-icon" aria-hidden="true">✦</span>
                  <span><strong>{lead.guest_count ?? '—'}</strong><small>Guests</small></span>
                </div>
                <div className={`o-stat-button${eventId ? '' : ' is-muted'}`}>
                  <span className="o-stat-icon" aria-hidden="true">◈</span>
                  <span><strong>{eventId ? `#${eventId}` : 'None'}</strong><small>Event</small></span>
                </div>
                {invoiceIds.length > 0 && (
                  <Link to={invoiceIds.length === 1 ? `/dashboard/invoices/${invoiceIds[0]}` : '/dashboard/invoices'} className="o-stat-button">
                    <span className="o-stat-icon" aria-hidden="true">Br</span>
                    <span><strong>{invoiceIds.length}</strong><small>{invoiceIds.length === 1 ? 'Invoice' : 'Invoices'}</small></span>
                  </Link>
                )}
                {projectIds.length > 0 && (
                  <Link to={`/dashboard/projects/${projectIds[0]}`} className="o-stat-button">
                    <span className="o-stat-icon" aria-hidden="true">☰</span>
                    <span><strong>{projectIds.length}</strong><small>{projectIds.length === 1 ? 'Project' : 'Projects'}</small></span>
                  </Link>
                )}
              </>}
              headerFields={[
                { name: 'phone', label: 'Phone', value: lead.customer.phone, type: 'tel', readOnly: true },
                { name: 'plan_date', label: 'Event date', type: 'date', value: planDate, required: true },
                { name: 'plan', label: 'Event plan', value: lead.plan.name, readOnly: true },
                {
                  name: 'event_type_id', label: 'Event type', type: 'select', value: eventTypeId,
                  readOnly: !lead.plan.event_types.length,
                  placeholder: 'This plan has no event types yet',
                  options: [{ value: '', label: 'Select an occasion' }, ...lead.plan.event_types.map((item) => ({ value: String(item.id), label: item.name }))],
                },
                {
                  name: 'assigned_sales_person_id',
                  label: 'Sales person',
                  type: 'select',
                  value: salesPersonId,
                  displayValue: lead.can_assign_sales ? undefined : (lead.assigned_sales_person ?? ''),
                  placeholder: 'Unassigned',
                  readOnly: !lead.can_assign_sales,
                  options: [
                    { value: '', label: 'Unassigned' },
                    ...lead.available_sales_people.map((person) => ({ value: String(person.id), label: person.name })),
                  ],
                },
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
                { name: 'location', label: 'Venue', value: location, placeholder: 'To be confirmed' },
              ]}
              tabs={[
                {
                  id: 'celebration',
                  label: 'Celebration',
                  sections: [
                    {
                      title: 'From the inquiry',
                      fields: [
                        { name: 'guest_count', label: 'Estimated guests', value: lead.guest_count, readOnly: true },
                        { name: 'budget_tier', label: 'Budget range', value: lead.budget_tier, readOnly: true },
                      ],
                    },
                    {
                      title: 'Requirements',
                      fields: [
                        { name: 'requirements', label: 'Customer notes', value: lead.requirements, fullWidth: true, readOnly: true, placeholder: 'No special requirements shared.' },
                      ],
                    },
                  ],
                },
                {
                  id: 'notes',
                  label: 'Internal notes',
                  content: (
                    <textarea
                      className="o-input o-notes-editor"
                      aria-label="Internal notes"
                      value={notes}
                      onChange={(event) => { setNotes(event.target.value); setSaved(false) }}
                      placeholder="Add discussion notes or the next step…"
                    />
                  ),
                },
                {
                  id: 'package',
                  label: 'Package contents',
                  badge: packageContents.length || undefined,
                  content: packageContents.length ? (
                    <ul className="o-content-list">
                      {packageContents.map((item) => <li key={item.id}><strong>{item.name}</strong>{item.description && <span>{item.description}</span>}</li>)}
                    </ul>
                  ) : <p className="o-empty-page">{lead.package ? 'This package has no listed contents.' : 'Choose a package to see what it includes.'}</p>,
                },
              ]}
              onFieldChange={(name, value) => {
                setSaved(false)
                if (name === 'package_id') setPackageId(value)
                if (name === 'event_type_id') setEventTypeId(value)
                if (name === 'plan_date') setPlanDate(value)
                if (name === 'location') setLocation(value)
                if (name === 'assigned_sales_person_id') setSalesPersonId(value)
              }}
              onSubmit={saveLead}
              dirty={dirty}
              onDiscard={() => { resetDraft(lead); setError('') }}
              saving={saving}
              saved={saved}
              chatter={{ model: 'lead', recordId: lead.id, refreshKey: chatterKey }}
            />
          )}
        </div>
      </main>
    </div>
  )
}
