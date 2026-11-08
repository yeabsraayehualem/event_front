import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { useTranslation } from 'react-i18next'
import { leadStatusLabel } from '@/i18n'

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

const STATUS_VALUES: LeadStatus[] = ['lead', 'contacted', 'consultation_scheduled', 'quotation_sent', 'negotiation', 'won', 'lost', 'cancelled']

const statusStyles: Record<LeadStatus, string> = {
  lead: 'border-[#d8cba8] bg-[#f7f1e2] text-[#756039]',
  contacted: 'border-[#d6d8c9] bg-[#eef0e6] text-[#802f2b]',
  consultation_scheduled: 'border-[#d6d8c9] bg-[#eef0e6] text-[#802f2b]',
  quotation_sent: 'border-[#d8cba8] bg-[#f7f1e2] text-[#756039]',
  negotiation: 'border-[#ccb9b8] bg-[#f0e8e8] text-[#5b211e]',
  won: 'border-[#ccb9b8] bg-[#f0e8e8] text-[#5b211e]',
  lost: 'border-[#e5c9bd] bg-[#fbf0eb] text-[#85493d]',
  cancelled: 'border-[#d8d4c9] bg-[#f0eee8] text-[#77766c]',
}

function formatDate(value: string) {
  return formatDualDate(value)
}

export function LeadsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('leads')
  const statuses = STATUS_VALUES.map((value) => ({ value, label: leadStatusLabel(value) }))
  const logout = useAuthStore((state) => state.logout)
  const [status, setStatus] = useState<LeadStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')
  const [boardMessage, setBoardMessage] = useState('')
  const visibleLeads = leads.filter((lead) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [lead.customer.name, lead.customer.phone, lead.plan.name, lead.package?.name ?? '']
      .some((value) => value.toLowerCase().includes(query))
  })

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
          : t('list.loadFailed')
        throw new Error(message)
      }
      if (!Array.isArray(body)) throw new Error(t('list.badFormat'))
      setLeads(body as Lead[])
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') {
        setError(loadError.message)
      }
    } finally {
      setLoading(false)
    }
  }, [logout, navigate, status, viewMode, t])

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
      if (!csrfResponse.ok || typeof csrfToken !== 'string') throw new Error(t('move.secureFailed'))
      const response = await fetch(`${apiBaseUrl}/crm/sales/leads/${lead.id}/`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken, Accept: 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.detail || t('move.failed'))
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status: nextStatus } : item))
      // Winning a lead creates its event, deposit invoice and project on the server.
      if (nextStatus === 'won' && lead.status !== 'won') {
        const invoices = Array.isArray(body?.invoice_ids) ? body.invoice_ids.length : 0
        setBoardMessage(invoices
          ? t('move.wonCreated', { name: lead.customer.name })
          : t('move.wonNoInvoice', { name: lead.customer.name }))
      }
    } catch (moveError) {
      setBoardMessage(moveError instanceof Error ? moveError.message : t('move.failed'))
    }
  }

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Hadafe Nefs" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="dashboard-date mb-2">{t('list.eyebrow')}</p>
              <h1 className="dashboard-title">{t('list.title')}</h1>
              <p className="dashboard-subtitle">{t('list.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <div className="leads-view-toggle inline-flex border border-[#e5e1d6] bg-white p-1 text-xs font-semibold shadow-sm">
              <button type="button" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')} className={`px-3 py-2 rounded-lg ${viewMode === 'table' ? 'bg-[#5b211e] text-white' : 'text-[#802f2b]'}`}>{t('list.table')}</button>
              <button type="button" aria-pressed={viewMode === 'board'} onClick={() => setViewMode('board')} className={`px-3 py-2 rounded-lg${viewMode === 'board' ? 'bg-[#5b211e] text-white' : 'text-[#802f2b]'}`}>{t('list.board')}</button>
            </div>
            <Link to="/dashboard/leads/new" className="invoice-primary-action inline-flex min-h-10 items-center rounded-lg bg-[#5b211e] px-4 text-sm font-medium text-white transition-colors hover:bg-[#441917]">{t('list.newLead')} <span className="ml-2 text-[#e1c779]">+</span></Link>
            </div>
          </header>

          {boardMessage && <p className="mb-4 rounded-lg border border-[#d8cba8] bg-[#fffdf7] px-4 py-3 text-sm text-[#802f2b]" role="status">{boardMessage}</p>}

          {error && (
            <section className="dashboard-message dashboard-message--error" role="alert">
              <div><strong>{t('list.loadError')}</strong><p>{error}</p></div>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>{t('actions.retry', { ns: 'common' })} <span>↻</span></button>
            </section>
          )}

          {viewMode === 'board' ? (
          <section className="grid gap-4 xl:grid-cols-4" aria-label={t('list.boardLabel')}>
            {statuses.map((column) => {
              const columnLeads = leads.filter((lead) => lead.status === column.value)
              return <div key={column.value} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                event.preventDefault()
                const leadId = Number(event.dataTransfer.getData('text/plain'))
                const lead = leads.find((item) => item.id === leadId)
                if (lead) void moveLead(lead, column.value)
              }} className="min-h-64 rounded-xl border border-[#e8e1d2] bg-[#f7f4eb] p-3">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-[#531f1c]">{column.label}</h2><span className="rounded-full bg-white px-2 py-1 text-xs text-[#77766c]">{columnLeads.length}</span></div>
                <div className="grid gap-3">{columnLeads.map((lead) => <article key={lead.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(lead.id))} className="cursor-grab rounded-lg border border-[#e8e1d2] bg-white p-3 shadow-sm active:cursor-grabbing">
                  <Link to={`/dashboard/leads/${lead.id}`} className="font-medium text-[#531f1c] hover:text-[#a64f42] hover:underline">{lead.customer.name}</Link>
                  <p className="mt-1 text-xs text-[#77766c]">{lead.plan.name}{lead.package ? ` · ${lead.package.name}` : ''}</p>
                  <p className="mt-2 text-xs text-[#898679]">{t('list.eventOn', { date: formatDate(lead.plan_date) })}</p>
                  <label className="sr-only" htmlFor={`stage-${lead.id}`}>{t('list.moveTo', { name: lead.customer.name })}</label>
                  <select id={`stage-${lead.id}`} value={lead.status} onChange={(event) => void moveLead(lead, event.target.value as LeadStatus)} className="mt-3 min-h-9 w-full border border-[#e8e1d2] bg-[#fffdf7] px-2 text-xs text-[#802f2b]">{statuses.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}</select>
                </article>)}</div>
              </div>
            })}
          </section>
          ) : <section className="invoice-panel overflow-hidden" aria-label={t('list.filtered')}>
            <div className="leads-toolbar flex flex-wrap items-center justify-between gap-4 border-b border-[#efede5] p-4 sm:p-5">
              <label className="sr-only" htmlFor="lead-search">{t('list.searchLabel')}</label>
              <input id="lead-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('list.searchPlaceholder')} className="min-h-10 w-full max-w-sm rounded-lg border border-[#e5e1d6] bg-[#fbfaf7] px-4 text-sm outline-none focus:border-[#71836a]" />
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="lead-status-filter" className="text-sm text-[#77766c]">{t('list.status')}</label>
                <select id="lead-status-filter" value={status} onChange={(event) => setStatus(event.target.value as LeadStatus | 'all')} className="min-h-10 rounded-lg border border-[#e5e1d6] bg-white px-3 text-sm font-medium text-[#531f1c] outline-none focus:border-[#71836a]">
                  <option value="all">{t('list.allLeads')}</option>
                  {statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="min-h-10 rounded-lg border border-[#e5e1d6] bg-white px-4 text-sm font-medium text-[#802f2b] transition-colors hover:bg-[#f7f6f1]" aria-label={t('list.refreshLabel')}>{t('actions.refresh', { ns: 'common' })}</button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#531f1c]">{status === 'all' ? t('list.allLeads') : leadStatusLabel(status)}</h2>
                <p className="mt-1 text-sm text-[#77766c]">{loading ? t('list.updating') : t('list.count', { count: visibleLeads.length })}</p>
              </div>
              <span className="dashboard-list-count">{status === 'all' ? t('list.allLeads') : leadStatusLabel(status)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                <thead className="border-y border-[#e8e1d2] bg-[#f7f4eb] text-[10px] uppercase tracking-[.12em] text-[#77766c]">
                  <tr>
                    <th className="px-5 py-4 font-semibold">{t('list.columns.date')}</th>
                    <th className="px-5 py-4 font-semibold">{t('list.columns.customer')}</th>
                    <th className="px-5 py-4 font-semibold">{t('list.columns.plan')}</th>
                    <th className="px-5 py-4 font-semibold">{t('list.columns.package')}</th>
                    <th className="px-5 py-4 font-semibold">{t('list.columns.planDate')}</th>
                    <th className="px-5 py-4 font-semibold">{t('list.columns.status')}</th>
                    <th className="px-5 py-4 text-right font-semibold">{t('list.columns.view')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee8dc]">
                  {loading && leads.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-[#77766c]">{t('list.loading')}</td></tr>
                  )}
                  {!loading && !error && visibleLeads.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-[#77766c]">{search ? t('list.noMatch') : status === 'all' ? t('list.empty') : t('list.emptyStatus', { status: leadStatusLabel(status) })}</td></tr>
                  )}
                  {visibleLeads.map((lead) => (
                    <tr key={lead.id} className="transition-colors hover:bg-[#faf8f1]">
                      <td className="px-5 py-4 text-[#77766c]">{formatDate(lead.date)}</td>
                      <td className="px-5 py-4">
                        <Link to={`/dashboard/leads/${lead.id}`} className="font-medium text-[#531f1c] hover:text-[#a64f42] hover:underline">
                          {lead.customer.name}
                        </Link>
                        <div className="mt-1 text-xs text-[#898679]">{lead.customer.phone}</div>
                      </td>
                      <td className="px-5 py-4 font-medium text-[#531f1c]">{lead.plan.name}</td>
                      <td className="px-5 py-4 text-[#77766c]">{lead.package?.name ?? '—'}</td>
                      <td className="px-5 py-4 text-[#77766c]">{formatDate(lead.plan_date)}</td>
                      <td className="px-5 py-4">
                        <span className={`dashboard-lead-status inline-flex border font-semibold uppercase tracking-[.08em] ${statusStyles[lead.status]}`}>
                          {leadStatusLabel(lead.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/dashboard/leads/${lead.id}`}
                          aria-label={t('list.viewDetails', { name: lead.customer.name })}
                          title={t('list.viewTitle')}
                          className="inline-grid size-9 place-items-center border border-[#d8cba8] text-[#5b211e] transition-colors hover:border-[#5b211e] hover:bg-[#f7f1e2] hover:text-[#a64f42]"
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
    </div>
  )
}
