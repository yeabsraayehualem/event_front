import {
  BitcoinEllipseFreeIcons, Book02Icon, Calendar03Icon, CatalogueIcon, DashboardSquare01Icon, Invoice01Icon,
  MarketOrderIcon, MealScanIcon, PackageIcon, ServiceIcon, Task01Icon, UserGroupIcon, UserMultiple02Icon, UserSettings01Icon,
} from '@hugeicons/core-free-icons'
import type { SideNavItem } from '@/components/side-nav'
import { can, type Profile } from '@/lib/use-profile'

/** `module` is the access-table module (utils/rbac.py) a page belongs to; items the role can't open are hidden. */
export const adminNavigationItems: SideNavItem[] = [
  { menu: 'dashboard', icon: DashboardSquare01Icon, route: '/dashboard', exact: true, module: 'dashboard' },
  { menu: 'leads', icon: UserGroupIcon, route: '/dashboard/leads', exact: true, module: 'leads' },
  {
    menu: 'finance',
    icon: BitcoinEllipseFreeIcons,
    children: [
      { menu: 'invoices', icon: BitcoinEllipseFreeIcons, route: '/dashboard/invoices', module: 'invoices' },
      { menu: 'expenses', icon: Invoice01Icon, route: '/dashboard/expenses', module: 'expenses' },
    ],
  },
  { menu: 'projects', icon: Task01Icon, route: '/dashboard/projects', module: 'projects' },
  {
    menu: 'catalog',
    icon: CatalogueIcon,
    children: [
      { menu: 'plans', icon: Book02Icon, route: '/dashboard/catalog/plans', module: 'catalog' },
      { menu: 'packages', icon: PackageIcon, route: '/dashboard/catalog/packages', module: 'catalog' },
      { menu: 'services', icon: ServiceIcon, route: '/dashboard/catalog/services', module: 'catalog' },
    ],
  },
  {
    menu: 'procurement',
    icon: MarketOrderIcon,
    children: [
      { menu: 'purchaseOrders', icon: MarketOrderIcon, route: '/dashboard/purchase-orders', module: 'purchase_orders' },
      { menu: 'vendors', icon: MealScanIcon, route: '/dashboard/vendors', module: 'vendors' },
    ],
  },
  {
    menu: 'crew',
    icon: UserMultiple02Icon,
    children: [
      { menu: 'directory', icon: UserMultiple02Icon, route: '/dashboard/crew', module: 'crew' },
      { menu: 'eventSchedule', icon: Calendar03Icon, route: '/dashboard/crew-schedule', module: 'crew' },
      { menu: 'payroll', icon: Invoice01Icon, route: '/dashboard/payroll', module: 'payroll' },
    ],
  },
  { menu: 'users', icon: UserSettings01Icon, route: '/dashboard/users', module: 'users' },
]

/** The menu as this profile sees it: inaccessible items and empty groups removed. */
export function visibleNavigation(items: SideNavItem[], profile: Profile | null): SideNavItem[] {
  return items.flatMap((item) => {
    if (item.children) {
      const children = visibleNavigation(item.children, profile)
      return children.length ? [{ ...item, children }] : []
    }
    if (!item.route) return []
    return !item.module || can(profile, item.module) ? [item] : []
  })
}

/** Where this profile should land after signing in: the dashboard if allowed, else their first page. */
export function landingPath(profile: Profile | null): string {
  if (can(profile, 'dashboard')) return '/dashboard'
  const first = (function find(items: SideNavItem[]): string | undefined {
    for (const item of items) {
      if (item.route) return item.route
      const nested = item.children && find(item.children)
      if (nested) return nested
    }
    return undefined
  })(visibleNavigation(adminNavigationItems, profile))
  return first ?? '/dashboard/no-access'
}
