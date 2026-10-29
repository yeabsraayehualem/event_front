import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { adminNavigationItems } from '@/components/admin-navigation'
import { SideNav } from '@/components/side-nav'
import { RecordFormView } from '@/components/admin/record-form-view'
import { apiBaseUrl } from '@/lib/api'
import { fetchCsrfToken } from '@/lib/csrf'
import { getErrorMessage } from '@/lib/api-errors'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import {
  InvoiceLinesEditor, invalidInvoiceLines, invoiceLinesPayload, newInvoiceLine,
  type ContentOption, type EditableLine, type TaxProfile,
} from './invoice-lines-editor'

export type EventOption = {
  id: number
  name: string
  customer: string
  event_date: string
  plan: string
  package: string | null
}

const fieldLabels = { event_id: 'Event', due_date: 'Due date', milestone_name: 'Milestone' }

export function InvoiceNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState<EventOption[] | null>(null)
  const [contents, setContents] = useState<ContentOption[]>([])
  const [taxProfiles, setTaxProfiles] = useState<TaxProfile[]>([])
  const [eventId, setEventId] = useState(searchParams.get('event') ?? '')
  const [milestone, setMilestone] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [lines, setLines] = useState<EditableLine[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const request = (path: string) => fetch(`${apiBaseUrl}${path}`, { credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' } })
    Promise.all([request('/event/events/'), request('/finance/invoice-editor-options/')])
      .then(async ([eventsResponse, optionsResponse]) => {
        const [eventsBody, optionsBody] = await Promise.all([eventsResponse.json(), optionsResponse.json()])
        if (eventsResponse.status === 401) { navigate('/login', { replace: true }); return }
        if (!eventsResponse.ok) throw new Error(getErrorMessage(eventsBody, 'Could not load events.'))
        if (!optionsResponse.ok) throw new Error(getErrorMessage(optionsBody, 'Could not load services and taxes.'))
        const loadedContents: ContentOption[] = optionsBody.contents ?? []
        setEvents(eventsBody as EventOption[])
        setContents(loadedContents)
        setTaxProfiles(optionsBody.tax_profiles ?? [])
        setLines([newInvoiceLine(loadedContents)])
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
      })
    return () => controller.abort()
  }, [navigate])

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const linesError = invalidInvoiceLines(lines)
    if (!eventId || linesError) {
      setError(eventId ? linesError : 'Choose the event this invoice is for.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const csrfToken = await fetchCsrfToken()
      const response = await fetch(`${apiBaseUrl}/finance/invoices/`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({
          event_id: Number(eventId),
          milestone_name: milestone,
          due_date: dueDate || null,
          lines: invoiceLinesPayload(lines),
        }),
      })
      const body: unknown = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(body, 'Could not create this invoice.', fieldLabels))
      navigate(`/dashboard/invoices/${(body as { id: number }).id}`, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create this invoice.')
      setSaving(false)
    }
  }

  const selectedEvent = events?.find((item) => String(item.id) === eventId)

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
          {!events && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

          {events && (
            <RecordFormView
              modelName="Invoice"
              title=""
              subtitle={selectedEvent ? selectedEvent.customer : 'The reference is assigned when you save.'}
              backHref="/dashboard/invoices"
              backLabel="Invoices"
              headerFields={[
                {
                  name: 'event_id', label: 'Event', type: 'select', value: eventId, required: true,
                  helpText: events.length ? undefined : 'No events yet — convert a won lead into an event first.',
                  options: [
                    { value: '', label: 'Choose an event' },
                    ...events.map((item) => ({ value: String(item.id), label: `${item.name} · ${formatDualDate(item.event_date)}` })),
                  ],
                },
                { name: 'due_date', label: 'Due date', type: 'date', value: dueDate },
                { name: 'customer', label: 'Customer', value: selectedEvent?.customer ?? '', readOnly: true, placeholder: 'From the event' },
                { name: 'milestone', label: 'Milestone', value: milestone, placeholder: 'e.g. Deposit' },
                { name: 'plan', label: 'Plan', value: selectedEvent?.plan ?? '', readOnly: true, placeholder: 'From the event' },
                { name: 'package', label: 'Package', value: selectedEvent?.package ?? '', readOnly: true, placeholder: selectedEvent ? 'No package' : 'From the event' },
              ]}
              onFieldChange={(name, value) => {
                if (name === 'event_id') setEventId(value)
                if (name === 'due_date') setDueDate(value)
                if (name === 'milestone') setMilestone(value)
              }}
              tabs={[{
                id: 'lines',
                label: 'Invoice lines',
                badge: lines.length,
                content: (
                  <>
                    <InvoiceLinesEditor lines={lines} setLines={setLines} contents={contents} taxProfiles={taxProfiles} />
                    <p className="o-form-hint">Taxes and the total are calculated when you save.</p>
                  </>
                ),
              }]}
              onSubmit={(event) => void createInvoice(event)}
              onDiscard={() => navigate('/dashboard/invoices')}
              saving={saving}
              submittingLabel="Creating…"
            />
          )}
        </div>
      </main>
    </div>
  )
}
