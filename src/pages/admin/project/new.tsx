import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { adminNavigationItems } from '@/components/admin-navigation'
import { SideNav } from '@/components/side-nav'
import { RecordFormView } from '@/components/admin/record-form-view'
import { apiBaseUrl } from '@/lib/api'
import { fetchCsrfToken } from '@/lib/csrf'
import { getErrorMessage } from '@/lib/api-errors'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import type { EventOption } from '@/pages/admin/invoices/invoice-new'

type User = { id: number; first_name: string; last_name: string }


function fullName(user: User) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || i18n.t('projects:form.userFallback', { id: user.id })
}

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function ProjectNew() {
  const navigate = useNavigate()
  const { t } = useTranslation('projects')
  const fieldLabels = { name: t('form.name'), event: t('form.event'), lead: t('form.lead'), start_date: t('form.startDate'), end_date: t('form.endDate') }
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState<EventOption[] | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [draft, setDraft] = useState({
    name: '', event: searchParams.get('event') ?? '', lead: '', start_date: todayIso(), end_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const request = (path: string) => fetch(`${apiBaseUrl}${path}`, { credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' } })
    Promise.all([request('/event/events/'), request('/event/project-assignees/')])
      .then(async ([eventsResponse, usersResponse]) => {
        const [eventsBody, usersBody] = await Promise.all([eventsResponse.json(), usersResponse.json()])
        if (eventsResponse.status === 401) { navigate('/login', { replace: true }); return }
        if (!eventsResponse.ok) throw new Error(getErrorMessage(eventsBody, t('form.loadEvents')))
        if (!usersResponse.ok) throw new Error(getErrorMessage(usersBody, t('form.loadTeam')))
        const loadedEvents = eventsBody as EventOption[]
        setEvents(loadedEvents)
        setUsers(usersBody as User[])
        setDraft((current) => {
          const preselected = loadedEvents.find((item) => String(item.id) === current.event)
          return preselected
            ? { ...current, name: current.name || t('form.defaultName', { event: preselected.name }), end_date: current.end_date || preselected.event_date }
            : current
        })
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
      })
    return () => controller.abort()
  }, [navigate, t])

  const selectedEvent = events?.find((item) => String(item.id) === draft.event)

  function update(name: string, value: string) {
    setDraft((current) => {
      const next = { ...current, [name]: value }
      // Picking an event suggests a name and an end date on the event day, without overwriting edits.
      if (name === 'event') {
        const picked = events?.find((item) => String(item.id) === value)
        if (picked && !current.name.trim()) next.name = t('form.defaultName', { event: picked.name })
        if (picked && !current.end_date) next.end_date = picked.event_date
      }
      return next
    })
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draft.end_date && draft.start_date && draft.end_date < draft.start_date) {
      setError(t('form.endBeforeStart'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const csrfToken = await fetchCsrfToken()
      const response = await fetch(`${apiBaseUrl}/event/projects/`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({
          name: draft.name.trim(),
          event: Number(draft.event),
          lead: Number(draft.lead),
          start_date: draft.start_date,
          end_date: draft.end_date,
          status: 'draft',
        }),
      })
      const body: unknown = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(body, t('form.createFailed'), fieldLabels))
      navigate(`/dashboard/projects/${(body as { id: number }).id}`, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('form.createFailed'))
      setSaving(false)
    }
  }

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
              title={draft.name}
              subtitle={selectedEvent ? `${selectedEvent.customer} · ${formatDualDate(selectedEvent.event_date)}` : t('form.subtitle')}
              backHref="/dashboard/projects"
              backLabel={t('form.backProjects')}
              headerFields={[
                { name: 'name', label: t('form.name'), value: draft.name, required: true, placeholder: t('form.namePlaceholder'), fullWidth: true },
                {
                  name: 'event', label: t('form.event'), type: 'select', value: draft.event, required: true,
                  helpText: events.length ? undefined : t('form.noEvents'),
                  options: [{ value: '', label: t('form.chooseEvent') }, ...events.map((item) => ({ value: String(item.id), label: item.name }))],
                },
                { name: 'start_date', label: t('form.startDate'), type: 'date', value: draft.start_date, required: true },
                {
                  name: 'lead', label: t('form.lead'), type: 'select', value: draft.lead, required: true,
                  options: [{ value: '', label: t('form.choosePerson') }, ...users.map((user) => ({ value: String(user.id), label: fullName(user) }))],
                },
                { name: 'end_date', label: t('form.endDate'), type: 'date', value: draft.end_date, required: true, helpText: selectedEvent ? t('form.endHelp') : undefined },
              ]}
              tabs={[{
                id: 'tasks',
                label: t('form.tasksTab'),
                content: <p className="o-empty-page">{t('form.saveFirst')}</p>,
              }]}
              onFieldChange={update}
              onSubmit={(event) => void createProject(event)}
              onDiscard={() => navigate('/dashboard/projects')}
              saving={saving}
              submittingLabel={t('form.creating')}
            />
          )}
        </div>
      </main>
    </div>
  )
}
