import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { apiRequest } from '@/lib/api-request'
import { canManageCatalog, useProfile } from '@/lib/use-profile'
import type { CatalogPlan } from './types'

export function CatalogPlansPage() {
  const profile = useProfile()
  const [plans, setPlans] = useState<CatalogPlan[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<CatalogPlan[]>('/event/catalog/plans/', { signal: controller.signal, fallback: 'Could not load plans.' })
      .then(setPlans)
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [])

  const needle = query.trim().toLowerCase()
  const shown = (plans ?? []).filter((plan) => !needle
    || plan.name.toLowerCase().includes(needle)
    || plan.event_types.some((item) => item.name.toLowerCase().includes(needle)))

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">Catalog</p>
            <h1 className="dash-title">Plans</h1>
          </div>
          {canManageCatalog(profile) && <Link to="/dashboard/catalog/plans/new" className="o-btn o-btn-primary">New plan</Link>}
        </div>
        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder="Search plans or event types…" aria-label="Search plans" value={query} onChange={(event) => setQuery(event.target.value)} />
          {plans && <span className="dash-scope">{shown.length} of {plans.length}</span>}
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!plans && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
        {plans && shown.length === 0 && <p className="dash-card dash-empty">{plans.length ? 'No plans match your search.' : 'No plans yet. Create the first one to start building your catalog.'}</p>}

        <div className="cat-kanban">
          {shown.map((plan) => (
            <Link key={plan.id} to={`/dashboard/catalog/plans/${plan.id}`} className="cat-card">
              <div className="cat-card-image">
                {plan.image_url ? <img src={plan.image_url} alt="" loading="lazy" /> : <span aria-hidden="true">{plan.name.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="cat-card-body">
                <strong>{plan.name}</strong>
                <div className="cat-tags">
                  {plan.event_types.length
                    ? plan.event_types.slice(0, 4).map((item) => <span key={item.id} className="o-tag">{item.name}</span>)
                    : <span className="cat-muted">No event types yet</span>}
                  {plan.event_types.length > 4 && <span className="cat-muted">+{plan.event_types.length - 4}</span>}
                </div>
                <div className="cat-card-meta">
                  <span>{plan.packages.length} {plan.packages.length === 1 ? 'package' : 'packages'}</span>
                  <span>{plan.lead_count} {plan.lead_count === 1 ? 'lead' : 'leads'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
