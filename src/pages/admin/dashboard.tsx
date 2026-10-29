import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert02Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Invoice01Icon,
  Ticket01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Link, useNavigate } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { formatDualDate, formatEthiopian, parseIsoDate, todayUtc } from '@/lib/ethiopian-calendar'

type Summary = {
  total_leads: number
  active_leads: number
  assigned_leads: number
  won_leads: number
  lost_leads: number
  conversion_rate: number
  active_events: number
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
type MonthCount = { month: string; inquiries: number; won: number }
type Receivables = {
  outstanding_total: string
  outstanding_count: number
  overdue_total: string
  overdue_count: number
  due_this_week_total: string
  due_this_week_count: number
}
type UpcomingEvent = {
  id: number
  name: string
  customer: string
  event_date: string
  days_away: number
  location: string
  project_id: number | null
  tasks_total: number
  tasks_done: number
  invoice_count: number
  unpaid_count: number
}
type DashboardData = {
  scope: 'all' | 'assigned_to_me'
  summary: Summary
  status_breakdown: StatusCount[]
  recent_leads: RecentLead[]
  sales_performance: SalesPerformance[]
  monthly_inquiries: MonthCount[]
  receivables: Receivables
  upcoming_events: UpcomingEvent[]
}

type Preset = 'all' | 'month' | 'quarter' | 'year'
const presets: { id: Preset; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'Last 3 months' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
]

// Two shades of the brand green, validated as an ordinal pair against the white card surface.
const INQUIRY_FILL = '#9db79a'
const WON_FILL = '#28513c'
const CLOSED_FILL = '#c9c5b8'
const closedStages = new Set(['lost', 'cancelled'])

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function presetRange(preset: Preset): [string, string] {
  const today = new Date()
  if (preset === 'all') return ['', '']
  const start = preset === 'month' ? new Date(today.getFullYear(), today.getMonth(), 1)
    : preset === 'quarter' ? new Date(today.getFullYear(), today.getMonth() - 2, 1)
    : new Date(today.getFullYear(), 0, 1)
  return [isoDate(start), '']
}

function formatToday() {
  const today = todayUtc()
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(today)
  return `${weekday}, ${formatEthiopian(today)}`
}

function formatMoney(value: string | number, compact = false) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return String(value)
  return new Intl.NumberFormat('en-ET', {
    style: 'currency', currency: 'ETB',
    ...(compact && amount >= 100000 ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }),
  }).format(amount)
}

function monthLabel(iso: string, style: 'short' | 'long' = 'short') {
  const date = parseIsoDate(iso)
  if (!date) return iso
  return new Intl.DateTimeFormat('en-GB', { month: style, ...(style === 'long' ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(date)
}

function daysAwayLabel(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 14) return `In ${days} days`
  return `In ${Math.round(days / 7)} weeks`
}

type StatTile = { label: string; value: string; detail: string; icon: IconSvgElement; tone?: 'warning' | 'good'; href?: string }

function StatTileCard({ tile }: { tile: StatTile }) {
  const body = (
    <>
      <div className="dash-tile-head">
        <span>{tile.label}</span>
        <HugeiconsIcon icon={tile.icon} className="dash-tile-icon" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <strong className="dash-tile-value">{tile.value}</strong>
      <span className={`dash-tile-detail${tile.tone ? ` is-${tile.tone}` : ''}`}>
        {tile.tone === 'warning' && <HugeiconsIcon icon={Alert02Icon} className="size-3.5" strokeWidth={2} aria-hidden="true" />}
        {tile.tone === 'good' && <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" strokeWidth={2} aria-hidden="true" />}
        {tile.detail}
      </span>
    </>
  )
  return tile.href
    ? <Link to={tile.href} className="dash-tile dash-tile--link">{body}</Link>
    : <article className="dash-tile">{body}</article>
}

function MonthTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as MonthCount
  return (
    <div className="dash-tooltip">
      <strong>{monthLabel(String(label), 'long')}</strong>
      <span><i style={{ background: INQUIRY_FILL }} />Inquiries<b>{row.inquiries}</b></span>
      <span><i style={{ background: WON_FILL }} />Won<b>{row.won}</b></span>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [preset, setPreset] = useState<Preset | null>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [trendView, setTrendView] = useState<'chart' | 'table'>('chart')

  const loadDashboard = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const filters = new URLSearchParams()
      if (startDate) filters.set('start_date', startDate)
      if (endDate) filters.set('end_date', endDate)
      const query = filters.toString()
      const response = await fetch(`${apiBaseUrl}/crm/sales/dashboard/${query ? `?${query}` : ''}`, {
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
        throw new Error(body?.message || body?.detail || 'We could not load the dashboard.')
      }
      const data = body?.data as DashboardData | undefined
      if (!data?.summary || !Array.isArray(data.status_breakdown)) {
        throw new Error('The dashboard returned an unexpected response.')
      }
      setDashboard(data)
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [logout, navigate, startDate, endDate])

  useEffect(() => {
    const controller = new AbortController()
    void loadDashboard(controller.signal)
    return () => controller.abort()
  }, [loadDashboard, reloadKey])

  function choosePreset(next: Preset) {
    const [start, end] = presetRange(next)
    setPreset(next)
    setStartDate(start)
    setEndDate(end)
  }

  const tiles = useMemo<StatTile[]>(() => {
    if (!dashboard) return []
    const { summary, receivables } = dashboard
    return [
      { label: 'Open leads', value: summary.active_leads.toLocaleString(), detail: `${summary.total_leads.toLocaleString()} inquiries in range`, icon: Ticket01Icon, href: '/dashboard/leads' },
      { label: 'Won', value: summary.won_leads.toLocaleString(), detail: `${summary.conversion_rate}% conversion · ${summary.lost_leads} lost`, icon: UserGroupIcon },
      { label: 'Active events', value: summary.active_events.toLocaleString(), detail: 'Planning or underway', icon: Calendar03Icon },
      { label: 'Outstanding', value: formatMoney(receivables.outstanding_total, true), detail: `${receivables.outstanding_count} unpaid ${receivables.outstanding_count === 1 ? 'invoice' : 'invoices'}`, icon: Invoice01Icon, href: '/dashboard/invoices' },
      receivables.overdue_count > 0
        ? { label: 'Overdue', value: formatMoney(receivables.overdue_total, true), detail: `${receivables.overdue_count} past due`, icon: Alert02Icon, tone: 'warning', href: '/dashboard/invoices' }
        : { label: 'Overdue', value: formatMoney(0), detail: 'Nothing past due', icon: CheckmarkCircle02Icon, tone: 'good' },
    ]
  }, [dashboard])

  const maxStage = Math.max(1, ...(dashboard?.status_breakdown.map((item) => item.count) ?? []))
  const maxActive = Math.max(1, ...(dashboard?.sales_performance.map((person) => person.active_leads + person.won_leads) ?? []))
  const hasTrend = dashboard?.monthly_inquiries.some((month) => month.inquiries > 0) ?? false
  const dueThisWeek = dashboard?.receivables.due_this_week_count ?? 0

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />

      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="dash mx-auto max-w-7xl">
          <div className="dash-header">
            <div>
              <p className="dash-eyebrow">{formatToday()}</p>
              <h1 className="dash-title">Dashboard</h1>
            </div>
            {dashboard && <span className="dash-scope">{dashboard.scope === 'all' ? 'All sales' : 'My leads'}</span>}
          </div>

          <section className="dash-filters" aria-label="Filter lead figures by inquiry date">
            <div className="dash-presets" role="group" aria-label="Date range">
              {presets.map((item) => (
                <button key={item.id} type="button" aria-pressed={preset === item.id} className={preset === item.id ? 'is-active' : ''} onClick={() => choosePreset(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="dash-range">
              <EthiopianDateInput aria-label="From date" value={startDate} max={endDate || undefined} onChange={(iso) => { setStartDate(iso); setPreset(null) }} showChurchDays={false} placeholder="From" />
              <span aria-hidden="true">→</span>
              <EthiopianDateInput aria-label="Through date" value={endDate} min={startDate || undefined} onChange={(iso) => { setEndDate(iso); setPreset(null) }} showChurchDays={false} placeholder="Today" />
            </div>
            <p className="dash-filter-note">Lead figures follow the inquiry date · money and events are as of today</p>
          </section>

          {error && (
            <section className="dashboard-message dashboard-message--error" role="alert">
              <div><strong>We couldn’t load your dashboard.</strong><p>{error}</p></div>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again <span>↻</span></button>
            </section>
          )}

          {loading && !dashboard && <div className="o-form-loading" role="status" aria-label="Loading dashboard"><span /><span /><span /></div>}

          {dashboard && (
            <div className={`dash-body${loading ? ' is-refreshing' : ''}`} aria-busy={loading}>
              <section aria-label="Key figures" className="dash-tiles">
                {tiles.map((tile) => <StatTileCard key={tile.label} tile={tile} />)}
              </section>

              <section className="dash-grid dash-grid--trend">
                <article className="dash-card">
                  <div className="dash-card-head">
                    <div>
                      <h2>Inquiries per month</h2>
                      <div className="dash-legend">
                        <span><i style={{ background: INQUIRY_FILL }} />Inquiries</span>
                        <span><i style={{ background: WON_FILL }} />Won</span>
                      </div>
                    </div>
                    <div className="dash-toggle" role="group" aria-label="Show as">
                      <button type="button" aria-pressed={trendView === 'chart'} className={trendView === 'chart' ? 'is-active' : ''} onClick={() => setTrendView('chart')}>Chart</button>
                      <button type="button" aria-pressed={trendView === 'table'} className={trendView === 'table' ? 'is-active' : ''} onClick={() => setTrendView('table')}>Table</button>
                    </div>
                  </div>
                  {!hasTrend ? <p className="dash-empty">No inquiries in this range yet.</p> : trendView === 'chart' ? (
                    <div className="dash-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.monthly_inquiries} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                          <CartesianGrid vertical={false} stroke="#efede5" />
                          <XAxis dataKey="month" tickFormatter={(value: string) => monthLabel(value)} tickLine={false} axisLine={{ stroke: '#e5e1d6' }} tick={{ fill: '#77766c', fontSize: 12 }} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#9a978b', fontSize: 12 }} width={44} />
                          <Tooltip content={MonthTooltip} cursor={{ fill: 'rgba(40, 81, 60, .06)' }} />
                          <Bar dataKey="inquiries" isAnimationActive={false} name="Inquiries" fill={INQUIRY_FILL} radius={[4, 4, 0, 0]} maxBarSize={22} />
                          <Bar dataKey="won" isAnimationActive={false} name="Won" fill={WON_FILL} radius={[4, 4, 0, 0]} maxBarSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <table className="dash-table dash-table--compact">
                      <thead><tr><th scope="col">Month</th><th scope="col" className="o-num">Inquiries</th><th scope="col" className="o-num">Won</th></tr></thead>
                      <tbody>{dashboard.monthly_inquiries.map((month) => (
                        <tr key={month.month}><td>{monthLabel(month.month, 'long')}</td><td className="o-num">{month.inquiries}</td><td className="o-num">{month.won}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                </article>

                <article className="dash-card">
                  <div className="dash-card-head">
                    <h2>Pipeline by stage</h2>
                    <Link to="/dashboard/leads" className="dash-link">Open board</Link>
                  </div>
                  {dashboard.summary.total_leads === 0 ? <p className="dash-empty">No leads in this range yet.</p> : (
                    <ul className="dash-stages">
                      {dashboard.status_breakdown.map((item) => (
                        <li key={item.status} className={item.count === 0 ? 'is-zero' : ''}>
                          <span className="dash-stage-label">{item.label}</span>
                          <span className="dash-stage-track">
                            {item.count > 0 && <span style={{ width: `${(item.count / maxStage) * 100}%`, background: closedStages.has(item.status) ? CLOSED_FILL : WON_FILL }} />}
                          </span>
                          <strong>{item.count}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </section>

              <section className="dash-grid dash-grid--even">
                <article className="dash-card">
                  <div className="dash-card-head">
                    <h2>Upcoming events</h2>
                    {dueThisWeek > 0 && <span className="dash-chip is-warning"><HugeiconsIcon icon={Alert02Icon} className="size-3.5" strokeWidth={2} aria-hidden="true" />{formatMoney(dashboard.receivables.due_this_week_total)} due this week</span>}
                  </div>
                  {dashboard.upcoming_events.length === 0 ? <p className="dash-empty">No upcoming events. Won leads appear here once their event is created.</p> : (
                    <ul className="dash-events">
                      {dashboard.upcoming_events.map((event) => {
                        const progress = event.tasks_total ? Math.round((event.tasks_done / event.tasks_total) * 100) : 0
                        const date = parseIsoDate(event.event_date)
                        return (
                          <li key={event.id}>
                            <div className="dash-event-date" aria-hidden="true">
                              <strong>{date?.getUTCDate()}</strong>
                              <span>{date ? new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date) : ''}</span>
                            </div>
                            <div className="dash-event-main">
                              <div className="dash-event-top">
                                {event.project_id
                                  ? <Link to={`/dashboard/projects/${event.project_id}`}>{event.name}</Link>
                                  : <strong>{event.name}</strong>}
                                <span className={event.days_away < 14 ? 'is-soon' : ''}>{daysAwayLabel(event.days_away)}</span>
                              </div>
                              <small>{formatDualDate(event.event_date)}{event.location ? ` · ${event.location}` : ''}</small>
                              <div className="dash-event-meta">
                                <span className="dash-meter" aria-label={`${event.tasks_done} of ${event.tasks_total} tasks complete`}>
                                  <span style={{ width: `${progress}%` }} />
                                </span>
                                <span>{event.tasks_total ? `${event.tasks_done}/${event.tasks_total} tasks` : 'No tasks yet'}</span>
                                {event.invoice_count === 0
                                  ? <span className="dash-chip">No invoice</span>
                                  : event.unpaid_count > 0
                                    ? <span className="dash-chip is-warning">{event.unpaid_count} unpaid</span>
                                    : <span className="dash-chip is-good">Paid</span>}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </article>

                <article className="dash-card">
                  <div className="dash-card-head">
                    <h2>Sales performance</h2>
                    <div className="dash-legend">
                      <span><i style={{ background: INQUIRY_FILL }} />Open</span>
                      <span><i style={{ background: WON_FILL }} />Won</span>
                    </div>
                  </div>
                  {dashboard.sales_performance.length === 0 ? <p className="dash-empty">No sales activity to show yet.</p> : (
                    <ul className="dash-people">
                      {dashboard.sales_performance.map((person) => (
                        <li key={person.sales_person_id}>
                          <span className="o-avatar" style={{ background: WON_FILL }} aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span>
                          <div>
                            <div className="dash-person-top"><strong>{person.name}</strong><span>{person.conversion_rate}% conversion</span></div>
                            <div className="dash-stack" aria-label={`${person.active_leads} open, ${person.won_leads} won`}>
                              {person.active_leads > 0 && <span style={{ width: `${(person.active_leads / maxActive) * 100}%`, background: INQUIRY_FILL }} />}
                              {person.won_leads > 0 && <span style={{ width: `${(person.won_leads / maxActive) * 100}%`, background: WON_FILL }} />}
                            </div>
                            <small>{person.active_leads} open · {person.won_leads} won · {person.lost_leads} lost</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </section>

              <section className="dash-card dash-card--flush">
                <div className="dash-card-head">
                  <h2>Recent inquiries</h2>
                  <Link to="/dashboard/leads" className="dash-link">All leads</Link>
                </div>
                {dashboard.recent_leads.length === 0 ? <p className="dash-empty">New inquiries will appear here.</p> : (
                  <div className="overflow-x-auto">
                    <table className="dash-table">
                      <thead><tr><th scope="col">Customer</th><th scope="col">Celebration</th><th scope="col">Event date</th><th scope="col">Sales person</th><th scope="col">Stage</th></tr></thead>
                      <tbody>
                        {dashboard.recent_leads.map((lead) => (
                          <tr key={lead.id} onClick={() => navigate(`/dashboard/leads/${lead.id}`)}>
                            <td><Link to={`/dashboard/leads/${lead.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>{lead.customer_name}</Link><small>{lead.phone}</small></td>
                            <td><span className="dash-row-title">{lead.plan_name}</span>{lead.package_name && <small>{lead.package_name}</small>}</td>
                            <td className="dash-muted">{formatDualDate(lead.plan_date)}</td>
                            <td className="dash-muted">{lead.sales_person ?? 'Unassigned'}</td>
                            <td><span className={`dashboard-lead-status dashboard-lead-status--${lead.status}`}>{lead.status_label}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
