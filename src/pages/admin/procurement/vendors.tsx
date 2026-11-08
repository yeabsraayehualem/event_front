import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { apiRequest } from '@/lib/api-request'
import { formatMoney, type VendorListItem } from './types'

type Category = { id: number; name: string; vendor_count: number }

export function VendorsPage() {
  const { t } = useTranslation('procurement')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') ?? ''
  const [vendors, setVendors] = useState<VendorListItem[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<VendorListItem[]>('/procurement/vendors/', { signal: controller.signal, fallback: t('vendors.loadFailed') }),
      apiRequest<Category[]>('/procurement/categories/', { signal: controller.signal, fallback: t('vendors.loadCategories') }),
    ])
      .then(([loadedVendors, loadedCategories]) => { setVendors(loadedVendors); setCategories(loadedCategories) })
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [t])

  const needle = query.trim().toLowerCase()
  const shown = (vendors ?? []).filter((vendor) => (showInactive || vendor.active)
    && (!category || String(vendor.category) === category)
    && (!needle || [vendor.name, vendor.contact_person, vendor.phone, vendor.email].some((value) => value.toLowerCase().includes(needle))))

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">{t('eyebrow')}</p>
            <h1 className="dash-title">{t('vendors.title')}</h1>
          </div>
          <Link to="/dashboard/vendors/new" className="o-btn o-btn-primary">{t('vendors.newVendor')}</Link>
        </div>

        <div className="proc-chips" role="group" aria-label={t('vendors.filterByCategory')}>
          <button type="button" className={!category ? 'is-active' : ''} onClick={() => setSearchParams({})}>{t('vendors.all')}</button>
          {categories.map((item) => (
            <button key={item.id} type="button" className={category === String(item.id) ? 'is-active' : ''} onClick={() => setSearchParams({ category: String(item.id) })}>
              {item.name}<span>{item.vendor_count}</span>
            </button>
          ))}
        </div>

        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder={t('vendors.searchPlaceholder')} aria-label={t('vendors.searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} />
          <label className="proc-toggle"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> {t('vendors.showArchived')}</label>
          {vendors && <span className="dash-scope">{t('shownOf', { ns: 'common', shown: shown.length, total: vendors.length })}</span>}
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!vendors && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

        {vendors && (
          <section className="dash-card dash-card--flush">
            {shown.length === 0 ? <p className="dash-empty">{vendors.length ? t('vendors.noMatch') : t('vendors.empty')}</p> : (
              <div className="overflow-x-auto">
                <table className="dash-table">
                  <thead><tr>
                    <th scope="col">{t('vendors.vendor')}</th><th scope="col">{t('vendors.category')}</th><th scope="col">{t('vendors.contact')}</th>
                    <th scope="col" className="o-num">{t('vendors.orders')}</th><th scope="col" className="o-num">{t('vendors.committed')}</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((vendor) => (
                      <tr key={vendor.id} onClick={() => navigate(`/dashboard/vendors/${vendor.id}`)}>
                        <td>
                          <Link to={`/dashboard/vendors/${vendor.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>{vendor.name}</Link>
                          {!vendor.active && <span className="proc-status proc-status--cancelled">{t('vendors.archived')}</span>}
                        </td>
                        <td><span className="o-tag proc-tag">{vendor.category_name}</span></td>
                        <td className="dash-muted">{[vendor.contact_person, vendor.phone].filter(Boolean).join(' · ')}</td>
                        <td className="o-num dash-muted">{vendor.order_count}</td>
                        <td className="o-num"><strong>{formatMoney(vendor.committed_total)}</strong></td>
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
