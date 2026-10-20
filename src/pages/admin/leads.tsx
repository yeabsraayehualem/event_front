import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

type LeadStatus = 'lead' | 'contacted' | 'negotiation' | 'won' | 'lost' | 'cancelled'
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
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'cancelled', label: 'Cancelled' },
]

const statusStyles: Record<LeadStatus, string> = {
  lead: 'border-[#d8cba8] bg-[#f7f1e2] text-[#756039]',
  contacted: 'border-[#d6d8c9] bg-[#eef0e6] text-[#53614a]',
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

  const loadLeads = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${apiBaseUrl}/crm/sales/leads/?status=${encodeURIComponent(status)}`,
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
  }, [logout, navigate, status])

  useEffect(() => {
    const controller = new AbortController()
    void loadLeads(controller.signal)
    return () => controller.abort()
  }, [loadLeads, reloadKey])

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
            <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[.12em] text-[#77766c]">
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
            </label>
          </header>

          {error && (
            <section className="dashboard-message dashboard-message--error" role="alert">
              <div><strong>We couldn’t load these leads.</strong><p>{error}</p></div>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again <span>↻</span></button>
            </section>
          )}

          <section className="dashboard-card overflow-hidden" aria-label="Filtered leads">
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
          </section>
        </div>
      </main>
    </div>
  )
}
