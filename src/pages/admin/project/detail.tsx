import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { adminNavigationItems } from '@/components/admin-navigation'
import { SideNav } from '@/components/side-nav'
import { apiBaseUrl } from '@/lib/api'
import { RecordFormView } from '@/components/admin/record-form-view'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { formatDualDate } from '@/lib/ethiopian-calendar'

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
type TaskStatus = 'na' | 'assigned' | 'ongoing' | 'complete' | 'blocked'
const taskStatuses: TaskStatus[] = ['na', 'assigned', 'ongoing', 'complete', 'blocked']
const projectStatuses = ['draft', 'inprogress', 'done'] as const

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  return formatDualDate(value)
}

function fullName(user: User | null | undefined) {
  return user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || '—' : '—'
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
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

type HeaderField = {
  name: string
  label: string
  value: string
  readOnly?: boolean
}

type Section = {
  title: string
  description?: string
  fields: Array<{
    name: string
    label: string
    value?: string
    readOnly?: boolean
    type?: 'text' | 'date' | 'select'
    placeholder?: string
    fullWidth?: boolean
    options?: { value: string; label: string }[]
  }>
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [assigneeOptions, setAssigneeOptions] = useState<User[]>([])
  const [taskDrafts, setTaskDrafts] = useState<Record<number, TaskDraft>>({})
  const [projectStatus, setProjectStatus] = useState('draft')
  const [newTask, setNewTask] = useState<TaskDraft>({ name: '', start_date: '', end_date: '', status: 'na', assignee_ids: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadProject = async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const [projectResponse, assigneesResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/event/projects/${String(id)}/`, { credentials: 'include', signal, headers: { Accept: 'application/json' } }),
        fetch(`${apiBaseUrl}/event/project-assignees/`, { credentials: 'include', signal, headers: { Accept: 'application/json' } }),
      ])
      const [projectData, assigneesData] = await Promise.all([projectResponse.json(), assigneesResponse.json()])
      if (!projectResponse.ok) throw new Error(getErrorMessage(projectData, 'Could not load this project.'))
      if (!assigneesResponse.ok) throw new Error(getErrorMessage(assigneesData, 'Could not load task assignees.'))
      const loadedProject = projectData as Project
      setProject(loadedProject)
      setProjectStatus(loadedProject.status)
      setAssigneeOptions(assigneesData as User[])
      setTaskDrafts(Object.fromEntries(loadedProject.tasks.map((task) => [task.id, {
        name: task.name,
        start_date: task.start_date,
        end_date: task.end_date,
        status: task.status,
        assignee_ids: task.assignees.map((assignee) => assignee.id),
      }])))
  } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this project.')
    } finally {
    }
  }

  useEffect(() => {
    if (!id) {
      setError('Project number is missing from the page address.')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    void loadProject(controller.signal)
    return () => controller.abort()
  }, [id])

  const requestWithCsrf = async (url: string, method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
    const csrfResponse = await fetch(`${apiBaseUrl}/user/csrf/`, { credentials: 'include', headers: { Accept: 'application/json' } })
    const csrfData = await csrfResponse.json()
    if (!csrfResponse.ok || typeof csrfData.csrf_token !== 'string') throw new Error('Could not prepare a secure save. Reload the page and try again.')
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfData.csrf_token },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(getErrorMessage(data, 'Could not save this project.'))
    return data
  }

  const saveProjectStatus = async () => {
    if (!id || !project) return
    setSaving(true); setError(''); setNotice('')
    try {
      const saved = await requestWithCsrf(`${apiBaseUrl}/event/projects/${String(id)}/`, 'PATCH', { status: projectStatus })
      setProject({ ...project, status: saved.status })
      setNotice('Project status saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save project status.')
    } finally { setSaving(false) }
  }

  const saveTask = async (taskId: number) => {
    if (!id) return
    const draft = taskDrafts[taskId]
    if (!draft || !draft.name.trim() || !draft.start_date || !draft.end_date || draft.end_date < draft.start_date) {
      setError('Enter a task name and valid start and end dates. The end date must be on or after the start date.')
      return
    }
    setSavingTaskId(taskId); setError(''); setNotice('')
    try {
      const saved = await requestWithCsrf(`${apiBaseUrl}/event/projects/${String(id)}/tasks/${taskId}/`, 'PATCH', draft)
      setProject((current) => current ? { ...current, tasks: current.tasks.map((task) => task.id === taskId ? saved as Task : task) } : current)
      setNotice('Task saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this task.')
    } finally { setSavingTaskId(null) }
  }

  const addTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || !newTask.name.trim() || !newTask.start_date || !newTask.end_date || newTask.end_date < newTask.start_date) {
      setError('Enter a task name and valid start and end dates. The end date must be on or after the start date.')
      return
    }
    setCreatingTask(true); setError(''); setNotice('')
    try {
      const created = await requestWithCsrf(`${apiBaseUrl}/event/projects/${String(id)}/tasks/`, 'POST', newTask) as Task
      setProject((current) => current ? { ...current, tasks: [...current.tasks, created] } : current)
      setTaskDrafts((current) => ({ ...current, [created.id]: {
        name: created.name, start_date: created.start_date, end_date: created.end_date,
        status: created.status, assignee_ids: created.assignees.map((assignee) => assignee.id),
      } }))
      setNewTask({ name: '', start_date: '', end_date: '', status: 'na', assignee_ids: [] })
      setNotice('Task added.')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not add this task.')
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

  const header_fields: HeaderField[] = [
    { name: 'name', label: 'Project name', value: project?.name ?? '', readOnly: true },
    { name: 'event_name', label: 'Event', value: project?.event_name ?? '', readOnly: true },
    { name: 'lead_name', label: 'Project lead', value: fullName(project?.lead), readOnly: true },
    { name: 'start_date', label: 'Start date', value: formatDate(project?.start_date), readOnly: true },
    { name: 'end_date', label: 'End date', value: formatDate(project?.end_date), readOnly: true },
    { name: 'status', label: 'Project status', value: humanize(project?.status ?? ''), readOnly: true },
  ]

  const sections: Section[] = [{
    title: 'Task progress',
    description: 'Tasks assigned to this project.',
    fields: [
      { name: 'task_counts', label: 'Task counts', value: `${taskCounts.total} total · ${taskCounts.complete} complete · ${taskCounts.inProgress} in progress${taskCounts.blocked > 0 ? ` · ${taskCounts.blocked} blocked` : ''}`, readOnly: true, fullWidth: true },
    ],
  }]

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <RecordFormView
            modelName="Project"
            title={project?.name ?? ''}
            subtitle={`${fullName(project?.lead)} · ${project?.event_name ?? 'Event project'}`}
            recordId={project?.id}
            backHref="/dashboard/projects"
            backLabel="All projects"
            status={projectStatus}
            statusOptions={projectStatuses.map((status) => ({ value: status, label: humanize(status) }))}
            onStatusChange={(value) => { setProjectStatus(value); void saveProjectStatus(); }}
            headerFields={header_fields}
            sections={sections}
            actionSlot={
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => window.print()} className="invoice-export-action min-h-10 rounded-lg border border-[#d8cba8] bg-white px-5 text-sm font-medium text-[#53614a] transition-colors hover:bg-[#f7f1e2]">Export PDF</button>
                <button type="button" onClick={() => void saveProjectStatus()} disabled={saving || projectStatus === project?.status} className="invoice-primary-action min-h-10 rounded-lg bg-[#28513c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1d3d2c] disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
              </div>
            }
            toolbarAside={
              <div className="flex flex-wrap items-center justify-between gap-4">
                {!loading && project && (
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => window.print()} className="invoice-export-action min-h-10 rounded-lg border border-[#d8cba8] bg-white px-5 text-sm font-medium text-[#53614a] transition-colors hover:bg-[#f7f1e2]">Export PDF</button>
                    <button type="button" onClick={() => void saveProjectStatus()} disabled={saving || projectStatus === project.status} className="invoice-primary-action min-h-10 rounded-lg bg-[#28513c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1d3d2c] disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
                  </div>
                )}
              </div>
            }
            headerAside={
              <div className="rounded-xl border border-[#e5e1d6] bg-white px-5 py-3 text-right shadow-sm">
                <p className="text-xs text-[#77766c]">Current status</p>
                <p className="mt-1 text-xl font-semibold text-[#294635]">{project ? humanize(project.status) : '—'}</p>
              </div>
            }
           


            
            onFieldChange={(name, value) => {
              if (name === 'name') setProject((current) => current ? { ...current, name: value } : current)
              if (name === 'event_name') setProject((current) => current ? { ...current, event_name: value } : current)
              if (name === 'lead_name') setProject((current) => current ? { ...current, lead_name: value } : current)
              if (name === 'start_date') setProject((current) => current ? { ...current, start_date: value } : current)
              if (name === 'end_date') setProject((current) => current ? { ...current, end_date: value } : current)
              if (name === 'status') setProjectStatus(value)
            }}
            onSubmit={saveProjectStatus}
            saving={saving}
            submitLabel="Save changes"
            submittingLabel="Saving…"
          />

          {error && <p className="mb-4 rounded-lg border border-[#e7c9c1] bg-[#fbf0ed] px-4 py-3 text-sm text-[#9a4d3c]" role="alert">{error}</p>}
          {notice && <p className="mb-4 rounded-lg border border-[#d6e1d3] bg-[#eff5ed] px-4 py-3 text-sm text-[#42674b]" role="status">{notice}</p>}

          <section className="invoice-panel mt-5 p-6" aria-label="Task progress">
            <div className="invoice-panel-actions flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[#294635]">Task progress</h2>
                <p className="mt-1 text-sm text-[#77766c]">Tasks assigned to this project.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[#f3f1e9] px-3 py-1.5 text-[#53614a]">{taskCounts.total} total</span>
                <span className="rounded-full bg-[#eff5ed] px-3 py-1.5 text-[#42674b]">{taskCounts.complete} complete</span>
                <span className="rounded-full bg-[#f7f1e2] px-3 py-1.5 text-[#806c37]">{taskCounts.inProgress} in progress</span>
                {taskCounts.blocked > 0 && <span className="rounded-full bg-[#fbf0ed] px-3 py-1.5 text-[#9a4d3c]">{taskCounts.blocked} blocked</span>}
              </div>
            </div>
            <form onSubmit={(event) => void addTask(event)} className="mt-5 grid gap-3 rounded-xl border border-[#eeeae0] bg-[#fbfaf7] p-4 sm:grid-cols-2 lg:grid-cols-6" aria-label="Add a project task">
              <div className="sm:col-span-2 lg:col-span-2"><label htmlFor="new-task-name" className="text-xs text-[#858174]">Task name</label><input id="new-task-name" value={newTask.name} onChange={(event) => setNewTask({ ...newTask, name: event.target.value })} required className="mt-1 min-h-10 w-full rounded-lg border border-[#e5e1d6] bg-white px-3 text-sm text-[#32372f]" placeholder="Add a task" /></div>
              <div><label htmlFor="new-task-start" className="text-xs text-[#858174]">Start date</label><div className="mt-1"><EthiopianDateInput id="new-task-start" value={newTask.start_date} onChange={(iso) => setNewTask({ ...newTask, start_date: iso })} required max={newTask.end_date || undefined} className="min-h-10 rounded-lg border-[#e5e1d6] bg-white text-sm text-[#32372f]" /></div></div>
              <div><label htmlFor="new-task-end" className="text-xs text-[#858174]">End date</label><div className="mt-1"><EthiopianDateInput id="new-task-end" value={newTask.end_date} onChange={(iso) => setNewTask({ ...newTask, end_date: iso })} required min={newTask.start_date || undefined} className="min-h-10 rounded-lg border-[#e5e1d6] bg-white text-sm text-[#32372f]" /></div></div>
              <div><label htmlFor="new-task-status" className="text-xs text-[#858174]">Status</label><select id="new-task-status" value={newTask.status} onChange={(event) => setNewTask({ ...newTask, status: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-[#e5e1d6] bg-white px-3 text-sm text-[#32372f]">{taskStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></div>
              <div className="sm:col-span-2 lg:col-span-2"><label htmlFor="new-task-assignees" className="text-xs text-[#858174]">Assign to</label><select id="new-task-assignees" multiple value={newTask.assignee_ids.map(String)} onChange={(event) => setNewTask({ ...newTask, assignee_ids: Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value)) })} className="mt-1 min-h-10 w-full rounded-lg border border-[#e5e1d6] bg-white px-3 py-2 text-sm text-[#32372f]">{assigneeOptions.map((user) => <option key={user.id} value={user.id}>{fullName(user)}</option>)}</select></div>
              <div className="flex items-end"><button type="submit" disabled={creatingTask} className="invoice-primary-action min-h-10 w-full rounded-lg bg-[#28513c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1d3d2c] disabled:cursor-wait disabled:opacity-60">{creatingTask ? 'Adding…' : 'Add task'}</button></div>
            </form>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                <thead><tr>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#858174]">Task</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#858174]">Assignees</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#858174]">Start date</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#858174]">End date</th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#858174]">Status</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#858174]">Action</th>
                </tr></thead>
                <tbody>
                  {project?.tasks.length ? project.tasks.map((task) => (
                    <tr key={task.id} className="border-t border-[#e5e1d6] align-top">
                      <td className="min-w-48 px-4 py-3"><input aria-label={`Task name: ${task.name}`} value={taskDrafts[task.id]?.name ?? task.name} onChange={(event) => updateTaskDraft(task.id, { name: event.target.value })} className="min-h-10 w-full rounded-lg border border-[#e5e1d6] bg-white px-3 text-sm text-[#32372f]" /></td>
                      <td className="min-w-48 px-4 py-3"><select aria-label={`Assignees for ${task.name}`} multiple value={(taskDrafts[task.id]?.assignee_ids ?? []).map(String)} onChange={(event) => updateTaskDraft(task.id, { assignee_ids: Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value)) })} className="min-h-12 w-full rounded-lg border border-[#e5e1d6] bg-white px-2 py-1 text-sm text-[#32372f]">{assigneeOptions.map((user) => <option key={user.id} value={user.id}>{fullName(user)}</option>)}</select></td>
                      <td className="min-w-36 px-4 py-3"><EthiopianDateInput aria-label={`Start date for ${task.name}`} value={taskDrafts[task.id]?.start_date ?? task.start_date} onChange={(iso) => updateTaskDraft(task.id, { start_date: iso })} showChurchDays={false} className="min-h-10 rounded-lg border-[#e5e1d6] bg-white px-2 text-sm text-[#32372f]" /></td>
                      <td className="min-w-36 px-4 py-3"><EthiopianDateInput aria-label={`End date for ${task.name}`} value={taskDrafts[task.id]?.end_date ?? task.end_date} onChange={(iso) => updateTaskDraft(task.id, { end_date: iso })} showChurchDays={false} className="min-h-10 rounded-lg border-[#e5e1d6] bg-white px-2 text-sm text-[#32372f]" /></td>
                      <td className="min-w-36 px-4 py-3"><select aria-label={`Status for ${task.name}`} value={taskDrafts[task.id]?.status ?? task.status} onChange={(event) => updateTaskDraft(task.id, { status: event.target.value })} className="min-h-10 w-full rounded-lg border border-[#e5e1d6] bg-white px-3 text-sm text-[#32372f]">{taskStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></td>
                      <td className="px-4 py-3 text-right"><button type="button" onClick={() => void saveTask(task.id)} disabled={savingTaskId === task.id} className="min-h-10 rounded-lg border border-[#d8cba8] bg-[#f7f1e2] px-4 text-sm font-medium text-[#53614a] transition-colors hover:bg-[#f1ead7] disabled:cursor-wait disabled:opacity-60">{savingTaskId === task.id ? 'Saving…' : 'Save'}</button></td>
                    </tr>
                  )) : <tr className="border-t border-[#e5e1d6]"><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#77766c]">No tasks have been added to this project yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
