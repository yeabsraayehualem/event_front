import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { Link, useNavigate } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { EthiopianCross } from '@/components/company-profile/EthiopianCross'
import { apiRequest } from '@/lib/api-request'
import { canManageCatalog, useProfile } from '@/lib/use-profile'
import { byPrice, formatPrice, ordinal, type CatalogPackage } from './types'

type View = 'tiers' | 'table'
const VIEW_KEY = 'catalog.packages.view'
const SHOWN_SERVICES = 3

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'tiers'
  } catch {
    return 'tiers'
  }
}

type PlanGroup = { id: number; name: string; packages: CatalogPackage[]; favouriteId: number | null }

/** Group packages by plan, cheapest first, and mark the one clients pick most (if there's a clear leader). */
function groupByPlan(packages: CatalogPackage[]): PlanGroup[] {
  const groups = new Map<number, PlanGroup>()
  for (const item of packages) {
    const group = groups.get(item.plan) ?? { id: item.plan, name: item.plan_name, packages: [], favouriteId: null }
    group.packages.push(item)
    groups.set(item.plan, group)
  }
  return [...groups.values()]
    .map((group) => {
      const packagesByPrice = [...group.packages].sort(byPrice)
      const [first, second] = [...group.packages].sort((a, b) => b.lead_count - a.lead_count)
      const clearLeader = first && first.lead_count > 0 && (!second || first.lead_count > second.lead_count)
      return { ...group, packages: packagesByPrice, favouriteId: clearLeader ? first.id : null }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function TierCard({ item, index, favourite }: { item: CatalogPackage; index: number; favourite: boolean }) {
  const { t } = useTranslation('catalog')
  const extra = item.contents.length - SHOWN_SERVICES
  return (
    <Link to={`/dashboard/catalog/packages/${item.id}`} className={favourite ? 'cat-tier is-favourite' : 'cat-tier'}>
      <div className="cat-tier-top">
        <span className="cat-tier-num">{ordinal(index)}</span>
        {favourite && <span className="cat-tier-badge">{t('packages.mostChosen')}</span>}
      </div>
      <h3 className="cat-tier-name">{item.name}</h3>
      {item.contents.length ? (
        <ul className="cat-tier-services" aria-label={t('packages.includedServices')}>
          {item.contents.slice(0, SHOWN_SERVICES).map((content) => <li key={content.id}>{content.name}</li>)}
          {extra > 0 && <li className="is-more">{t('more', { count: extra })}</li>}
        </ul>
      ) : (
        <p className="cat-tier-services-empty">{t('packages.noServices')}</p>
      )}
      <div className="cat-tier-foot">
        <span>{t('serviceCount', { count: item.contents.length })} · {t('leadCount', { count: item.lead_count })}</span>
        <span className="cat-tier-open" aria-hidden="true">→</span>
      </div>
    </Link>
  )
}

export function CatalogPackagesPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('catalog')
  const profile = useProfile()
  const canManage = canManageCatalog(profile)
  const [packages, setPackages] = useState<CatalogPackage[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [planFilter, setPlanFilter] = useState<number | null>(null)
  const [view, setView] = useState<View>(readView)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<CatalogPackage[]>('/event/catalog/packages/', { signal: controller.signal, fallback: i18n.t('catalog:packages.loadFailed') })
      .then(setPackages)
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [])

  function changeView(next: View) {
    setView(next)
    try { localStorage.setItem(VIEW_KEY, next) } catch { /* storage unavailable; the choice just isn't remembered */ }
  }

  const allGroups = useMemo(() => groupByPlan(packages ?? []), [packages])
  const needle = query.trim().toLowerCase()
  const matches = (item: CatalogPackage) => !needle
    || item.name.toLowerCase().includes(needle)
    || item.plan_name.toLowerCase().includes(needle)
    || item.contents.some((content) => content.name.toLowerCase().includes(needle))

  const groups = allGroups
    .filter((group) => planFilter === null || group.id === planFilter)
    .map((group) => ({ ...group, packages: group.packages.filter(matches) }))
    .filter((group) => group.packages.length > 0)
  const shownCount = groups.reduce((sum, group) => sum + group.packages.length, 0)

  return (
    <AdminShell>
      <div className="dash cat-page">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">{t('eyebrow')}</p>
            <h1 className="dash-title">{t('packages.title')}</h1>
            <p className="cat-lede">{t('packages.lede')}</p>
          </div>
          {canManage && <Link to="/dashboard/catalog/packages/new" className="o-btn o-btn-primary">{t('packages.newPackage')}</Link>}
        </div>

        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder={t('packages.searchPlaceholder')} aria-label={t('packages.searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} />
          {packages && <span className="dash-scope">{t('shownOf', { ns: 'common', shown: shownCount, total: packages.length })}</span>}
          <div className="cat-view-toggle" role="group" aria-label={t('packages.layout')}>
            <button type="button" aria-pressed={view === 'tiers'} onClick={() => changeView('tiers')}>{t('packages.tiers')}</button>
            <button type="button" aria-pressed={view === 'table'} onClick={() => changeView('table')}>{t('packages.table')}</button>
          </div>
        </div>

        {allGroups.length > 1 && (
          <div className="cat-filter" role="group" aria-label={t('packages.filterByPlan')}>
            <button type="button" aria-pressed={planFilter === null} onClick={() => setPlanFilter(null)}>{t('packages.allPlans')}</button>
            {allGroups.map((group) => (
              <button key={group.id} type="button" aria-pressed={planFilter === group.id} onClick={() => setPlanFilter(group.id)}>
                {group.name} <span>{group.packages.length}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!packages && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
        {packages && shownCount === 0 && (
          <div className="cat-empty">
            <EthiopianCross size={34} />
            <p>{packages.length ? t('packages.noMatch') : t('packages.empty')}</p>
            {!packages.length && canManage && <Link to="/dashboard/catalog/packages/new" className="o-btn o-btn-primary">{t('packages.newPackage')}</Link>}
          </div>
        )}

        {packages && shownCount > 0 && view === 'tiers' && groups.map((group) => (
          <section key={group.id} className="cat-pkg-group" aria-labelledby={`plan-${group.id}`}>
            <header className="cat-pkg-group-head">
              <div>
                <h2 id={`plan-${group.id}`}>{group.name}</h2>
                <span>{t('packageCount', { count: group.packages.length })}</span>
              </div>
              <div className="cat-plan-actions">
                {canManage && <Link to={`/dashboard/catalog/packages/new?plan=${group.id}`} className="o-btn o-btn-secondary o-btn-sm">{t('packages.addPackage')}</Link>}
                <Link to={`/dashboard/catalog/plans/${group.id}`} className="o-btn o-btn-link o-btn-sm">{t('packages.viewPlan')} <span aria-hidden="true">→</span></Link>
              </div>
            </header>
            <div className="cat-tier-grid">
              {group.packages.map((item, index) => (
                <TierCard key={item.id} item={item} index={index} favourite={item.id === group.favouriteId} />
              ))}
            </div>
          </section>
        ))}

        {packages && shownCount > 0 && view === 'table' && (
          <section className="dash-card dash-card--flush">
            <div className="overflow-x-auto">
              <table className="dash-table">
                <thead><tr><th scope="col">{t('packages.package')}</th><th scope="col">{t('packages.plan')}</th><th scope="col">{t('packages.includedServices')}</th><th scope="col" className="o-num">{t('packages.leads')}</th><th scope="col" className="o-num">{t('packages.price')}</th></tr></thead>
                <tbody>
                  {groups.flatMap((group) => group.packages).map((item) => (
                    <tr key={item.id} onClick={() => navigate(`/dashboard/catalog/packages/${item.id}`)}>
                      <td><Link to={`/dashboard/catalog/packages/${item.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>{item.name}</Link></td>
                      <td className="dash-muted">{item.plan_name}</td>
                      <td>
                        <div className="cat-tags">
                          {item.contents.slice(0, 3).map((content) => <span key={content.id} className="o-tag">{content.name}</span>)}
                          {item.contents.length > 3 && <span className="cat-muted">+{item.contents.length - 3}</span>}
                          {item.contents.length === 0 && <span className="cat-muted">{t('packages.noneYet')}</span>}
                        </div>
                      </td>
                      <td className="o-num dash-muted">{item.lead_count}</td>
                      <td className="o-num"><strong>{formatPrice(item.price)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  )
}
