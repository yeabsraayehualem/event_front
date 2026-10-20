import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

type LeadStatus = 'lead' | 'contacted' | 'consultation_scheduled' | 'quotation_sent' | 'negotiation' | 'won' | 'lost' | 'cancelled'
type Lead = {
  id: number
  customer: { id: number; name: string; phone: string }
  plan: { id: number; name: string }
  package: { id: number; name: string } | null
  date: string
  plan_date: string
  status: LeadStatus
}

const statuses: { value: LeadStatus; label: string }[] = [
  { value: 'lead', label: 'New leads' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'consultation_scheduled', label: 'Consultation scheduled' },
  { value: 'quotation_sent', label: 'Quotation sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'cancelled', label: 'Cancelled' },
]

const statusStyles: Record<LeadStatus, string> = {
  lead: 'border-[#d8cba8] bg-[#f7f1e2] text-[#756039]',
  contacted: 'border-[#d6d8c9] bg-[#eef0e6] text-[#53614a]',
  consultation_scheduled: 'border-[#d6d8c9] bg-[#eef0e6] text-[#53614a]',
  quotation_sent: 'border-[#d8cba8] bg-[#f7f1e2] text-[#756039]',
  negotiation: 'border-[#b8ccbd] bg-[#e8f0e9] text-[#28513c]',
  won: 'border-[#b8ccbd] bg-[#e8f0e9] text-[#28513c]',
  lost: 'border-[#e5c9bd] bg-[#fbf0eb] text-[#85493d]',
  cancelled: 'border-[#d8d4c9] bg-[#f0eee8] text-[#77766c]',
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('en-ET', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function LeadsPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const [status, setStatus] = useState<LeadStatus>('lead')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')
  const [boardMessage, setBoardMessage] = useState('')
  const [wonLead, setWonLead] = useState<Lead | null>(null)
  const [convertingWonLead, setConvertingWonLead] = useState(false)

  const loadLeads = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${apiBaseUrl}/crm/sales/leads/?status=${viewMode === 'board' ? 'all' : encodeURIComponent(status)}`,
        { credentials: 'include', signal, headers: { Accept: 'application/json' } },
      )
      const body: unknown = await response.json()
      if (response.status === 401 || response.status === 403) {
        await logout()
        navigate('/login', { replace: true })
        return
      }
      if (!response.ok) {
        const message = typeof body === 'object' && body !== null && 'detail' in body
          ? String((body as { detail: unknown }).detail)
          : 'We could not load these leads.'
        throw new Error(message)
      }
      if (!Array.isArray(body)) throw new Error('The leads response had an unexpected format.')
      setLeads(body as Lead[])
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') {
        setError(loadError.message)
      }
    } finally {
      setLoading(false)
    }
  }, [logout, navigate, status, viewMode])

  useEffect(() => {
    const controller = new AbortController()
    void loadLeads(controller.signal)
    return () => controller.abort()
  }, [loadLeads, reloadKey])

  async function moveLead(lead: Lead, nextStatus: LeadStatus) {
    if (lead.status === nextStatus) return
    setBoardMessage('')
    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/user/csrf/`, { credentials: 'include' })
      const csrfBody: unknown = await csrfResponse.json()
      const csrfToken = typeof csrfBody === 'object' && csrfBody !== null && 'csrf_token' in csrfBody
        ? (csrfBody as { csrf_token?: unknown }).csrf_token : undefined
      if (!csrfResponse.ok || typeof csrfToken !== 'string') throw new Error('Could not prepare a secure update.')
      const response = await fetch(`${apiBaseUrl}/crm/sales/leads/${lead.id}/`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken, Accept: 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail || 'This lead could not be moved.')
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status: nextStatus } : item))
      if (nextStatus === 'won') {
        setWonLead({ ...lead, status: nextStatus })
        setBoardMessage('The lead is won. Choose whether to create its event now.')
      }
    } catch (moveError) {
      setBoardMessage(moveError instanceof Error ? moveError.message : 'This lead could not be moved.')
    }
  }

  async function createEventFromWonLead() {
    if (!wonLead) return
    setConvertingWonLead(true)
    setBoardMessage('')
    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/user/csrf/`, { credentials: 'include' })
      const csrfBody: unknown = await csrfResponse.json()
      const csrfToken = typeof csrfBody === 'object' && csrfBody !== null && 'csrf_token' in csrfBody
        ? (csrfBody as { csrf_token?: unknown }).csrf_token : undefined
      if (!csrfResponse.ok || typeof csrfToken !== 'string') throw new Error('Could not prepare a secure event creation request.')
      const response = await fetch(`${apiBaseUrl}/crm/sales/leads/${wonLead.id}/convert/`, {
        method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'X-CSRFToken': csrfToken },
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail || 'We could not create the event.')
      setBoardMessage(`Event #${body?.data?.id} has been created from ${wonLead.customer.name}’s won lead.`)
      setWonLead(null)
    } catch (conversionError) {
      setBoardMessage(conversionError instanceof Error ? conversionError.message : 'We could not create the event.')
    } finally {
      setConvertingWonLead(false)
    }
  }

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="dashboard-date mb-2 text-sm font-medium">Client inquiries</p>
              <h1 className="dashboard-title text-3xl font-semibold tracking-tight">Leads</h1>
              <p className="dashboard-subtitle">Review each inquiry and its requested event plan.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex border border-[#d8cba8] bg-[#fffdf7] p-1 text-xs font-semibold">
              <button type="button" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')} className={`px-3 py-2 ${viewMode === 'table' ? 'bg-[#28513c] text-white' : 'text-[#53614a]'}`}>Table</button>
              <button type="button" aria-pressed={viewMode === 'board'} onClick={() => setViewMode('board')} className={`px-3 py-2 ${viewMode === 'board' ? 'bg-[#28513c] text-white' : 'text-[#53614a]'}`}>Board</button>
            </div>
            {viewMode === 'table' && <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[.12em] text-[#77766c]">
              Filter by status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as LeadStatus)}
                className="min-h-11 border border-[#d8cba8] bg-[#fffdf7] px-3 text-sm font-medium normal-case tracking-normal text-[#294635] outline-none focus:border-[#28513c]"
              >
                {statuses.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>}
            </div>
          </header>

          {boardMessage && <p className="mb-4 rounded-lg border border-[#d8cba8] bg-[#fffdf7] px-4 py-3 text-sm text-[#53614a]" role="status">{boardMessage}</p>}

          {error && (
            <section className="dashboard-message dashboard-message--error" role="alert">
              <div><strong>We couldn’t load these leads.</strong><p>{error}</p></div>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again <span>↻</span></button>
            </section>
          )}

          {viewMode === 'board' ? (
          <section className="grid gap-4 xl:grid-cols-4" aria-label="Lead pipeline board">
            {statuses.map((column) => {
              const columnLeads = leads.filter((lead) => lead.status === column.value)
              return <div key={column.value} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                event.preventDefault()
                const leadId = Number(event.dataTransfer.getData('text/plain'))
                const lead = leads.find((item) => item.id === leadId)
                if (lead) void moveLead(lead, column.value)
              }} className="min-h-64 rounded-xl border border-[#e8e1d2] bg-[#f7f4eb] p-3">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-[#294635]">{column.label}</h2><span className="rounded-full bg-white px-2 py-1 text-xs text-[#77766c]">{columnLeads.length}</span></div>
                <div className="grid gap-3">{columnLeads.map((lead) => <article key={lead.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(lead.id))} className="cursor-grab rounded-lg border border-[#e8e1d2] bg-white p-3 shadow-sm active:cursor-grabbing">
                  <Link to={`/dashboard/leads/${lead.id}`} className="font-medium text-[#294635] hover:text-[#a64f42] hover:underline">{lead.customer.name}</Link>
                  <p className="mt-1 text-xs text-[#77766c]">{lead.plan.name}{lead.package ? ` · ${lead.package.name}` : ''}</p>
                  <p className="mt-2 text-xs text-[#898679]">Event {formatDate(lead.plan_date)}</p>
                  <label className="sr-only" htmlFor={`stage-${lead.id}`}>Move {lead.customer.name} to another stage</label>
                  <select id={`stage-${lead.id}`} value={lead.status} onChange={(event) => void moveLead(lead, event.target.value as LeadStatus)} className="mt-3 min-h-9 w-full border border-[#e8e1d2] bg-[#fffdf7] px-2 text-xs text-[#53614a]">{statuses.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}</select>
                </article>)}</div>
              </div>
            })}
          </section>
          ) : <section className="dashboard-card overflow-hidden" aria-label="Filtered leads">
            <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-6">
              <div>
                <h2>{statuses.find((item) => item.value === status)?.label}</h2>
                <p className="mt-1 text-sm text-slate-500">{loading ? 'Updating lead list…' : `${leads.length} ${leads.length === 1 ? 'inquiry' : 'inquiries'}`}</p>
              </div>
              <span className="dashboard-list-count">{status.toUpperCase()}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                <thead className="border-y border-[#e8e1d2] bg-[#f7f4eb] text-[10px] uppercase tracking-[.12em] text-[#77766c]">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Date</th>
                    <th className="px-5 py-4 font-semibold">Customer</th>
                    <th className="px-5 py-4 font-semibold">Plan</th>
                    <th className="px-5 py-4 font-semibold">Package</th>
                    <th className="px-5 py-4 font-semibold">Plan date</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 text-right font-semibold">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee8dc]">
                  {loading && leads.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-[#77766c]">Loading inquiries…</td></tr>
                  )}
                  {!loading && !error && leads.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-[#77766c]">No {statuses.find((item) => item.value === status)?.label.toLowerCase()} yet.</td></tr>
                  )}
                  {leads.map((lead) => (
                    <tr key={lead.id} className="transition-colors hover:bg-[#faf8f1]">
                      <td className="px-5 py-4 text-[#77766c]">{formatDate(lead.date)}</td>
                      <td className="px-5 py-4">
                        <Link to={`/dashboard/leads/${lead.id}`} className="font-medium text-[#294635] hover:text-[#a64f42] hover:underline">
                          {lead.customer.name}
                        </Link>
                        <div className="mt-1 text-xs text-[#898679]">{lead.customer.phone}</div>
                      </td>
                      <td className="px-5 py-4 font-medium text-[#294635]">{lead.plan.name}</td>
                      <td className="px-5 py-4 text-[#77766c]">{lead.package?.name ?? '—'}</td>
                      <td className="px-5 py-4 text-[#77766c]">{formatDate(lead.plan_date)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.1em] ${statusStyles[lead.status]}`}>
                          {statuses.find((item) => item.value === lead.status)?.label ?? lead.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/dashboard/leads/${lead.id}`}
                          aria-label={`View details for ${lead.customer.name}`}
                          title="View lead details"
                          className="inline-grid size-9 place-items-center border border-[#d8cba8] text-[#28513c] transition-colors hover:border-[#28513c] hover:bg-[#f7f1e2] hover:text-[#a64f42]"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-[18px]" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
                            <circle cx="12" cy="12" r="2.6" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>}
        </div>
      </main>
      {wonLead && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#17251d]/55 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="board-won-event-title" className="w-full max-w-md border border-[#d8cba8] bg-[#fffdf7] p-7 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#a64f42]">Lead won</p>
            <h2 id="board-won-event-title" className="mt-2 font-serif text-2xl text-[#294635]">Create an event for {wonLead.customer.name}?</h2>
            <p className="mt-3 text-sm leading-6 text-[#77766c]">The confirmed celebration details will be copied into a new event record.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setWonLead(null)} className="min-h-11 border border-[#d8cba8] px-4 text-sm text-[#53614a]">Later</button>
              <button type="button" disabled={convertingWonLead} onClick={() => void createEventFromWonLead()} className="min-h-11 bg-[#28513c] px-5 text-sm font-semibold text-white disabled:opacity-60">{convertingWonLead ? 'Creating…' : 'Create event'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
