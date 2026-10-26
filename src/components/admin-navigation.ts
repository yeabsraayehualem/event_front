import { BitcoinEllipseFreeIcons, DashboardSquare01Icon, GearsIcon, MarketOrderIcon, MealScanIcon, Task01Icon, UserGroupIcon } from '@hugeicons/core-free-icons'
import type { SideNavItem } from '@/components/side-nav'

export const adminNavigationItems: SideNavItem[] = [
  { menu: 'Dashboard', icon: DashboardSquare01Icon, route: '/dashboard', exact: true },
  { menu: 'Leads', icon: UserGroupIcon, route: '/dashboard/leads', exact: true },
  { menu: "Invoices", icon: BitcoinEllipseFreeIcons, route: '/dashboard/invoices', exact: true },
  { menu: "Projects", icon: Task01Icon, route :"/dashboard/projects" },
  { menu: "Procurement", icon: MarketOrderIcon},
  { menu: "Caterers", icon:MealScanIcon},
  {menu: "Vedors",icon: MarketOrderIcon},
  { menu:"Users",icon:UserGroupIcon},
  { menu: "Settings", icon:GearsIcon}


]
