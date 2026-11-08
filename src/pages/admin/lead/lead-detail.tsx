import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessLink } from '@/components/admin/access-link'
import { can, useProfile } from '@/lib/use-profile'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { RecordFormView } from '@/components/admin/record-form-view'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { fetchCsrfToken } from '@/lib/csrf'
import { BUDGET_TIERS } from '@/lib/event-options'
import i18n, { leadStatusLabel } from '@/i18n'

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

const STATUS_VALUES: LeadStatus[] = ['lead', 'contacted', 'consultation_scheduled', 'quotation_sent', 'negotiation', 'won', 'lost', 'cancelled']
const FOLDED_STATUSES: LeadStatus[] = ['lost', 'cancelled']
const closedStatuses: LeadStatus[] = ['won', 'lost', 'cancelled']

/** Stored budget values are English; show the translated tier when it is one of ours. */
function budgetLabel(value: string) {
  const tier = BUDGET_TIERS.find((item) => item.value === value)
  return tier ? i18n.t(`budgetTiers.${tier.key}`) : value
}

function responseMessage(body: unknown) {
  const fallback = i18n.t('leads:detail.saveFailed')
  if (typeof body !== 'object' || body === null) return fallback
  if ('detail' in body && typeof body.detail === 'string') return body.detail
  if ('status' in body && Array.isArray(body.status)) return body.status.join(' ')
  return fallback
}

export function LeadDetailPage() {
  const { t } = useTranslation('leads')
  const { leadId } = useParams()
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const profile = useProfile()
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

  const statuses = STATUS_VALUES.map((value) => ({ value, label: leadStatusLabel(value), folded: FOLDED_STATUSES.includes(value) }))

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
      if (response.status === 404) throw new Error(i18n.t('leads:detail.gone'))
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
      setError(saveError instanceof Error ? saveError.message : t('detail.saveFailed'))
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
    if ((STATUS_VALUES as string[]).includes(value)) {
      setStatus(value as LeadStatus)
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
      setError(completeError instanceof Error ? completeError.message : t('record.createFailed'))
    } finally {
      setCompleting(false)
    }
  }

  const ribbon = lead?.status === 'won' ? { label: leadStatusLabel('won'), tone: 'success' as const }
    : lead?.status === 'lost' ? { label: leadStatusLabel('lost'), tone: 'danger' as const }
    : lead?.status === 'cancelled' ? { label: leadStatusLabel('cancelled'), tone: 'danger' as const }
    : null
  const packageContents = lead?.package?.contents ?? []
  const eventId = lead?.event_id ?? null
  const invoiceIds = lead?.invoice_ids ?? []
  const projectIds = lead?.project_ids ?? []
  const missingWonRecords = lead?.status === 'won' && (!eventId || !projectIds.length)

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Hadafe Nefs" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {loading && !lead && <div className="o-form-loading" role="status" aria-label={t('detail.loading')}><span /><span /><span /></div>}
          {error && <section className="dashboard-message dashboard-message--error" role="alert"><div><strong>{t('detail.problem')}</strong><p>{error}</p></div>{!lead && <button type="button" onClick={() => { const controller = new AbortController(); void loadLead(controller.signal) }}>{t('actions.retry', { ns: 'common' })} <span>↻</span></button>}</section>}
          {!lead && !loading && !error && <p className="dashboard-message"><Link to="/dashboard/leads">{t('detail.back')}</Link></p>}

          {lead && (
            <RecordFormView
              modelName={t('model')}
              title={lead.customer.name}
              subtitle={t('detail.received', { date: formatDualDate(lead.date) })}
              recordId={lead.id}
              backHref="/dashboard/leads"
              backLabel={t('detail.allLeads')}
              ribbon={ribbon}
              status={status}
              statusOptions={statuses}
              onStatusChange={changeStatus}
              actionSlot={<>
                {missingWonRecords && (
                  <button type="button" className="o-btn o-btn-primary" disabled={completing} onClick={() => void completeWonLead()}>
                    {completing ? t('form.creating') : t('record.createMissing')}
                  </button>
                )}
                {eventId && can(profile, 'invoices', 'create') && (
                  <Link to={`/dashboard/invoices/new?event=${eventId}`} className="o-btn o-btn-secondary">{t('record.newInvoice')}</Link>
                )}
                {status === 'won' && lead.status !== 'won' && (
                  <span className="o-statusbar-hint">{t('record.wonHint')}</span>
                )}
                {!closedStatuses.includes(status) && (
                  <button type="button" className="o-btn o-btn-secondary" onClick={() => changeStatus('won')}>{t('record.markWon')}</button>
                )}
                {!closedStatuses.includes(status) && (
                  <button type="button" className="o-btn o-btn-secondary" onClick={() => changeStatus('lost')}>{t('record.markLost')}</button>
                )}
                {closedStatuses.includes(status) && status !== lead.status && (
                  <button type="button" className="o-btn o-btn-secondary" onClick={() => changeStatus(lead.status)}>{t('record.undo')}</button>
                )}
              </>}
              headerAside={<>
                <div className="o-stat-button">
                  <span className="o-stat-icon" aria-hidden="true">✦</span>
                  <span><strong>{lead.guest_count ?? '—'}</strong><small>{t('form.guestsShort')}</small></span>
                </div>
                <div className={`o-stat-button${eventId ? '' : ' is-muted'}`}>
                  <span className="o-stat-icon" aria-hidden="true">◈</span>
                  <span><strong>{eventId ? `#${eventId}` : t('states.none', { ns: 'common' })}</strong><small>{t('record.event')}</small></span>
                </div>
                {invoiceIds.length > 0 && (
                  <AccessLink module="invoices" to={invoiceIds.length === 1 ? `/dashboard/invoices/${invoiceIds[0]}` : '/dashboard/invoices'} className="o-stat-button">
                    <span className="o-stat-icon" aria-hidden="true">Br</span>
                    <span><strong>{invoiceIds.length}</strong><small>{t('record.invoice', { count: invoiceIds.length })}</small></span>
                  </AccessLink>
                )}
                {projectIds.length > 0 && (
                  <AccessLink module="projects" to={`/dashboard/projects/${projectIds[0]}`} className="o-stat-button">
                    <span className="o-stat-icon" aria-hidden="true">☰</span>
                    <span><strong>{projectIds.length}</strong><small>{t('record.project', { count: projectIds.length })}</small></span>
                  </AccessLink>
                )}
              </>}
              headerFields={[
                { name: 'phone', label: t('form.phone'), value: lead.customer.phone, type: 'tel', readOnly: true },
                { name: 'plan_date', label: t('form.eventDate'), type: 'date', value: planDate, required: true },
                { name: 'plan', label: t('form.eventPlan'), value: lead.plan.name, readOnly: true },
                {
                  name: 'event_type_id', label: t('form.eventType'), type: 'select', value: eventTypeId,
                  readOnly: !lead.plan.event_types.length,
                  placeholder: t('form.noEventTypes'),
                  options: [{ value: '', label: t('form.selectOccasion') }, ...lead.plan.event_types.map((item) => ({ value: String(item.id), label: item.name }))],
                },
                {
                  name: 'assigned_sales_person_id',
                  label: t('form.salesPerson'),
                  type: 'select',
                  value: salesPersonId,
                  displayValue: lead.can_assign_sales ? undefined : (lead.assigned_sales_person ?? ''),
                  placeholder: t('form.unassigned'),
                  readOnly: !lead.can_assign_sales,
                  options: [
                    { value: '', label: t('form.unassigned') },
                    ...lead.available_sales_people.map((person) => ({ value: String(person.id), label: person.name })),
                  ],
                },
                {
                  name: 'package_id',
                  label: t('form.package'),
                  type: 'select',
                  value: packageId,
                  options: [
                    { value: '', label: t('detail.noPackage') },
                    ...lead.plan.packages.map((item) => ({ value: String(item.id), label: item.name })),
                  ],
                },
                { name: 'location', label: t('form.venue'), value: location, placeholder: t('form.toBeConfirmed') },
              ]}
              tabs={[
                {
                  id: 'celebration',
                  label: t('form.celebrationTab'),
                  sections: [
                    {
                      title: t('record.fromInquiry'),
                      fields: [
                        { name: 'guest_count', label: t('form.guests'), value: lead.guest_count, readOnly: true },
                        { name: 'budget_tier', label: t('form.budget'), value: budgetLabel(lead.budget_tier), readOnly: true },
                      ],
                    },
                    {
                      title: t('form.requirements'),
                      fields: [
                        { name: 'requirements', label: t('form.customerNotes'), value: lead.requirements, fullWidth: true, readOnly: true, placeholder: t('record.noRequirements') },
                      ],
                    },
                  ],
                },
                {
                  id: 'notes',
                  label: t('form.internalNotes'),
                  content: (
                    <textarea
                      className="o-input o-notes-editor"
                      aria-label={t('form.internalNotes')}
                      value={notes}
                      onChange={(event) => { setNotes(event.target.value); setSaved(false) }}
                      placeholder={t('detail.notesPlaceholder')}
                    />
                  ),
                },
                {
                  id: 'package',
                  label: t('record.packageContents'),
                  badge: packageContents.length || undefined,
                  content: packageContents.length ? (
                    <ul className="o-content-list">
                      {packageContents.map((item) => <li key={item.id}><strong>{item.name}</strong>{item.description && <span>{item.description}</span>}</li>)}
                    </ul>
                  ) : <p className="o-empty-page">{lead.package ? t('record.noContents') : t('record.choosePackage')}</p>,
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
