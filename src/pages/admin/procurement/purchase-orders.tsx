import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { apiRequest } from '@/lib/api-request'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { orderStatuses, formatMoney, splitDateTime, type PurchaseOrderListItem } from './types'

export function PurchaseOrdersPage() {
  const { t } = useTranslation('procurement')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? ''
  const [orders, setOrders] = useState<PurchaseOrderListItem[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<PurchaseOrderListItem[]>('/procurement/purchase-orders/', { signal: controller.signal, fallback: t('orders.loadFailed') })
      .then(setOrders)
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [t])

  const counts = Object.fromEntries(orderStatuses().map((item) => [item.value, (orders ?? []).filter((order) => order.status === item.value).length]))
  const needle = query.trim().toLowerCase()
  const shown = (orders ?? []).filter((order) => (!status || order.status === status)
    && (!needle || [order.reference, order.vendor_name, order.event_name, order.vendor_category].some((value) => value.toLowerCase().includes(needle))))

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">{t('eyebrow')}</p>
            <h1 className="dash-title">{t('orders.title')}</h1>
          </div>
          <Link to="/dashboard/purchase-orders/new" className="o-btn o-btn-primary">{t('orders.newOrder')}</Link>
        </div>

        <div className="proc-chips" role="group" aria-label={t('orders.filterByStatus')}>
          <button type="button" className={!status ? 'is-active' : ''} onClick={() => setSearchParams({})}>{t('orders.all')}<span>{orders?.length ?? 0}</span></button>
          {orderStatuses().map((item) => (
            <button key={item.value} type="button" className={status === item.value ? 'is-active' : ''} onClick={() => setSearchParams({ status: item.value })}>
              {item.label}<span>{counts[item.value]}</span>
            </button>
          ))}
        </div>

        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder={t('orders.searchPlaceholder')} aria-label={t('orders.searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} />
          {orders && <span className="dash-scope">{t('shownOf', { ns: 'common', shown: shown.length, total: orders.length })}</span>}
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!orders && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

        {orders && (
          <section className="dash-card dash-card--flush">
            {shown.length === 0 ? <p className="dash-empty">{orders.length ? t('orders.noMatch') : t('orders.empty')}</p> : (
              <div className="overflow-x-auto">
                <table className="dash-table">
                  <thead><tr>
                    <th scope="col">{t('orders.reference')}</th><th scope="col">{t('orders.vendor')}</th><th scope="col">{t('orders.event')}</th>
                    <th scope="col">{t('orders.delivery')}</th><th scope="col">{t('orders.status')}</th><th scope="col" className="o-num">{t('orders.total')}</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((order) => (
                      <tr key={order.id} onClick={() => navigate(`/dashboard/purchase-orders/${order.id}`)}>
                        <td><Link to={`/dashboard/purchase-orders/${order.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>{order.reference}</Link></td>
                        <td>{order.vendor_name}<div className="cat-muted">{order.vendor_category}</div></td>
                        <td>{order.event_name}<div className="cat-muted">{formatDualDate(order.event_date)}</div></td>
                        <td className="dash-muted">{order.delivery_at ? formatDualDate(splitDateTime(order.delivery_at).date) : '—'}</td>
                        <td><span className={`proc-status proc-status--${order.status}`}>{t(`orderStatus.${order.status as 'draft'}`, { defaultValue: order.status_label })}</span></td>
                        <td className="o-num"><strong>{formatMoney(order.total)}</strong></td>
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
