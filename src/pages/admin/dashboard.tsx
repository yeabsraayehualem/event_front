import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar03Icon,
  ChartBarLineIcon,
  Ticket01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Link, useNavigate } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

type Summary = {
  total_leads: number
  active_leads: number
  assigned_leads: number
  won_leads: number
  lost_leads: number
  conversion_rate: number
}

type StatusCount = { status: string; label: string; count: number }
type RecentLead = {
  id: number
  customer_name: string
  phone: string
  plan_name: string
  package_name: string | null
  plan_date: string
  created_date: string
  status: string
  status_label: string
  sales_person: string | null
}
type SalesPerformance = {
  sales_person_id: number
  name: string
  active_leads: number
  won_leads: number
  lost_leads: number
  conversion_rate: number
}
type DashboardData = {
  scope: 'all' | 'assigned_to_me'
  summary: Summary
  status_breakdown: StatusCount[]
  recent_leads: RecentLead[]
  sales_performance: SalesPerformance[]
}

const statusColors: Record<string, string> = {
  lead: '#a64f42',
  contacted: '#d2b267',
  negotiation: '#28513c',
  won: '#65815d',
  lost: '#9a7770',
  cancelled: '#bfc1b2',
}

function formatEventDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('en-ET', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

function formatToday() {
  return new Intl.DateTimeFormat('en-ET', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date())
}

export function DashboardPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const loadDashboard = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/crm/sales/dashboard/`, {
        credentials: 'include',
        signal,
        headers: { Accept: 'application/json' },
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await logout()
          navigate('/login', { replace: true })
          return
        }
        throw new Error(body?.message || body?.detail || 'We could not load the CRM dashboard.')
      }
      const data = body?.data as DashboardData | undefined
      if (!data?.summary || !Array.isArray(data.status_breakdown)) {
        throw new Error('The CRM dashboard returned an unexpected response.')
      }
      setDashboard(data)
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') {
        setError(loadError.message)
      }
    } finally {
      setLoading(false)
    }
  }, [logout, navigate])

  useEffect(() => {
    const controller = new AbortController()
    void loadDashboard(controller.signal)
    return () => controller.abort()
  }, [loadDashboard, reloadKey])

  const stats = useMemo(() => {
    if (!dashboard) return []
    return [
      { label: 'Total leads', value: dashboard.summary.total_leads.toLocaleString(), detail: 'In your CRM view', icon: Ticket01Icon },
      { label: 'Active leads', value: dashboard.summary.active_leads.toLocaleString(), detail: 'Need follow-up', icon: UserGroupIcon },
      { label: 'Won', value: dashboard.summary.won_leads.toLocaleString(), detail: 'Successfully closed', icon: Calendar03Icon },
      { label: 'Conversion rate', value: `${dashboard.summary.conversion_rate}%`, detail: `${dashboard.summary.lost_leads.toLocaleString()} lost`, icon: ChartBarLineIcon },
    ]
  }, [dashboard])

  const pipeline = useMemo(
    () => dashboard?.status_breakdown.filter((item) => item.count > 0) ?? [],
    [dashboard],
  )
  const maxActiveLeads = Math.max(1, ...(dashboard?.sales_performance.map((person) => person.active_leads) ?? []))

  return (
    <div className="bahran-dashboard flex min-h-screen bg-slate-50">
      <SideNav items={adminNavigationItems} title="Bahran Events" />

      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="dashboard-date mb-2 text-sm font-medium text-indigo-700">{formatToday()}</p>
              <h1 className="dashboard-title text-3xl font-semibold tracking-tight text-slate-950">CRM dashboard</h1>
              <p className="dashboard-subtitle">A clear view of your sales pipeline and recent inquiries.</p>
            </div>
            {dashboard && <span className="dashboard-scope">{dashboard.scope === 'all' ? 'ALL SALES LEADS' : 'MY ASSIGNED LEADS'}</span>}
          </header>

          {error && (
            <section className="dashboard-message dashboard-message--error" role="alert">
              <div><strong>We couldn’t load your dashboard.</strong><p>{error}</p></div>
              {error.includes('session')
                ? <Link to="/login">Sign in again <span>↗</span></Link>
                : <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again <span>↻</span></button>}
            </section>
          )}

          {loading && !dashboard && <div className="dashboard-message" role="status">Loading your CRM snapshot…</div>}

          {dashboard && <>
            <section aria-label="Lead summary" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <article key={stat.label} className="dashboard-card dashboard-stat-card rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                    <span className="dashboard-stat-icon grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                      <HugeiconsIcon icon={stat.icon} className="size-5" strokeWidth={1.8} />
                    </span>
                  </div>
                  <p className="dashboard-stat-value mt-4 text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
                  <p className="dashboard-stat-change mt-2 text-xs font-medium">{stat.detail}</p>
                </article>
              ))}
            </section>

            <section className="mb-6 grid gap-6 xl:grid-cols-[1.15fr_1fr]">
              <article className="dashboard-card rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4">
                  <h2>Lead pipeline</h2>
                  <p className="mt-1 text-sm text-slate-500">Current inquiries by sales stage</p>
                </div>
                {pipeline.length === 0 ? <p className="dashboard-empty-chart">No leads in the pipeline yet.</p> : (
                  <div className="dashboard-pipeline-layout">
                    <div className="dashboard-pipeline-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pipeline} dataKey="count" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
                            {pipeline.map((item) => <Cell key={item.status} fill={statusColors[item.status] ?? '#c9cbb8'} />)}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value} leads`, 'Stage']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="dashboard-pipeline-center"><strong>{dashboard.summary.total_leads}</strong><span>Total leads</span></div>
                    </div>
                    <ul className="dashboard-pipeline-list">
                      {dashboard.status_breakdown.map((item) => (
                        <li key={item.status}>
                          <span className="dashboard-status-dot" style={{ background: statusColors[item.status] ?? '#c9cbb8' }} />
                          <span>{item.label}</span><strong>{item.count}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>

              <article className="dashboard-card rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4">
                  <h2>Sales performance</h2>
                  <p className="mt-1 text-sm text-slate-500">Active work and closed leads by sales person</p>
                </div>
                {dashboard.sales_performance.length === 0 ? <p className="dashboard-empty-chart">No sales activity to show yet.</p> : (
                  <div className="dashboard-performance-list">
                    {dashboard.sales_performance.map((person) => (
                      <article className="dashboard-performance-row" key={person.sales_person_id}>
                        <span className="dashboard-person-initial" aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span>
                        <div className="dashboard-performance-main">
                          <div className="dashboard-performance-top"><strong>{person.name}</strong><span>{person.conversion_rate}% conversion</span></div>
                          <div className="dashboard-performance-track" aria-label={`${person.active_leads} active leads`}><span style={{ width: `${(person.active_leads / maxActiveLeads) * 100}%` }} /></div>
                          <small>{person.active_leads} active · {person.won_leads} won · {person.lost_leads} lost</small>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </section>

            <section className="dashboard-card dashboard-events overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
                <div><h2>Recent inquiries</h2><p className="mt-1 text-sm text-slate-500">The latest customers who reached out.</p></div>
                <span className="dashboard-list-count">{dashboard.recent_leads.length} shown</span>
              </div>
              {dashboard.recent_leads.length === 0 ? <div className="dashboard-empty-table">New inquiries will appear here.</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-y border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
                      <tr><th className="px-6 py-3 font-medium">Customer</th><th className="px-6 py-3 font-medium">Celebration</th><th className="px-6 py-3 font-medium">Event date</th><th className="px-6 py-3 font-medium">Sales person</th><th className="px-6 py-3 font-medium">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboard.recent_leads.map((lead) => (
                        <tr key={lead.id}>
                          <td className="px-6 py-4"><strong className="dashboard-customer-name">{lead.customer_name}</strong><small className="dashboard-customer-phone">{lead.phone}</small></td>
                          <td className="px-6 py-4"><strong className="dashboard-lead-plan">{lead.plan_name}</strong>{lead.package_name && <small className="dashboard-customer-phone">{lead.package_name}</small>}</td>
                          <td className="px-6 py-4 text-slate-500">{formatEventDate(lead.plan_date)}</td>
                          <td className="px-6 py-4 text-slate-600">{lead.sales_person ?? 'Unassigned'}</td>
                          <td className="px-6 py-4"><span className={`dashboard-lead-status dashboard-lead-status--${lead.status}`}>{lead.status_label}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>}
        </div>
      </main>
    </div>
  )
}
