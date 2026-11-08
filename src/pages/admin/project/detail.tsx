import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import i18n from '@/i18n'
import { adminNavigationItems } from '@/components/admin-navigation'
import { SideNav } from '@/components/side-nav'
import { apiBaseUrl } from '@/lib/api'
import { fetchCsrfToken } from '@/lib/csrf'
import { RecordFormView } from '@/components/admin/record-form-view'
import { Many2ManyTags } from '@/components/admin/many2many-tags'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'

type User = { id: number; first_name: string; last_name: string }
type Task = {
  id: number
  name: string
  assignees: User[]
  start_date: string
  end_date: string
  status: string
}
type Project = {
  id: number
  name: string
  event: number
  event_name: string
  lead: User
  lead_name: string
  start_date: string
  end_date: string
  status: string
  tasks: Task[]
}
type TaskDraft = { name: string; start_date: string; end_date: string; status: string; assignee_ids: number[] }
const TASK_STATUSES = ['na', 'assigned', 'ongoing', 'complete', 'blocked'] as const
const PROJECT_STATUSES = ['draft', 'inprogress', 'done'] as const
const emptyTask: TaskDraft = { name: '', start_date: '', end_date: '', status: 'na', assignee_ids: [] }

function fullName(user: User | null | undefined) {
  return user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || i18n.t('projects:form.userFallback', { id: user.id }) : ''
}

function draftFromTask(task: Task): TaskDraft {
  return {
    name: task.name,
    start_date: task.start_date,
    end_date: task.end_date,
    status: task.status,
    assignee_ids: task.assignees.map((assignee) => assignee.id),
  }
}

function sameDraft(a: TaskDraft, b: TaskDraft) {
  return a.name === b.name && a.start_date === b.start_date && a.end_date === b.end_date && a.status === b.status
    && [...a.assignee_ids].sort().join() === [...b.assignee_ids].sort().join()
}

function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null) {
    const values = data as Record<string, unknown>
    if (typeof values.detail === 'string') return values.detail
    if (typeof values.message === 'string') return values.message
    return Object.entries(values).map(([field, message]) =>
      `${field}: ${Array.isArray(message) ? message.join(', ') : String(message)}`,
    ).join(' · ')
  }
  return fallback
}

function invalidTask(draft: TaskDraft) {
  return !draft.name.trim() || !draft.start_date || !draft.end_date || draft.end_date < draft.start_date
}

export function ProjectDetail() {
  const { t } = useTranslation('projects')
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [assigneeOptions, setAssigneeOptions] = useState<User[]>([])
  const [taskDrafts, setTaskDrafts] = useState<Record<number, TaskDraft>>({})
  const [newTask, setNewTask] = useState<TaskDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [chatterKey, setChatterKey] = useState(0)

  useEffect(() => {
    if (!id) {
      setError(i18n.t('projects:detail.missingId'))
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const loadProject = async () => {
      setLoading(true)
      setError('')
      try {
        const [projectResponse, assigneesResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/event/projects/${id}/`, { credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' } }),
          fetch(`${apiBaseUrl}/event/project-assignees/`, { credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' } }),
        ])
        const [projectData, assigneesData] = await Promise.all([projectResponse.json(), assigneesResponse.json()])
        if (!projectResponse.ok) throw new Error(getErrorMessage(projectData, i18n.t('projects:detail.loadFailed')))
        if (!assigneesResponse.ok) throw new Error(getErrorMessage(assigneesData, i18n.t('projects:detail.loadAssignees')))
        const loadedProject = projectData as Project
        setProject(loadedProject)
        setAssigneeOptions(assigneesData as User[])
        setTaskDrafts(Object.fromEntries(loadedProject.tasks.map((task) => [task.id, draftFromTask(task)])))
      } catch (loadError) {
        // Leaving the page (or React's dev double-mount) aborts the request; that is not an error.
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : i18n.t('projects:detail.loadFailed'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadProject()
    return () => controller.abort()
  }, [id])

  const requestWithCsrf = async (url: string, method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
    const csrfToken = await fetchCsrfToken()
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(getErrorMessage(data, t('detail.saveFailed')))
    return data
  }

  // Like Odoo, clicking a stage in the status bar saves it straight away.
  const saveProjectStatus = async (status: string) => {
    if (!id || !project || status === project.status) return
    setSaving(true); setError(''); setNotice('')
    try {
      const saved = await requestWithCsrf(`${apiBaseUrl}/event/projects/${id}/`, 'PATCH', { status })
      setProject({ ...project, status: saved.status })
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('detail.statusFailed'))
    } finally { setSaving(false) }
  }

  const saveTask = async (taskId: number) => {
    if (!id) return
    const draft = taskDrafts[taskId]
    if (!draft || invalidTask(draft)) {
      setError(t('detail.taskInvalid'))
      return
    }
    setSavingTaskId(taskId); setError(''); setNotice('')
    try {
      const saved = await requestWithCsrf(`${apiBaseUrl}/event/projects/${id}/tasks/${taskId}/`, 'PATCH', draft) as Task
      setProject((current) => current ? { ...current, tasks: current.tasks.map((task) => task.id === taskId ? saved : task) } : current)
      setTaskDrafts((current) => ({ ...current, [taskId]: draftFromTask(saved) }))
      setNotice(t('record.taskSavedNamed', { name: saved.name }))
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('detail.taskFailed'))
    } finally { setSavingTaskId(null) }
  }

  const addTask = async () => {
    if (!id || !newTask) return
    if (invalidTask(newTask)) {
      setError(t('detail.taskInvalid'))
      return
    }
    setCreatingTask(true); setError(''); setNotice('')
    try {
      const created = await requestWithCsrf(`${apiBaseUrl}/event/projects/${id}/tasks/`, 'POST', newTask) as Task
      setProject((current) => current ? { ...current, tasks: [...current.tasks, created] } : current)
      setTaskDrafts((current) => ({ ...current, [created.id]: draftFromTask(created) }))
      setNewTask(null)
      setNotice(t('record.taskAddedNamed', { name: created.name }))
      setChatterKey((key) => key + 1)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('detail.taskAddFailed'))
    } finally { setCreatingTask(false) }
  }

  const updateTaskDraft = (taskId: number, updates: Partial<TaskDraft>) => {
    setTaskDrafts((current) => ({ ...current, [taskId]: { ...current[taskId], ...updates } }))
  }

  const taskCounts = useMemo(() => {
    const counts = { total: project?.tasks.length ?? 0, complete: 0, inProgress: 0, blocked: 0 }
    for (const task of project?.tasks ?? []) {
      if (task.status === 'complete') counts.complete += 1
      if (task.status === 'ongoing' || task.status === 'assigned') counts.inProgress += 1
      if (task.status === 'blocked') counts.blocked += 1
    }
    return counts
  }, [project])
  const progress = taskCounts.total ? Math.round((taskCounts.complete / taskCounts.total) * 100) : 0
  const userOptions = assigneeOptions.map((user) => ({ id: user.id, label: fullName(user) }))
  const projectStatuses = PROJECT_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))

  const taskRow = (draft: TaskDraft, update: (changes: Partial<TaskDraft>) => void, name: string) => (
    <>
      <td><input className="o-input" aria-label={t('detail.taskNameFor', { name })} value={draft.name} placeholder={t('detail.taskName')} onChange={(event) => update({ name: event.target.value })} /></td>
      <td><Many2ManyTags aria-label={t('detail.assigneesFor', { name })} options={userOptions} value={draft.assignee_ids} onChange={(ids) => update({ assignee_ids: ids })} placeholder={t('record.assign')} /></td>
      <td><EthiopianDateInput aria-label={t('detail.startFor', { name })} value={draft.start_date} max={draft.end_date || undefined} onChange={(iso) => update({ start_date: iso })} showChurchDays={false} /></td>
      <td><EthiopianDateInput aria-label={t('detail.endFor', { name })} value={draft.end_date} min={draft.start_date || undefined} onChange={(iso) => update({ end_date: iso })} showChurchDays={false} /></td>
      <td>
        <select className={`o-input o-status-select o-status-select--${draft.status}`} aria-label={t('detail.statusFor', { name })} value={draft.status} onChange={(event) => update({ status: event.target.value })}>
          {TASK_STATUSES.map((status) => <option key={status} value={status}>{t(`taskStatus.${status}`)}</option>)}
        </select>
      </td>
    </>
  )

  const tasksPage = (
    <>
      {notice && <p className="o-inline-notice" role="status">{notice}</p>}
      <div className="o-list-wrap">
        <table className="o-list">
          <thead><tr>
            <th scope="col">{t('detail.task')}</th>
            <th scope="col">{t('detail.assignees')}</th>
            <th scope="col">{t('record.start')}</th>
            <th scope="col">{t('record.end')}</th>
            <th scope="col">{t('detail.status')}</th>
            <th scope="col" className="o-list-actions"><span className="sr-only">{t('record.actions')}</span></th>
          </tr></thead>
          <tbody>
            {project?.tasks.map((task) => {
              const draft = taskDrafts[task.id] ?? draftFromTask(task)
              const changed = !sameDraft(draft, draftFromTask(task))
              return (
                <tr key={task.id} className={changed ? 'is-dirty' : ''}>
                  {taskRow(draft, (changes) => updateTaskDraft(task.id, changes), task.name)}
                  <td className="o-list-actions">
                    {changed && <>
                      <button type="button" className="o-btn o-btn-primary o-btn-sm" disabled={savingTaskId === task.id} onClick={() => void saveTask(task.id)}>{savingTaskId === task.id ? t('detail.saving') : t('detail.saveTask')}</button>
                      <button type="button" className="o-btn o-btn-link o-btn-sm" onClick={() => updateTaskDraft(task.id, draftFromTask(task))} aria-label={t('record.discardFor', { name: task.name })}>↺</button>
                    </>}
                  </td>
                </tr>
              )
            })}
            {newTask && (
              <tr className="is-new">
                {taskRow(newTask, (changes) => setNewTask((current) => current ? { ...current, ...changes } : current), t('record.newTask'))}
                <td className="o-list-actions">
                  <button type="button" className="o-btn o-btn-primary o-btn-sm" disabled={creatingTask} onClick={() => void addTask()}>{creatingTask ? t('detail.adding') : t('record.add')}</button>
                  <button type="button" className="o-btn o-btn-link o-btn-sm" onClick={() => setNewTask(null)} aria-label={t('record.cancelNew')}>×</button>
                </td>
              </tr>
            )}
            {!project?.tasks.length && !newTask && (
              <tr><td colSpan={6} className="o-list-empty">{t('record.noTasks')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!newTask && <button type="button" className="o-list-add" onClick={() => setNewTask({ ...emptyTask })}>{t('record.addLine')}</button>}
    </>
  )

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Hadafe Nefs" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {loading && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
          {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}

          {project && (
            <RecordFormView
              modelName={t('model')}
              title={project.name}
              subtitle={project.event_name}
              recordId={project.id}
              backHref="/dashboard/projects"
              backLabel={t('detail.allProjects')}
              ribbon={project.status === 'done' ? { label: t('status.done'), tone: 'success' } : null}
              status={project.status}
              statusOptions={projectStatuses}
              onStatusChange={(value) => void saveProjectStatus(value)}
              actionSlot={<button type="button" className="o-btn o-btn-secondary" onClick={() => window.print()}>{t('detail.exportPdf')}</button>}
              toolbarAside={saving ? <span className="o-saved-hint">{t('detail.saving')}</span> : null}
              headerAside={<>
                <div className="o-stat-button">
                  <span className="o-stat-icon" aria-hidden="true">☰</span>
                  <span><strong>{taskCounts.total}</strong><small>{t('record.tasks')}</small></span>
                </div>
                <div className="o-stat-button">
                  <span className="o-progress-ring" style={{ '--progress': `${progress}%` } as CSSProperties} aria-hidden="true" />
                  <span><strong>{progress}%</strong><small>{t('record.complete')}</small></span>
                </div>
                {taskCounts.blocked > 0 && (
                  <div className="o-stat-button is-danger">
                    <span className="o-stat-icon" aria-hidden="true">!</span>
                    <span><strong>{taskCounts.blocked}</strong><small>{t('record.blocked')}</small></span>
                  </div>
                )}
              </>}
              headerFields={[
                { name: 'event_name', label: t('form.event'), value: project.event_name, readOnly: true },
                { name: 'start_date', label: t('form.startDate'), type: 'date', value: project.start_date, readOnly: true },
                { name: 'lead_name', label: t('form.lead'), value: fullName(project.lead), readOnly: true },
                { name: 'end_date', label: t('form.endDate'), type: 'date', value: project.end_date, readOnly: true },
              ]}
              tabs={[
                { id: 'tasks', label: t('form.tasksTab'), badge: taskCounts.total, content: tasksPage },
              ]}
              chatter={{ model: 'project', recordId: project.id, refreshKey: chatterKey }}
            />
          )}
        </div>
      </main>
    </div>
  )
}
