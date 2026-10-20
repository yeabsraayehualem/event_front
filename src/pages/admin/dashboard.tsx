import {
  Calendar03Icon,
  ChartBarLineIcon,
  DashboardSquare01Icon,
  Settings01Icon,
  Ticket01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SideNav, type SideNavItem } from '@/components/side-nav'

const navigationItems: SideNavItem[] = [
  { menu: 'Dashboard', icon: DashboardSquare01Icon, route: '/dashboard' },
  {
    menu: 'Events',
    icon: Calendar03Icon,
    children: [
      { menu: 'All events', icon: Calendar03Icon, route: '/dashboard/events' },
      { menu: 'Create event', icon: Ticket01Icon, route: '/dashboard/events/create' },
    ],
  },
  { menu: 'Guests', icon: UserGroupIcon, route: '/dashboard/guests' },
  { menu: 'Reports', icon: ChartBarLineIcon, route: '/dashboard/reports' },
  { menu: 'Settings', icon: Settings01Icon, route: '/dashboard/settings' },
]

const attendanceData = [
  { day: 'Mon', attendees: 118 },
  { day: 'Tue', attendees: 164 },
  { day: 'Wed', attendees: 142 },
  { day: 'Thu', attendees: 218 },
  { day: 'Fri', attendees: 196 },
  { day: 'Sat', attendees: 284 },
  { day: 'Sun', attendees: 246 },
]

const eventTypeData = [
  { name: 'Conference', value: 38, color: '#4f46e5' },
  { name: 'Workshop', value: 27, color: '#8b5cf6' },
  { name: 'Community', value: 21, color: '#c4b5fd' },
  { name: 'Other', value: 14, color: '#e2e8f0' },
]

const recentEvents = [
  { name: 'Design Summit 2025', date: 'Jun 15, 2025', attendees: '248 / 300', status: 'Upcoming' },
  { name: 'Community Meetup', date: 'Jun 18, 2025', attendees: '86 / 120', status: 'Upcoming' },
  { name: 'Product Workshop', date: 'Jun 22, 2025', attendees: '54 / 60', status: 'Almost full' },
]

const stats = [
  { label: 'Total Leads', value: '24', change: '+12% this month', icon: Calendar03Icon },
  { label: 'Open Leads', value: '1,842', change: '+8.2% this month', icon: UserGroupIcon },
  { label: 'Won', value: '1,296', change: '+18% this month', icon: Ticket01Icon },
  { label: 'Lost', value: '86.4%', change: '+4.6% this month', icon: ChartBarLineIcon },
]



export function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideNav items={navigationItems} title="Event Planner" />

      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-indigo-700">
                Monday, June 9, 2025
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Dashboard
              </h1>
            </div>
          </header>

          <section aria-label="Event overview" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.02]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                    <HugeiconsIcon icon={stat.icon} className="size-5" strokeWidth={1.8} />
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs font-medium text-emerald-700">{stat.change}</p>
              </article>
            ))}
          </section>

          <section className="mb-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.02] sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">Attendance overview</h2>
                  <p className="mt-1 text-sm text-slate-500">Attendees across this week</p>
                </div>
                <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                  This week
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="attendees"
                      name="Attendees"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fill="url(#attendanceFill)"
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.02] sm:p-6">
              <div>
                <h2 className="font-semibold text-slate-900">Events by type</h2>
                <p className="mt-1 text-sm text-slate-500">Your event mix this year</p>
              </div>
              <div className="relative mx-auto mt-2 h-52 max-w-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={eventTypeData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={86}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {eventTypeData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold text-slate-900">24</span>
                  <span className="text-xs text-slate-500">Events</span>
                </div>
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                {eventTypeData.map((item) => (
                  <li key={item.name} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="flex-1">{item.name}</span>
                    <span className="font-semibold text-slate-800">{item.value}%</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
              <div>
                <h2 className="font-semibold text-slate-900">Upcoming events</h2>
                <p className="mt-1 text-sm text-slate-500">Keep an eye on what&apos;s next.</p>
              </div>
              <button type="button" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                View all
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-y border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Event</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Attendees</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentEvents.map((event) => (
                    <tr key={event.name}>
                      <td className="px-6 py-4 font-medium text-slate-800">{event.name}</td>
                      <td className="px-6 py-4 text-slate-500">{event.date}</td>
                      <td className="px-6 py-4 text-slate-600">{event.attendees}</td>
                      <td className="px-6 py-4">
                        <span
                          className={
                            event.status === 'Almost full'
                              ? 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700'
                              : 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'
                          }
                        >
                          {event.status}
                        </span>
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
