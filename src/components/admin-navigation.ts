import {
  Calendar03Icon,
  ChartBarLineIcon,
  DashboardSquare01Icon,
  Settings01Icon,
  Ticket01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import type { SideNavItem } from '@/components/side-nav'

export const adminNavigationItems: SideNavItem[] = [
  { menu: 'Dashboard', icon: DashboardSquare01Icon, route: '/dashboard', exact: true },
  { menu: 'Leads', icon: UserGroupIcon, route: '/dashboard/leads', exact: true },
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
