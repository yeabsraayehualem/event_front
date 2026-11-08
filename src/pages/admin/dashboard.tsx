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
import { useTranslation } from 'react-i18next'
import i18n, { intlLocale, leadStatusLabel } from '@/i18n'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { can, useProfile } from '@/lib/use-profile'
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
type Financials = {
  income: string
  collected: string
  invoice_count: number
  expense: string
  event_costs: string
  overhead: string
  expense_count: number
  unbilled_commitments: string
  net: string
  margin: number | null
}
/** Each section is null when the signed-in role can't see that module (see utils/rbac.py). */
type DashboardData = {
  scope: 'all' | 'assigned_to_me'
  summary: Summary | null
  status_breakdown: StatusCount[] | null
  recent_leads: RecentLead[] | null
  sales_performance: SalesPerformance[] | null
  monthly_inquiries: MonthCount[] | null
  receivables: Receivables | null
  upcoming_events: UpcomingEvent[] | null
  active_events: number | null
  financials: Financials | null
}

type Preset = 'all' | 'month' | 'quarter' | 'year'
const PRESETS: Preset[] = ['month', 'quarter', 'year', 'all']

// Light and dark brand maroon: each is at least 3:1 against the white card and against each other.
const INQUIRY_FILL = '#c27b6f'
const WON_FILL = '#5b211e'
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
  const weekday = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', timeZone: 'UTC' }).format(today)
  return `${weekday}, ${formatEthiopian(today)}`
}

function formatMoney(value: string | number, compact = false) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return String(value)
  return new Intl.NumberFormat(intlLocale(), {
    style: 'currency', currency: 'ETB',
    ...(compact && amount >= 100000 ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }),
  }).format(amount)
}

function monthLabel(iso: string, style: 'short' | 'long' = 'short') {
  const date = parseIsoDate(iso)
  if (!date) return iso
  return new Intl.DateTimeFormat(intlLocale(), { month: style, ...(style === 'long' ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(date)
}

function daysAwayLabel(days: number) {
  if (days === 0) return i18n.t('dashboard:days.today')
  if (days === 1) return i18n.t('dashboard:days.tomorrow')
  if (days < 14) return i18n.t('dashboard:days.inDays', { count: days })
  return i18n.t('dashboard:days.inWeeks', { count: Math.round(days / 7) })
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
      <span><i style={{ background: INQUIRY_FILL }} />{i18n.t('dashboard:trend.inquiries')}<b>{row.inquiries}</b></span>
      <span><i style={{ background: WON_FILL }} />{i18n.t('dashboard:trend.won')}<b>{row.won}</b></span>
    </div>
  )
}

function ProfitCard({ financials }: { financials: Financials }) {
  const { t } = useTranslation('dashboard')
  const income = Number(financials.income)
  const expense = Number(financials.expense)
  const net = Number(financials.net)
  const outstanding = income - Number(financials.collected)
  const scale = Math.max(income, expense, 1)
  return (
    <section className="dash-card dash-pl" aria-label={t('profit.label')}>
      <div className="dash-card-head">
        <h2>{t('profit.title')}</h2>
        <span className="dash-muted">{t('profit.exclVat')}</span>
      </div>
      <div className="dash-pl-figures">
        <Link to="/dashboard/invoices" className="dash-pl-figure">
          <span>{t('profit.income')}</span>
          <strong>{formatMoney(financials.income)}</strong>
          <small>{t('profit.invoices', { count: financials.invoice_count })} · {t('profit.collected', { amount: formatMoney(financials.collected) })}{outstanding > 0 ? t('profit.unpaid', { amount: formatMoney(outstanding) }) : ''}</small>
          <i className="dash-pl-bar is-income" style={{ width: `${(income / scale) * 100}%` }} aria-hidden="true" />
        </Link>
        <Link to="/dashboard/expenses" className="dash-pl-figure">
          <span>{t('profit.expense')}</span>
          <strong>{formatMoney(financials.expense)}</strong>
          <small>{t('profit.expenseDetail', { events: formatMoney(financials.event_costs), overhead: formatMoney(financials.overhead) })}</small>
          <i className="dash-pl-bar is-expense" style={{ width: `${(expense / scale) * 100}%` }} aria-hidden="true" />
        </Link>
        <div className={`dash-pl-figure dash-pl-net${net < 0 ? ' is-loss' : ''}`}>
          <span>{net < 0 ? t('profit.netLoss') : t('profit.netGain')}</span>
          <strong>{formatMoney(net)}</strong>
          <small>{financials.margin === null ? t('profit.noIncome') : t('profit.margin', { margin: financials.margin })}</small>
        </div>
      </div>
      {Number(financials.unbilled_commitments) > 0 && (
        <p className="dash-pl-note">
          <Link to="/dashboard/purchase-orders?status=approved" className="dash-link">{formatMoney(financials.unbilled_commitments)}</Link> {t('profit.committed')}
        </p>
      )}
    </section>
  )
}

export function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const profile = useProfile()
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
        if (response.status === 401) {
          await logout()
          navigate('/login', { replace: true })
          return
        }
        throw new Error(body?.message || body?.detail || i18n.t('dashboard:loadFailed'))
      }
      const data = body?.data as DashboardData | undefined
      if (!data || typeof data !== 'object') {
        throw new Error(i18n.t('dashboard:badResponse'))
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
    const activeEvents = summary?.active_events ?? dashboard.active_events
    const tiles: StatTile[] = []
    if (summary) {
      tiles.push(
        { label: t('tiles.openLeads'), value: summary.active_leads.toLocaleString(), detail: t('tiles.inquiriesInRange', { count: summary.total_leads }), icon: Ticket01Icon, href: '/dashboard/leads' },
        { label: t('tiles.won'), value: summary.won_leads.toLocaleString(), detail: t('tiles.wonDetail', { rate: summary.conversion_rate, lost: summary.lost_leads }), icon: UserGroupIcon },
      )
    }
    if (activeEvents !== null && activeEvents !== undefined) {
      tiles.push({ label: t('tiles.activeEvents'), value: activeEvents.toLocaleString(), detail: t('tiles.activeEventsDetail'), icon: Calendar03Icon })
    }
    if (!receivables) return tiles
    return [
      ...tiles,
      { label: t('tiles.outstanding'), value: formatMoney(receivables.outstanding_total, true), detail: t('tiles.unpaidInvoices', { count: receivables.outstanding_count }), icon: Invoice01Icon, href: '/dashboard/invoices' },
      receivables.overdue_count > 0
        ? { label: t('tiles.overdue'), value: formatMoney(receivables.overdue_total, true), detail: t('tiles.pastDue', { count: receivables.overdue_count }), icon: Alert02Icon, tone: 'warning', href: '/dashboard/invoices' }
        : { label: t('tiles.overdue'), value: formatMoney(0), detail: t('tiles.nothingPastDue'), icon: CheckmarkCircle02Icon, tone: 'good' },
    ]
  }, [dashboard, t])

  const maxStage = Math.max(1, ...(dashboard?.status_breakdown?.map((item) => item.count) ?? []))
  const maxActive = Math.max(1, ...(dashboard?.sales_performance?.map((person) => person.active_leads + person.won_leads) ?? []))
  const hasTrend = dashboard?.monthly_inquiries?.some((month) => month.inquiries > 0) ?? false
  const dueThisWeek = dashboard?.receivables?.due_this_week_count ?? 0
  const showLeads = Boolean(dashboard?.summary && dashboard.status_breakdown && dashboard.monthly_inquiries)
  const showEvents = Boolean(dashboard?.upcoming_events)
  const showPeople = Boolean(dashboard?.sales_performance)
  const canOpenProjects = can(profile, 'projects')

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Hadafe Nefs" />

      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="dash mx-auto max-w-7xl">
          <div className="dash-header">
            <div>
              <p className="dash-eyebrow">{formatToday()}</p>
              <h1 className="dash-title">{t('title')}</h1>
            </div>
            {dashboard?.summary && <span className="dash-scope">{dashboard.scope === 'all' ? t('scopeAll') : t('scopeMine')}</span>}
          </div>

          <section className="dash-filters" aria-label={t('filters.label')}>
            <div className="dash-presets" role="group" aria-label={t('filters.range')}>
              {PRESETS.map((item) => (
                <button key={item} type="button" aria-pressed={preset === item} className={preset === item ? 'is-active' : ''} onClick={() => choosePreset(item)}>
                  {t(`presets.${item}`)}
                </button>
              ))}
            </div>
            <div className="dash-range">
              <EthiopianDateInput aria-label={t('filters.fromDate')} value={startDate} max={endDate || undefined} onChange={(iso) => { setStartDate(iso); setPreset(null) }} showChurchDays={false} placeholder={t('filters.from')} />
              <span aria-hidden="true">→</span>
              <EthiopianDateInput aria-label={t('filters.throughDate')} value={endDate} min={startDate || undefined} onChange={(iso) => { setEndDate(iso); setPreset(null) }} showChurchDays={false} placeholder={t('filters.today')} />
            </div>
            <p className="dash-filter-note">{[
              dashboard?.summary && t('filters.leadsNote'),
              dashboard?.financials && t('filters.financialsNote'),
              dashboard?.receivables && t('filters.receivablesNote'),
              dashboard?.active_events !== null && dashboard?.active_events !== undefined && !dashboard?.summary && t('filters.eventsNote'),
            ].filter(Boolean).join(' · ')}</p>
          </section>

          {error && (
            <section className="dashboard-message dashboard-message--error" role="alert">
              <div><strong>{t('loadError')}</strong><p>{error}</p></div>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>{t('actions.retry', { ns: 'common' })} <span>↻</span></button>
            </section>
          )}

          {loading && !dashboard && <div className="o-form-loading" role="status" aria-label={t('loading')}><span /><span /><span /></div>}

          {dashboard && (
            <div className={`dash-body${loading ? ' is-refreshing' : ''}`} aria-busy={loading}>
              <section aria-label={t('tiles.label')} className="dash-tiles">
                {tiles.map((tile) => <StatTileCard key={tile.label} tile={tile} />)}
              </section>

              {dashboard.financials && <ProfitCard financials={dashboard.financials} />}

              {showLeads && <section className="dash-grid dash-grid--trend">
                <article className="dash-card">
                  <div className="dash-card-head">
                    <div>
                      <h2>{t('trend.title')}</h2>
                      <div className="dash-legend">
                        <span><i style={{ background: INQUIRY_FILL }} />{t('trend.inquiries')}</span>
                        <span><i style={{ background: WON_FILL }} />{t('trend.won')}</span>
                      </div>
                    </div>
                    <div className="dash-toggle" role="group" aria-label={t('trend.showAs')}>
                      <button type="button" aria-pressed={trendView === 'chart'} className={trendView === 'chart' ? 'is-active' : ''} onClick={() => setTrendView('chart')}>{t('trend.chart')}</button>
                      <button type="button" aria-pressed={trendView === 'table'} className={trendView === 'table' ? 'is-active' : ''} onClick={() => setTrendView('table')}>{t('trend.table')}</button>
                    </div>
                  </div>
                  {!hasTrend ? <p className="dash-empty">{t('trend.empty')}</p> : trendView === 'chart' ? (
                    <div className="dash-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.monthly_inquiries ?? []} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                          <CartesianGrid vertical={false} stroke="#efede5" />
                          <XAxis dataKey="month" tickFormatter={(value: string) => monthLabel(value)} tickLine={false} axisLine={{ stroke: '#e5e1d6' }} tick={{ fill: '#77766c', fontSize: 12 }} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#9a978b', fontSize: 12 }} width={44} />
                          <Tooltip content={MonthTooltip} cursor={{ fill: 'rgba(91, 33, 30, .06)' }} />
                          <Bar dataKey="inquiries" isAnimationActive={false} name={t('trend.inquiries')} fill={INQUIRY_FILL} radius={[4, 4, 0, 0]} maxBarSize={22} />
                          <Bar dataKey="won" isAnimationActive={false} name={t('trend.won')} fill={WON_FILL} radius={[4, 4, 0, 0]} maxBarSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <table className="dash-table dash-table--compact">
                      <thead><tr><th scope="col">{t('trend.month')}</th><th scope="col" className="o-num">{t('trend.inquiries')}</th><th scope="col" className="o-num">{t('trend.won')}</th></tr></thead>
                      <tbody>{(dashboard.monthly_inquiries ?? []).map((month) => (
                        <tr key={month.month}><td>{monthLabel(month.month, 'long')}</td><td className="o-num">{month.inquiries}</td><td className="o-num">{month.won}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                </article>

                <article className="dash-card">
                  <div className="dash-card-head">
                    <h2>{t('pipeline.title')}</h2>
                    <Link to="/dashboard/leads" className="dash-link">{t('pipeline.openBoard')}</Link>
                  </div>
                  {dashboard.summary?.total_leads === 0 ? <p className="dash-empty">{t('pipeline.empty')}</p> : (
                    <ul className="dash-stages">
                      {(dashboard.status_breakdown ?? []).map((item) => (
                        <li key={item.status} className={item.count === 0 ? 'is-zero' : ''}>
                          <span className="dash-stage-label">{leadStatusLabel(item.status, item.label)}</span>
                          <span className="dash-stage-track">
                            {item.count > 0 && <span style={{ width: `${(item.count / maxStage) * 100}%`, background: closedStages.has(item.status) ? CLOSED_FILL : WON_FILL }} />}
                          </span>
                          <strong>{item.count}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </section>}

              {(showEvents || showPeople) && <section className={`dash-grid${showEvents && showPeople ? ' dash-grid--even' : ''}`}>
                {showEvents && <article className="dash-card">
                  <div className="dash-card-head">
                    <h2>{t('events.title')}</h2>
                    {dueThisWeek > 0 && <span className="dash-chip is-warning"><HugeiconsIcon icon={Alert02Icon} className="size-3.5" strokeWidth={2} aria-hidden="true" />{t('events.dueThisWeek', { amount: formatMoney(dashboard.receivables?.due_this_week_total ?? 0) })}</span>}
                  </div>
                  {!dashboard.upcoming_events?.length ? <p className="dash-empty">{t('events.empty')}</p> : (
                    <ul className="dash-events">
                      {dashboard.upcoming_events.map((event) => {
                        const progress = event.tasks_total ? Math.round((event.tasks_done / event.tasks_total) * 100) : 0
                        const date = parseIsoDate(event.event_date)
                        return (
                          <li key={event.id}>
                            <div className="dash-event-date" aria-hidden="true">
                              <strong>{date?.getUTCDate()}</strong>
                              <span>{date ? new Intl.DateTimeFormat(intlLocale(), { month: 'short', timeZone: 'UTC' }).format(date) : ''}</span>
                            </div>
                            <div className="dash-event-main">
                              <div className="dash-event-top">
                                {event.project_id && canOpenProjects
                                  ? <Link to={`/dashboard/projects/${event.project_id}`}>{event.name}</Link>
                                  : <strong>{event.name}</strong>}
                                <span className={event.days_away < 14 ? 'is-soon' : ''}>{daysAwayLabel(event.days_away)}</span>
                              </div>
                              <small>{formatDualDate(event.event_date)}{event.location ? ` · ${event.location}` : ''}</small>
                              <div className="dash-event-meta">
                                <span className="dash-meter" aria-label={t('events.tasksComplete', { done: event.tasks_done, total: event.tasks_total })}>
                                  <span style={{ width: `${progress}%` }} />
                                </span>
                                <span>{event.tasks_total ? t('events.tasks', { done: event.tasks_done, total: event.tasks_total }) : t('events.noTasks')}</span>
                                {!dashboard.receivables ? null : event.invoice_count === 0
                                  ? <span className="dash-chip">{t('events.noInvoice')}</span>
                                  : event.unpaid_count > 0
                                    ? <span className="dash-chip is-warning">{t('events.unpaid', { count: event.unpaid_count })}</span>
                                    : <span className="dash-chip is-good">{t('events.paid')}</span>}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </article>}

                {showPeople && <article className="dash-card">
                  <div className="dash-card-head">
                    <h2>{t('performance.title')}</h2>
                    <div className="dash-legend">
                      <span><i style={{ background: INQUIRY_FILL }} />{t('performance.open')}</span>
                      <span><i style={{ background: WON_FILL }} />{t('performance.won')}</span>
                    </div>
                  </div>
                  {!dashboard.sales_performance?.length ? <p className="dash-empty">{t('performance.empty')}</p> : (
                    <ul className="dash-people">
                      {dashboard.sales_performance.map((person) => (
                        <li key={person.sales_person_id}>
                          <span className="o-avatar" style={{ background: WON_FILL }} aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span>
                          <div>
                            <div className="dash-person-top"><strong>{person.name}</strong><span>{t('performance.conversion', { rate: person.conversion_rate })}</span></div>
                            <div className="dash-stack" aria-label={t('performance.stack', { open: person.active_leads, won: person.won_leads })}>
                              {person.active_leads > 0 && <span style={{ width: `${(person.active_leads / maxActive) * 100}%`, background: INQUIRY_FILL }} />}
                              {person.won_leads > 0 && <span style={{ width: `${(person.won_leads / maxActive) * 100}%`, background: WON_FILL }} />}
                            </div>
                            <small>{t('performance.breakdown', { open: person.active_leads, won: person.won_leads, lost: person.lost_leads })}</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>}
              </section>}

              {dashboard.recent_leads && <section className="dash-card dash-card--flush">
                <div className="dash-card-head">
                  <h2>{t('recent.title')}</h2>
                  <Link to="/dashboard/leads" className="dash-link">{t('recent.allLeads')}</Link>
                </div>
                {dashboard.recent_leads.length === 0 ? <p className="dash-empty">{t('recent.empty')}</p> : (
                  <div className="overflow-x-auto">
                    <table className="dash-table">
                      <thead><tr><th scope="col">{t('recent.customer')}</th><th scope="col">{t('recent.celebration')}</th><th scope="col">{t('recent.eventDate')}</th><th scope="col">{t('recent.salesPerson')}</th><th scope="col">{t('recent.stage')}</th></tr></thead>
                      <tbody>
                        {dashboard.recent_leads.map((lead) => (
                          <tr key={lead.id} onClick={() => navigate(`/dashboard/leads/${lead.id}`)}>
                            <td><Link to={`/dashboard/leads/${lead.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>{lead.customer_name}</Link><small>{lead.phone}</small></td>
                            <td><span className="dash-row-title">{lead.plan_name}</span>{lead.package_name && <small>{lead.package_name}</small>}</td>
                            <td className="dash-muted">{formatDualDate(lead.plan_date)}</td>
                            <td className="dash-muted">{lead.sales_person ?? t('recent.unassigned')}</td>
                            <td><span className={`dashboard-lead-status dashboard-lead-status--${lead.status}`}>{leadStatusLabel(lead.status, lead.status_label)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
