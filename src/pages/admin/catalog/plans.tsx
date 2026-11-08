import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/i18n'
import { Link } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { EthiopianCross } from '@/components/company-profile/EthiopianCross'
import { apiRequest } from '@/lib/api-request'
import { canManageCatalog, useProfile } from '@/lib/use-profile'
import { ordinal, type CatalogPlan } from './types'


const SHOWN_EVENT_TYPES = 3

function PlanCard({ plan, index, canManage }: { plan: CatalogPlan; index: number; canManage: boolean }) {
  const { t } = useTranslation('catalog')
  const href = `/dashboard/catalog/plans/${plan.id}`
  const hidden = plan.event_types.length - SHOWN_EVENT_TYPES

  return (
    <article className="cat-plan">
      <Link to={href} className="cat-plan-media" tabIndex={-1} aria-hidden="true">
        {plan.image_url
          ? <img src={plan.image_url} alt="" loading="lazy" />
          : <span className="cat-plan-placeholder"><EthiopianCross size={30} /></span>}
        <span className="cat-plan-number">{ordinal(index)}</span>
      </Link>

      <div className="cat-plan-body">
        <h2 className="cat-plan-name"><Link to={href}>{plan.name}</Link></h2>
        {plan.description
          ? <p className="cat-plan-description">{plan.description}</p>
          : <p className="cat-plan-description is-missing">{t('plans.noDescription')}</p>}

        <div className="cat-chips">
          {plan.event_types.length
            ? plan.event_types.slice(0, SHOWN_EVENT_TYPES).map((item) => <span key={item.id ?? item.name} className="cat-chip">{item.name}</span>)
            : <span className="cat-muted">{t('plans.noEventTypes')}</span>}
          {hidden > 0 && <span className="cat-chip is-more">+{hidden}</span>}
        </div>

        <footer className="cat-plan-foot">
          <span className="cat-plan-stat">{t('packageCount', { count: plan.packages.length })} · {t('leadCount', { count: plan.lead_count })}</span>
          {canManage && <Link to={`/dashboard/catalog/packages/new?plan=${plan.id}`} className="cat-plan-add" aria-label={t('plans.addPackageTo', { plan: plan.name })}>{t('plans.addPackage')}</Link>}
        </footer>
      </div>
    </article>
  )
}

export function CatalogPlansPage() {
  const profile = useProfile()
  const { t } = useTranslation('catalog')
  const canManage = canManageCatalog(profile)
  const [plans, setPlans] = useState<CatalogPlan[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<CatalogPlan[]>('/event/catalog/plans/', { signal: controller.signal, fallback: t('plans.loadFailed') })
      .then(setPlans)
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [t])

  const needle = query.trim().toLowerCase()
  const shown = (plans ?? []).filter((plan) => !needle
    || plan.name.toLowerCase().includes(needle)
    || plan.event_types.some((item) => item.name.toLowerCase().includes(needle))
    || plan.packages.some((item) => item.name.toLowerCase().includes(needle)))

  const totals = (plans ?? []).reduce(
    (sum, plan) => ({
      packages: sum.packages + plan.packages.length,
      eventTypes: sum.eventTypes + plan.event_types.length,
      leads: sum.leads + plan.lead_count,
    }),
    { packages: 0, eventTypes: 0, leads: 0 },
  )

  return (
    <AdminShell>
      <div className="dash cat-page">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">{t('eyebrow')}</p>
            <h1 className="dash-title">{t('plans.title')}</h1>
            <p className="cat-lede">{t('plans.lede')}</p>
          </div>
          {canManage && <Link to="/dashboard/catalog/plans/new" className="o-btn o-btn-primary">{t('plans.newPlan')}</Link>}
        </div>

        {plans && plans.length > 0 && (
          <dl className="cat-summary">
            <div><dt>{t('plans.summaryPlans')}</dt><dd>{plans.length}</dd></div>
            <div><dt>{t('plans.summaryPackages')}</dt><dd>{totals.packages}</dd></div>
            <div><dt>{t('plans.summaryEventTypes')}</dt><dd>{totals.eventTypes}</dd></div>
            <div><dt>{t('plans.summaryLeads')}</dt><dd>{formatNumber(totals.leads)}</dd></div>
          </dl>
        )}

        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder={t('plans.searchPlaceholder')} aria-label={t('plans.searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} />
          {plans && <span className="dash-scope">{t('plans.shownOf', { shown: shown.length, total: plans.length })}</span>}
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!plans && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
        {plans && shown.length === 0 && (
          <div className="cat-empty">
            <EthiopianCross size={34} />
            <p>{plans.length ? t('plans.noMatch') : t('plans.empty')}</p>
            {!plans.length && canManage && <Link to="/dashboard/catalog/plans/new" className="o-btn o-btn-primary">{t('plans.newPlan')}</Link>}
          </div>
        )}

        <div className="cat-plan-list">
          {shown.map((plan) => (
            <PlanCard key={plan.id} plan={plan} index={(plans ?? []).indexOf(plan)} canManage={canManage} />
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
