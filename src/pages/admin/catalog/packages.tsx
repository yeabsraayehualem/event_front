import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { apiRequest } from '@/lib/api-request'
import { canManageCatalog, useProfile } from '@/lib/use-profile'
import { formatPrice, type CatalogPackage } from './types'

export function CatalogPackagesPage() {
  const navigate = useNavigate()
  const profile = useProfile()
  const [packages, setPackages] = useState<CatalogPackage[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<CatalogPackage[]>('/event/catalog/packages/', { signal: controller.signal, fallback: 'Could not load packages.' })
      .then(setPackages)
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [])

  const needle = query.trim().toLowerCase()
  const shown = (packages ?? []).filter((item) => !needle
    || item.name.toLowerCase().includes(needle)
    || item.plan_name.toLowerCase().includes(needle)
    || item.contents.some((content) => content.name.toLowerCase().includes(needle)))

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">Catalog</p>
            <h1 className="dash-title">Packages</h1>
          </div>
          {canManageCatalog(profile) && <Link to="/dashboard/catalog/packages/new" className="o-btn o-btn-primary">New package</Link>}
        </div>
        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder="Search packages, plans or services…" aria-label="Search packages" value={query} onChange={(event) => setQuery(event.target.value)} />
          {packages && <span className="dash-scope">{shown.length} of {packages.length}</span>}
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!packages && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

        {packages && (
          <section className="dash-card dash-card--flush">
            {shown.length === 0 ? <p className="dash-empty">{packages.length ? 'No packages match your search.' : 'No packages yet.'}</p> : (
              <div className="overflow-x-auto">
                <table className="dash-table">
                  <thead><tr><th scope="col">Package</th><th scope="col">Plan</th><th scope="col">Included services</th><th scope="col" className="o-num">Leads</th><th scope="col" className="o-num">Price</th></tr></thead>
                  <tbody>
                    {shown.map((item) => (
                      <tr key={item.id} onClick={() => navigate(`/dashboard/catalog/packages/${item.id}`)}>
                        <td><Link to={`/dashboard/catalog/packages/${item.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>{item.name}</Link></td>
                        <td className="dash-muted">{item.plan_name}</td>
                        <td>
                          <div className="cat-tags">
                            {item.contents.slice(0, 3).map((content) => <span key={content.id} className="o-tag">{content.name}</span>)}
                            {item.contents.length > 3 && <span className="cat-muted">+{item.contents.length - 3}</span>}
                            {item.contents.length === 0 && <span className="cat-muted">None yet</span>}
                          </div>
                        </td>
                        <td className="o-num dash-muted">{item.lead_count}</td>
                        <td className="o-num"><strong>{formatPrice(item.price)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </AdminShell>
  )
}
