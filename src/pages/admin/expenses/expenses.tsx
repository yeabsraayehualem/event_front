import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { apiRequest } from '@/lib/api-request'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { formatMoney } from '../procurement/types'
import type { Expense, ExpenseOptions } from './types'

const SCOPES = [
  { value: '', key: 'all' },
  { value: 'event', key: 'event' },
  { value: 'overhead', key: 'overhead' },
  { value: 'bills', key: 'bills' },
] as const

export function ExpensesPage() {
  const { t } = useTranslation('expenses')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const scope = searchParams.get('scope') ?? ''
  const category = searchParams.get('category') ?? ''
  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [categories, setCategories] = useState<ExpenseOptions['categories']>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<Expense[]>('/finance/expenses/', { signal: controller.signal, fallback: t('loadFailed') }),
      apiRequest<ExpenseOptions>('/finance/expense-options/', { signal: controller.signal, fallback: t('loadCategories') }),
    ])
      .then(([loaded, options]) => { setExpenses(loaded); setCategories(options.categories) })
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [t])

  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    setSearchParams(next)
  }

  const needle = query.trim().toLowerCase()
  const shown = (expenses ?? []).filter((expense) => (
    (!scope || (scope === 'event' ? expense.event !== null : scope === 'overhead' ? expense.event === null : expense.purchase_order !== null))
    && (!category || String(expense.category) === category)
    && (!needle || [expense.reference, expense.description, expense.event_name, expense.vendor_name, expense.payee, expense.receipt_number]
      .some((value) => value?.toLowerCase().includes(needle)))
  ))
  const shownTotal = shown.reduce((sum, expense) => sum + Number(expense.amount), 0)

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">{t('eyebrow')}</p>
            <h1 className="dash-title">{t('title')}</h1>
          </div>
          <Link to="/dashboard/expenses/new" className="o-btn o-btn-primary">{t('record')}</Link>
        </div>

        <div className="proc-chips" role="group" aria-label={t('filterLabel')}>
          {SCOPES.map((item) => (
            <button key={item.value} type="button" className={scope === item.value ? 'is-active' : ''} onClick={() => setFilter('scope', item.value)}>{t(`scopes.${item.key}`)}</button>
          ))}
        </div>

        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder={t('searchPlaceholder')} aria-label={t('searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="o-input proc-select" aria-label={t('category')} value={category} onChange={(event) => setFilter('category', event.target.value)}>
            <option value="">{t('allCategories')}</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {expenses && <span className="dash-scope">{t('totalExclVat', { count: shown.length, amount: formatMoney(shownTotal) })}</span>}
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!expenses && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

        {expenses && (
          <section className="dash-card dash-card--flush">
            {shown.length === 0 ? <p className="dash-empty">{expenses.length ? t('noMatch') : t('empty')}</p> : (
              <div className="overflow-x-auto">
                <table className="dash-table">
                  <thead><tr>
                    <th scope="col">{t('columns.date')}</th><th scope="col">{t('columns.description')}</th><th scope="col">{t('columns.category')}</th>
                    <th scope="col">{t('columns.chargedTo')}</th><th scope="col" className="o-num">{t('columns.exclVat')}</th><th scope="col" className="o-num">{t('columns.paid')}</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((expense) => (
                      <tr key={expense.id} onClick={() => navigate(`/dashboard/expenses/${expense.id}`)}>
                        <td className="dash-muted">{formatDualDate(expense.date)}</td>
                        <td>
                          <Link to={`/dashboard/expenses/${expense.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>{expense.description}</Link>
                          <div className="cat-muted">{expense.reference}{expense.vendor_name || expense.payee ? ` · ${expense.vendor_name || expense.payee}` : ''}</div>
                        </td>
                        <td><span className="o-tag proc-tag">{expense.category_name}</span></td>
                        <td>
                          {expense.event_name ?? <span className="dash-muted">{t('overhead')}</span>}
                          {expense.purchase_order_reference && <div className="cat-muted">{expense.purchase_order_reference}</div>}
                        </td>
                        <td className="o-num">{formatMoney(expense.amount)}</td>
                        <td className="o-num"><strong>{formatMoney(expense.total)}</strong></td>
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
