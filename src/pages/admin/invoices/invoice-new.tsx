import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
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


export function InvoiceNewPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('invoices')
  const fieldLabels = { event_id: t('form.event'), due_date: t('form.dueDate'), milestone_name: t('form.milestone') }
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
        if (!eventsResponse.ok) throw new Error(getErrorMessage(eventsBody, t('form.loadEvents')))
        if (!optionsResponse.ok) throw new Error(getErrorMessage(optionsBody, t('form.loadOptions')))
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
  }, [navigate, t])

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const linesError = invalidInvoiceLines(lines)
    if (!eventId || linesError) {
      setError(eventId ? linesError : t('form.chooseEventFirst'))
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
      if (!response.ok) throw new Error(getErrorMessage(body, t('form.createFailed'), fieldLabels))
      navigate(`/dashboard/invoices/${(body as { id: number }).id}`, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('form.createFailed'))
      setSaving(false)
    }
  }

  const selectedEvent = events?.find((item) => String(item.id) === eventId)

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Hadafe Nefs" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
          {!events && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

          {events && (
            <RecordFormView
              modelName={t('model')}
              title=""
              subtitle={selectedEvent ? selectedEvent.customer : t('form.referenceLater')}
              backHref="/dashboard/invoices"
              backLabel={t('form.backInvoices')}
              headerFields={[
                {
                  name: 'event_id', label: t('form.event'), type: 'select', value: eventId, required: true,
                  helpText: events.length ? undefined : t('form.noEvents'),
                  options: [
                    { value: '', label: t('form.chooseEvent') },
                    ...events.map((item) => ({ value: String(item.id), label: `${item.name} · ${formatDualDate(item.event_date)}` })),
                  ],
                },
                { name: 'due_date', label: t('form.dueDate'), type: 'date', value: dueDate },
                { name: 'customer', label: t('form.customer'), value: selectedEvent?.customer ?? '', readOnly: true, placeholder: t('form.fromEvent') },
                { name: 'milestone', label: t('form.milestone'), value: milestone, placeholder: t('form.milestonePlaceholder') },
                { name: 'plan', label: t('form.plan'), value: selectedEvent?.plan ?? '', readOnly: true, placeholder: t('form.fromEvent') },
                { name: 'package', label: t('form.package'), value: selectedEvent?.package ?? '', readOnly: true, placeholder: selectedEvent ? t('form.noPackage') : t('form.fromEvent') },
              ]}
              onFieldChange={(name, value) => {
                if (name === 'event_id') setEventId(value)
                if (name === 'due_date') setDueDate(value)
                if (name === 'milestone') setMilestone(value)
              }}
              tabs={[{
                id: 'lines',
                label: t('form.linesTab'),
                badge: lines.length,
                content: (
                  <>
                    <InvoiceLinesEditor lines={lines} setLines={setLines} contents={contents} taxProfiles={taxProfiles} />
                    <p className="o-form-hint">{t('form.taxesOnSave')}</p>
                  </>
                ),
              }]}
              onSubmit={(event) => void createInvoice(event)}
              onDiscard={() => navigate('/dashboard/invoices')}
              saving={saving}
              submittingLabel={t('form.creating')}
            />
          )}
        </div>
      </main>
    </div>
  )
}
