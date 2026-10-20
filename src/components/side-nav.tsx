import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { cn } from 'cn'

export type SideNavItem = {
  menu: string
  icon: IconSvgElement
  route?: string
  exact?: boolean
  children?: SideNavItem[]
}

type SideNavProps = {
  items: SideNavItem[]
  title?: string
  className?: string
}

function isRouteActive(route: string | undefined, pathname: string, exact = false) {
  return Boolean(
    route &&
      (pathname === route ||
        (!exact && route !== '/' && pathname.startsWith(`${route}/`)))
  )
}

function hasActiveChild(items: SideNavItem[], pathname: string): boolean {
  return items.some(
    (item) =>
      isRouteActive(item.route, pathname, item.exact) ||
      (item.children && hasActiveChild(item.children, pathname))
  )
}

function SideNavEntry({
  item,
  depth = 0,
}: {
  item: SideNavItem
  depth?: number
}) {
  const { pathname } = useLocation()
  const hasChildren = Boolean(item.children?.length)
  const active = isRouteActive(item.route, pathname, item.exact)
  const childActive = hasChildren && hasActiveChild(item.children!, pathname)
  const highlighted = active || Boolean(childActive)
  const [expansion, setExpansion] = useState<{
    pathname: string
    expanded: boolean
  } | null>(null)
  const expanded =
    expansion?.pathname === pathname
      ? expansion.expanded
      : Boolean(childActive)
  const childListId = useId()

  const rowClassName = cn(
    'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors',
    depth > 0 && 'min-h-10 text-[13px]',
    highlighted
      ? 'bg-indigo-50 text-indigo-700 side-nav-entry--active'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
    'side-nav-entry',
    depth > 0 && 'side-nav-entry--child',
  )

  return (
    <li>
      <div className="flex items-center gap-1">
        {item.route ? (
          <Link
            to={item.route}
            aria-current={active ? 'page' : undefined}
            className={cn(rowClassName, hasChildren && 'flex-1')}
          >
            <HugeiconsIcon
              icon={item.icon}
              className={cn('size-[18px] shrink-0', highlighted && 'text-indigo-700')}
              strokeWidth={1.8}
            />
            <span className="min-w-0 flex-1 truncate">{item.menu}</span>
          </Link>
        ) : hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={childListId}
            onClick={() => setExpansion({ pathname, expanded: !expanded })}
            className={rowClassName}
            aria-current={highlighted ? 'location' : undefined}
          >
            <HugeiconsIcon
              icon={item.icon}
              className={cn('size-[18px] shrink-0', highlighted && 'text-indigo-700')}
              strokeWidth={1.8}
            />
            <span className="min-w-0 flex-1 truncate">{item.menu}</span>
            <HugeiconsIcon
              icon={expanded ? ArrowDown01Icon : ArrowRight01Icon}
              className="size-4 shrink-0"
              strokeWidth={2}
            />
          </button>
        ) : (
          <div className={rowClassName}>
            <HugeiconsIcon
              icon={item.icon}
              className="size-[18px] shrink-0"
              strokeWidth={1.8}
            />
            <span className="min-w-0 flex-1 truncate">{item.menu}</span>
          </div>
        )}
        {hasChildren && item.route && (
          <button
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.menu}`}
            aria-expanded={expanded}
            aria-controls={childListId}
            onClick={() => setExpansion({ pathname, expanded: !expanded })}
            className="side-nav-expand grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <HugeiconsIcon
              icon={expanded ? ArrowDown01Icon : ArrowRight01Icon}
              className="size-4"
              strokeWidth={2}
            />
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <ul id={childListId} className="side-nav-children ml-5 mt-1 space-y-1 border-l border-slate-200 pl-3">
          {item.children!.map((child) => (
            <SideNavEntry key={`${child.menu}-${child.route ?? ''}`} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function SideNav({
  items,
  title = 'Event Planner',
  className,
}: SideNavProps) {
  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'bahran-side-nav flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6',
        className
      )}
    >
      <Link to="/" className="side-nav-brand mb-9 flex items-center gap-3 px-2">
        <span className="side-nav-mark" aria-hidden="true">✥</span>
        <span className="truncate text-sm font-bold tracking-wide text-slate-800">
          {title}
        </span>
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {items.map((item) => (
            <SideNavEntry key={`${item.menu}-${item.route ?? ''}`} item={item} />
          ))}
        </ul>
      </nav>
    </aside>
  )
}
