import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { AccessLink } from '@/components/admin/access-link'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { RecordFormView } from '@/components/admin/record-form-view'
import { Many2ManyTags } from '@/components/admin/many2many-tags'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { apiRequest } from '@/lib/api-request'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import {
  orderStatuses, formatMoney, joinDateTime, splitDateTime,
  type BudgetSummary, type EventProcurement, type ProcurementOptions, type PurchaseOrder, type TaxProfile,
} from './types'

type EditLine = { key: string; kind: string; description: string; quantity: string; unitPrice: string; taxIds: number[] }
type EditPayment = { key: string; label: string; amount: string; dueDate: string }
type Draft = {
  vendor: string
  event: string
  deliveryDate: string
  deliveryTime: string
  deliveryLocation: string
  notes: string
  lines: EditLine[]
  schedule: EditPayment[]
}

const newKey = () => `new-${Date.now()}-${Math.random()}`
const round = (value: number) => Math.round(value * 100) / 100

function newLine(): EditLine {
  return { key: newKey(), kind: 'service', description: '', quantity: '1', unitPrice: '', taxIds: [] }
}

/** Same rules as the backend: inclusive VAT sits inside the amount, other taxes are added, withholding is deducted. */
function lineAmounts(line: EditLine, taxes: TaxProfile[]) {
  const base = round(Number(line.quantity || 0) * Number(line.unitPrice || 0))
  let included = 0
  let added = 0
  for (const tax of taxes.filter((item) => line.taxIds.includes(item.id))) {
    const rate = Number(tax.rate) / 100
    if (tax.kind === 'exempt') continue
    if (tax.kind === 'vat' && tax.inclusive) included += round((base * rate) / (1 + rate))
    else added += tax.kind === 'withholding' ? -round(base * rate) : round(base * rate)
  }
  return { subtotal: base - included, tax: included + added, total: base + added }
}

function draftFrom(order: PurchaseOrder): Draft {
  const delivery = splitDateTime(order.delivery_at)
  return {
    vendor: String(order.vendor),
    event: String(order.event),
    deliveryDate: delivery.date,
    deliveryTime: delivery.time,
    deliveryLocation: order.delivery_location,
    notes: order.notes,
    lines: order.lines.map((line) => ({
      key: String(line.id), kind: line.kind, description: line.description,
      quantity: String(Number(line.quantity)), unitPrice: line.unit_price, taxIds: line.tax_profile_ids,
    })),
    schedule: order.payment_schedule.map((item) => ({ key: String(item.id), label: item.label, amount: item.amount, dueDate: item.due_date ?? '' })),
  }
}

function signature(draft: Draft) {
  return JSON.stringify({
    ...draft,
    lines: draft.lines.map(({ key: _key, ...line }) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxIds: [...line.taxIds].sort() })),
    schedule: draft.schedule.map(({ key: _key, ...item }) => ({ ...item, amount: Number(item.amount) })),
  })
}

function validate(draft: Draft, total: number) {
  if (!draft.vendor) return i18n.t('procurement:orderForm.chooseVendorFirst')
  if (!draft.event) return i18n.t('procurement:orderForm.chooseEventFirst')
  if (!draft.lines.length) return i18n.t('procurement:orderForm.needLine')
  if (draft.lines.some((line) => !line.description.trim() || !(Number(line.quantity) > 0) || line.unitPrice === '' || Number(line.unitPrice) < 0)) {
    return i18n.t('procurement:orderForm.lineInvalid')
  }
  if (draft.schedule.some((item) => !item.label.trim() || !(Number(item.amount) > 0))) return i18n.t('procurement:orderForm.scheduleInvalid')
  const scheduled = round(draft.schedule.reduce((sum, item) => sum + Number(item.amount || 0), 0))
  if (draft.schedule.length && scheduled !== round(total)) return i18n.t('procurement:orderForm.scheduleMismatch', { scheduled: formatMoney(scheduled), total: formatMoney(total) })
  return ''
}

export function PurchaseOrderFormPage() {
  const { t } = useTranslation('procurement')
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [options, setOptions] = useState<ProcurementOptions | null>(null)
  const [draft, setDraft] = useState<Draft>({
    vendor: searchParams.get('vendor') ?? '', event: searchParams.get('event') ?? '',
    deliveryDate: '', deliveryTime: '', deliveryLocation: '', notes: '', lines: [newLine()], schedule: [],
  })
  const [eventSummary, setEventSummary] = useState<EventProcurement | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [chatterKey, setChatterKey] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [loadedOptions, loadedOrder] = await Promise.all([
        apiRequest<ProcurementOptions>('/procurement/options/', { signal, fallback: t('orderForm.loadOptions') }),
        isNew ? Promise.resolve(null) : apiRequest<PurchaseOrder>(`/procurement/purchase-orders/${id}/`, { signal, fallback: t('orderForm.loadFailed') }),
      ])
      setOptions(loadedOptions)
      if (loadedOrder) {
        setOrder(loadedOrder)
        setDraft(draftFrom(loadedOrder))
      }
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  // The event's budget and its other orders, refreshed when the event changes or the order moves.
  const eventId = draft.event
  const orderVersion = order ? `${order.status}-${order.total}` : ''
  useEffect(() => {
    if (!eventId) return
    const controller = new AbortController()
    apiRequest<EventProcurement>(`/procurement/events/${eventId}/`, { signal: controller.signal, fallback: t('orderForm.loadBudget') })
      .then((summary) => { setEventSummary(summary); setBudgetInput(summary.budget ?? '') })
      .catch(() => undefined)
    return () => controller.abort()
  }, [eventId, orderVersion])

  const taxes = options?.tax_profiles ?? []
  const editable = isNew || order?.status === 'draft'
  const billable = order?.status === 'approved' || order?.status === 'received'
  const amounts = draft.lines.map((line) => lineAmounts(line, taxes))
  const totals = amounts.reduce((sum, item) => ({ subtotal: sum.subtotal + item.subtotal, tax: sum.tax + item.tax, total: sum.total + item.total }), { subtotal: 0, tax: 0, total: 0 })
  const dirty = order ? signature(draft) !== signature(draftFrom(order)) : undefined
  const update = (changes: Partial<Draft>) => { setDraft((current) => ({ ...current, ...changes })); setSaved(false); setNotice('') }
  const updateLine = (key: string, changes: Partial<EditLine>) => update({ lines: draft.lines.map((line) => line.key === key ? { ...line, ...changes } : line) })
  const updatePayment = (key: string, changes: Partial<EditPayment>) => update({ schedule: draft.schedule.map((item) => item.key === key ? { ...item, ...changes } : item) })

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = validate(draft, totals.total)
    if (problem) { setError(problem); return }
    setSaving(true)
    setError('')
    try {
      const body = {
        vendor: Number(draft.vendor),
        event: Number(draft.event),
        delivery_at: joinDateTime(draft.deliveryDate, draft.deliveryTime),
        delivery_location: draft.deliveryLocation.trim(),
        notes: draft.notes.trim(),
        lines: draft.lines.map((line) => ({
          kind: line.kind, description: line.description.trim(), quantity: line.quantity, unit_price: line.unitPrice, tax_profile_ids: line.taxIds,
        })),
        payment_schedule: draft.schedule.map((item) => ({ label: item.label.trim(), amount: item.amount, due_date: item.dueDate || null })),
      }
      const result = await apiRequest<PurchaseOrder>(isNew ? '/procurement/purchase-orders/' : `/procurement/purchase-orders/${id}/`, {
        method: isNew ? 'POST' : 'PATCH', body, fallback: t('orderForm.saveFailed'), labels: { vendor: t('orderForm.vendor'), event: t('orderForm.event'), lines: t('orderForm.lines'), payment_schedule: t('orderForm.paymentSchedule'), delivery_at: t('orderForm.deliveryTime') },
      })
      if (isNew) {
        navigate(`/dashboard/purchase-orders/${result.id}`, { replace: true })
        return
      }
      setOrder(result)
      setDraft(draftFrom(result))
      setSaved(true)
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('orderForm.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function transition(action: 'submit' | 'approve' | 'reject' | 'receive' | 'cancel') {
    if (!order) return
    const body: Record<string, unknown> = { action }
    if (action === 'reject' || action === 'cancel') {
      const reason = window.prompt(action === 'reject' ? t('orderForm.rejectPrompt') : t('orderForm.cancelPrompt'))
      if (!reason?.trim()) return
      body.reason = reason.trim()
    }
    if (action === 'approve') {
      const budget = order.budget
      if (budget.budget !== null) {
        const overBy = Number(budget.committed) + Number(order.total) - Number(budget.budget)
        if (overBy > 0) {
          if (!window.confirm(t('orderForm.overBudgetConfirm', { event: order.event_name, over: formatMoney(overBy), budget: formatMoney(budget.budget) }))) return
          body.confirm_over_budget = true
        }
      }
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest<PurchaseOrder>(`/procurement/purchase-orders/${order.id}/transition/`, { method: 'POST', body, fallback: t('orderForm.updateFailed') })
      setOrder(result)
      setDraft(draftFrom(result))
      setNotice(t(`orderForm.notices.${action}`))
      setChatterKey((key) => key + 1)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('orderForm.updateFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function saveBudget() {
    if (!eventSummary) return
    setError('')
    try {
      const result = await apiRequest<EventProcurement>(`/procurement/events/${eventSummary.event_id}/`, {
        method: 'PATCH', body: { cost_budget: budgetInput.trim() || null }, fallback: t('orderForm.budgetFailed'), labels: { cost_budget: t('orderForm.budget') },
      })
      setEventSummary(result)
      setBudgetInput(result.budget ?? '')
      if (order) setOrder({ ...order, budget: result as BudgetSummary })
      setNotice(t('orderForm.budgetSaved'))
    } catch (budgetError) {
      setError(budgetError instanceof Error ? budgetError.message : t('orderForm.budgetFailed'))
    }
  }

  if (!options) {
    return (
      <AdminShell>
        {loading && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      </AdminShell>
    )
  }

  const taxOptions = taxes.map((tax) => ({ id: tax.id, label: tax.name.includes('%') ? tax.name : `${tax.name} ${Number(tax.rate)}%` }))
  const kindLabel = (value: string) => options.line_kinds.find((kind) => kind.value === value)?.label ?? value

  const linesPage = (
    <>
      <div className="o-list-wrap">
        <table className="o-list proc-lines">
          <thead><tr>
            <th scope="col">{t('orderForm.type')}</th><th scope="col">{t('orderForm.description')}</th><th scope="col" className="o-num">{t('orderForm.qty')}</th>
            <th scope="col" className="o-num">{t('orderForm.unitPrice')}</th><th scope="col">{t('orderForm.taxes')}</th><th scope="col" className="o-num">{t('orderForm.total')}</th>
            {editable && <th scope="col" className="o-list-actions"><span className="sr-only">{t('orderForm.actions')}</span></th>}
          </tr></thead>
          <tbody>
            {draft.lines.map((line, index) => (
              <tr key={line.key}>
                <td>
                  {editable ? (
                    <select className="o-input" aria-label={t('orderForm.lineType')} value={line.kind} onChange={(event) => updateLine(line.key, { kind: event.target.value })}>
                      {options.line_kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                    </select>
                  ) : <span className="o-tag proc-tag">{kindLabel(line.kind)}</span>}
                </td>
                <td>{editable ? <input className="o-input" aria-label={t('orderForm.description')} placeholder={t('orderForm.descriptionPlaceholder')} value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} /> : line.description}</td>
                <td className="o-num">{editable ? <input className="o-input o-num" aria-label={t('orderForm.quantity')} type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} /> : line.quantity}</td>
                <td className="o-num">{editable ? <input className="o-input o-num" aria-label={t('orderForm.unitPrice')} type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} /> : formatMoney(line.unitPrice)}</td>
                <td>
                  {editable
                    ? <Many2ManyTags aria-label={t('orderForm.lineTaxes')} options={taxOptions} value={line.taxIds} onChange={(ids) => updateLine(line.key, { taxIds: ids })} placeholder={t('orderForm.noTax')} />
                    : <div className="cat-tags">{line.taxIds.map((taxId) => <span key={taxId} className="o-tag">{taxOptions.find((tax) => tax.id === taxId)?.label}</span>)}{!line.taxIds.length && <span className="o-muted">—</span>}</div>}
                </td>
                <td className="o-num"><strong>{formatMoney(amounts[index].total)}</strong></td>
                {editable && (
                  <td className="o-list-actions">
                    <button type="button" className="o-btn o-btn-link o-btn-sm o-btn-danger" aria-label={t('orderForm.removeLine')} title={t('orderForm.removeLine')} disabled={draft.lines.length === 1} onClick={() => update({ lines: draft.lines.filter((item) => item.key !== line.key) })}>🗑</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && <button type="button" className="o-list-add" onClick={() => update({ lines: [...draft.lines, newLine()] })}>{t('orderForm.addLine')}</button>}
      <div className="o-totals">
        <div><span>{t('orderForm.untaxed')}</span><span>{formatMoney(totals.subtotal)}</span></div>
        <div><span>{t('orderForm.taxes')}</span><span>{formatMoney(totals.tax)}</span></div>
        <div className="o-totals-grand"><span>{t('orderForm.totalPayable')}</span><strong>{formatMoney(totals.total)}</strong></div>
      </div>
    </>
  )

  const scheduled = round(draft.schedule.reduce((sum, item) => sum + Number(item.amount || 0), 0))
  const schedulePage = (
    <>
      <p className="o-form-hint">
        {t('orderForm.scheduleHint')}
        {order && <> {t('orderForm.vendorTerms')} <strong>{order.vendor_payment_terms}</strong>.</>}
      </p>
      <div className="o-list-wrap">
        <table className="o-list">
          <thead><tr><th scope="col">{t('orderForm.payment')}</th><th scope="col">{t('orderForm.due')}</th><th scope="col" className="o-num">{t('orderForm.amount')}</th>{billable && <th scope="col">{t('orderForm.paid')}</th>}{editable && <th scope="col" className="o-list-actions"><span className="sr-only">{t('orderForm.actions')}</span></th>}</tr></thead>
          <tbody>
            {draft.schedule.map((item) => (
              <tr key={item.key}>
                <td>{editable ? <input className="o-input" aria-label={t('orderForm.paymentLabel')} placeholder={t('orderForm.paymentPlaceholder')} value={item.label} onChange={(event) => updatePayment(item.key, { label: event.target.value })} /> : item.label}</td>
                <td>{editable ? <EthiopianDateInput value={item.dueDate} onChange={(iso) => updatePayment(item.key, { dueDate: iso })} /> : (item.dueDate ? formatDualDate(item.dueDate) : '—')}</td>
                <td className="o-num">{editable ? <input className="o-input o-num" aria-label={t('orderForm.paymentAmount')} type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => updatePayment(item.key, { amount: event.target.value })} /> : formatMoney(item.amount)}</td>
                {billable && (() => {
                  const saved = order?.payment_schedule.find((row) => String(row.id) === item.key)
                  if (saved?.bill) return <td><AccessLink module="expenses" to={`/dashboard/expenses/${saved.bill.id}`} className="proc-status proc-status--received">{t('orderForm.paidRef', { reference: saved.bill.reference })}</AccessLink></td>
                  return <td>{order?.can_approve && saved ? <Link to={`/dashboard/expenses/new?purchase_order=${order.id}&payment=${saved.id}`} className="cat-row-link">{t('orderForm.recordPayment')}</Link> : <span className="o-muted">{t('orderForm.notYet')}</span>}</td>
                })()}
                {editable && <td className="o-list-actions"><button type="button" className="o-btn o-btn-link o-btn-sm o-btn-danger" aria-label={t('orderForm.removePayment')} title={t('orderForm.removePayment')} onClick={() => update({ schedule: draft.schedule.filter((row) => row.key !== item.key) })}>🗑</button></td>}
              </tr>
            ))}
            {draft.schedule.length === 0 && <tr><td colSpan={editable || billable ? 4 : 3} className="o-list-empty">{t('orderForm.noSchedule')}</td></tr>}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="proc-schedule-actions">
          <button type="button" className="o-list-add" onClick={() => update({ schedule: [...draft.schedule, { key: newKey(), label: '', amount: String(round(Math.max(totals.total - scheduled, 0))), dueDate: '' }] })}>{t('orderForm.addPayment')}</button>
          {draft.schedule.length === 0 && totals.total > 0 && (
            <button type="button" className="o-btn o-btn-link o-btn-sm" onClick={() => {
              const half = round(totals.total / 2)
              update({ schedule: [
                { key: newKey(), label: t('orderForm.deposit'), amount: String(half), dueDate: '' },
                { key: newKey(), label: t('orderForm.balance'), amount: String(round(totals.total - half)), dueDate: draft.deliveryDate },
              ] })
            }}>{t('orderForm.fiftyFifty')}</button>
          )}
        </div>
      )}
      {draft.schedule.length > 0 && (
        <p className={`o-form-hint${scheduled !== round(totals.total) ? ' proc-warning' : ''}`}>
          {t('orderForm.scheduledOf', { scheduled: formatMoney(scheduled), total: formatMoney(totals.total) })}
          {scheduled !== round(totals.total) && ` — ${formatMoney(round(totals.total - scheduled))} unassigned`}
        </p>
      )}
    </>
  )

  // Only trust the summary for the event currently chosen; switching events shows loading until it arrives.
  const billedTotal = Number(order?.billed_total ?? 0)
  const billsPage = order && (
    <>
      <p className="o-form-hint">{t('orderForm.billsHint', { vendor: order.vendor_name, event: order.event_name })}</p>
      <div className="o-list-wrap">
        <table className="o-list">
          <thead><tr><th scope="col">{t('orderForm.bill')}</th><th scope="col">{t('orderForm.date')}</th><th scope="col">{t('orderForm.for')}</th><th scope="col">{t('orderForm.paidBy')}</th><th scope="col" className="o-num">{t('orderForm.amount')}</th></tr></thead>
          <tbody>
            {order.bills.map((bill) => (
              <tr key={bill.id}>
                <td><AccessLink module="expenses" to={`/dashboard/expenses/${bill.id}`} className="cat-row-link">{bill.reference}</AccessLink></td>
                <td className="o-muted">{formatDualDate(bill.date)}</td>
                <td>{bill.scheduled_payment ?? <span className="o-muted">—</span>}</td>
                <td className="o-muted">{bill.payment_method}</td>
                <td className="o-num">{formatMoney(bill.total)}</td>
              </tr>
            ))}
            {order.bills.length === 0 && <tr><td colSpan={5} className="o-list-empty">{billable ? t('orderForm.nothingPaid') : t('orderForm.billsAfterApproval')}</td></tr>}
          </tbody>
        </table>
      </div>
      {billable && order.can_approve && billedTotal < Number(order.total) && (
        <Link to={`/dashboard/expenses/new?purchase_order=${order.id}`} className="o-list-add">{t('orderForm.recordBill')}</Link>
      )}
      <div className="o-totals">
        <div><span>{t('orderForm.billed')}</span><span>{formatMoney(billedTotal)}</span></div>
        <div className="o-totals-grand"><span>{t('orderForm.leftToPay')}</span><strong>{formatMoney(Number(order.total) - billedTotal)}</strong></div>
      </div>
    </>
  )

  const budget = eventSummary && String(eventSummary.event_id) === draft.event ? eventSummary : null
  const thisOrderCounts = order && (order.status === 'approved' || order.status === 'received')
  const projected = budget ? Number(budget.committed) + (thisOrderCounts ? 0 : totals.total) : 0
  const overBudget = budget?.budget !== null && budget !== null && projected > Number(budget.budget)
  const budgetPage = !draft.event ? <p className="o-form-hint">{t('orderForm.chooseEventBudget')}</p> : !budget ? <div className="o-form-loading" role="status"><span /><span /><span /></div> : (
    <>
      <div className="proc-budget">
        <div><span>{t('orderForm.costBudget')}</span><strong>{formatMoney(budget.budget)}</strong></div>
        <div><span>{t('orderForm.committed')}</span><strong>{formatMoney(budget.committed)}</strong><small>{t('orderForm.committedHint')}</small></div>
        <div><span>{t('orderForm.waitingApproval')}</span><strong>{formatMoney(budget.pending)}</strong></div>
        <div className={budget.remaining !== null && Number(budget.remaining) < 0 ? 'is-danger' : ''}><span>{t('orderForm.remaining')}</span><strong>{formatMoney(budget.remaining)}</strong></div>
      </div>
      {budget.budget !== null && (
        <div className="proc-meter" role="img" aria-label={t('orderForm.budgetMeter', { percent: Math.round((Number(budget.committed) / Math.max(Number(budget.budget), 1)) * 100) })}>
          <span style={{ width: `${Math.min((Number(budget.committed) / Math.max(Number(budget.budget), 1)) * 100, 100)}%` }} />
          <span className="is-pending" style={{ width: `${Math.min((Number(budget.pending) / Math.max(Number(budget.budget), 1)) * 100, 100)}%` }} />
        </div>
      )}
      {overBudget && !thisOrderCounts && order?.status !== 'cancelled' && (
        <p className="o-form-hint proc-warning">{t('orderForm.overBudget', { amount: formatMoney(projected - Number(budget.budget)) })}</p>
      )}
      {budget.budget === null && <p className="o-form-hint">{t('orderForm.noBudget')}</p>}
      {budget.can_set_budget && (
        <div className="cat-quick-create">
          <input className="o-input" type="number" min="0" step="0.01" aria-label={t('orderForm.budgetInputLabel')} placeholder={t('orderForm.budgetInputPlaceholder')} value={budgetInput} onChange={(event) => setBudgetInput(event.target.value)} />
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" disabled={(budget.budget ?? '') === budgetInput} onClick={() => void saveBudget()}>{t('orderForm.saveBudget')}</button>
        </div>
      )}
      <h3 className="proc-subhead">{t('orderForm.ordersFor', { event: budget.event_name })}</h3>
      <div className="o-list-wrap">
        <table className="o-list">
          <thead><tr><th scope="col">{t('orderForm.order')}</th><th scope="col">{t('orderForm.vendor')}</th><th scope="col">{t('orderForm.status')}</th><th scope="col" className="o-num">{t('orderForm.total')}</th></tr></thead>
          <tbody>
            {budget.orders.map((item) => (
              <tr key={item.id} className={item.id === order?.id ? 'is-dirty' : ''}>
                <td>{item.id === order?.id ? <strong>{item.reference}</strong> : <Link to={`/dashboard/purchase-orders/${item.id}`} className="cat-row-link">{item.reference}</Link>}</td>
                <td>{item.vendor_name}<div className="cat-muted">{item.vendor_category}</div></td>
                <td><span className={`proc-status proc-status--${item.status}`}>{t(`orderStatus.${item.status as 'draft'}`, { defaultValue: item.status_label })}</span></td>
                <td className="o-num">{formatMoney(item.total)}</td>
              </tr>
            ))}
            {budget.orders.length === 0 && <tr><td colSpan={4} className="o-list-empty">{t('orderForm.noEventOrders')}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )

  const vendorOptions = options.vendors.map((vendor) => ({ value: String(vendor.id), label: `${vendor.name} · ${vendor.category}` }))
  if (order && !vendorOptions.some((option) => option.value === String(order.vendor))) vendorOptions.push({ value: String(order.vendor), label: order.vendor_name })
  const eventOptions = options.events.map((item) => ({ value: String(item.id), label: `${item.name} · ${formatDualDate(item.event_date)}` }))
  if (order && !eventOptions.some((option) => option.value === String(order.event))) eventOptions.push({ value: String(order.event), label: order.event_name })
  const selectedEvent = options.events.find((item) => String(item.id) === draft.event)
  const statusTone = order?.status === 'cancelled' ? 'danger' : order?.status === 'received' ? 'success' : order?.status === 'approved' ? 'info' : null

  return (
    <AdminShell>
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {notice && <p className="o-inline-notice" role="status">{notice}</p>}
      {(isNew || order) && (
        <RecordFormView
          modelName={t('orders.model')}
          title={order?.reference ?? ''}
          subtitle={order ? t('orderForm.subtitle', { vendor: order.vendor_name, event: order.event_name }) : t('orderForm.newSubtitle')}
          recordId={order?.id}
          backHref="/dashboard/purchase-orders"
          backLabel={t('orderForm.back')}
          ribbon={order && statusTone ? { label: t(`orderStatus.${order.status as 'draft'}`, { defaultValue: order.status_label }), tone: statusTone } : null}
          status={order?.status ?? 'draft'}
          statusOptions={orderStatuses().map((item) => ({ ...item, folded: item.value === 'cancelled' }))}
          actionSlot={order && <>
            {order.status === 'draft' && <button type="button" className="o-btn o-btn-primary" disabled={busy || dirty} title={dirty ? t('orderForm.saveFirst') : undefined} onClick={() => void transition('submit')}>{t('orderForm.submitApproval')}</button>}
            {order.status === 'submitted' && order.can_approve && <>
              <button type="button" className="o-btn o-btn-primary" disabled={busy} onClick={() => void transition('approve')}>{t('orderForm.approve')}</button>
              <button type="button" className="o-btn o-btn-secondary" disabled={busy} onClick={() => void transition('reject')}>{t('orderForm.sendBack')}</button>
            </>}
            {order.status === 'submitted' && !order.can_approve && <span className="cat-muted">{t('orderForm.waitingFinance')}</span>}
            {order.status === 'approved' && <button type="button" className="o-btn o-btn-primary" disabled={busy} onClick={() => void transition('receive')}>{t('orderForm.markPaid')}</button>}
            {billable && order.can_approve && billedTotal < Number(order.total) && <Link to={`/dashboard/expenses/new?purchase_order=${order.id}`} className="o-btn o-btn-secondary">{t('orderForm.recordBillShort')}</Link>}
            {order.status === 'approved' && order.can_approve && !order.bills.length && <button type="button" className="o-btn o-btn-secondary" disabled={busy} onClick={() => void transition('reject')}>{t('orderForm.backToDraft')}</button>}
            {['draft', 'submitted'].includes(order.status) || (order.status === 'approved' && order.can_approve && !order.bills.length)
              ? <button type="button" className="o-btn o-btn-link" disabled={busy} onClick={() => void transition('cancel')}>{t('orderForm.cancelOrder')}</button>
              : null}
            {order.status !== 'draft' && <button type="button" className="o-btn o-btn-secondary" onClick={() => window.print()}>{t('orderForm.print')}</button>}
          </>}
          headerAside={<>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">Br</span>
              <span><strong>{formatMoney(totals.total)}</strong><small>{t('orderForm.statTotal')}</small></span>
            </div>
            {budget && budget.budget !== null && (
              <div className={`o-stat-button${overBudget ? ' is-danger' : ''}`}>
                <span className="o-stat-icon" aria-hidden="true">%</span>
                <span><strong>{formatMoney(budget.remaining)}</strong><small>{t('orderForm.statBudgetLeft')}</small></span>
              </div>
            )}
            {order && (
              <Link to={`/dashboard/vendors/${order.vendor}`} className="o-stat-button">
                <span className="o-stat-icon" aria-hidden="true">◈</span>
                <span><strong>{order.vendor_name}</strong><small>{t('orderForm.statVendor')}</small></span>
              </Link>
            )}
          </>}
          headerFields={[
            { name: 'vendor', label: t('orderForm.vendor'), type: 'select', value: draft.vendor, required: true, readOnly: !editable, options: [{ value: '', label: t('orderForm.chooseVendor') }, ...vendorOptions] },
            { name: 'event', label: t('orderForm.event'), type: 'select', value: draft.event, required: true, readOnly: !isNew, options: [{ value: '', label: t('orderForm.chooseEvent') }, ...eventOptions], helpText: selectedEvent ? `${selectedEvent.customer} · ${selectedEvent.location}` : undefined },
            {
              name: 'delivery', label: t('orderForm.delivery'), type: 'custom',
              render: editable ? (
                <div className="proc-datetime">
                  <EthiopianDateInput value={draft.deliveryDate} onChange={(iso) => update({ deliveryDate: iso })} />
                  <input className="o-input" type="time" aria-label={t('orderForm.deliveryTime')} value={draft.deliveryTime} onChange={(event) => update({ deliveryTime: event.target.value })} />
                </div>
              ) : (
                <div className={`o-field-value${draft.deliveryDate ? '' : ' is-empty'}`}>{draft.deliveryDate ? `${formatDualDate(draft.deliveryDate)}${draft.deliveryTime ? ` · ${draft.deliveryTime}` : ''}` : t('orderForm.notSet')}</div>
              ),
            },
            { name: 'deliveryLocation', label: t('orderForm.deliverTo'), value: draft.deliveryLocation, readOnly: !editable, placeholder: selectedEvent?.location || t('orderForm.deliverToPlaceholder') },
            ...(order ? [
              { name: 'order_date', label: t('orderForm.orderDate'), type: 'date' as const, value: order.order_date, readOnly: true },
              { name: 'approved', label: order.approved_by_name ? t('orderForm.approvedBy') : t('orderForm.raisedBy'), value: order.approved_by_name ?? order.created_by_name ?? '—', readOnly: true },
            ] : []),
          ]}
          onFieldChange={(name, value) => update({ [name]: value } as Partial<Draft>)}
          tabs={[
            { id: 'lines', label: t('orderForm.lines'), badge: draft.lines.length, content: linesPage },
            { id: 'schedule', label: t('orderForm.paymentSchedule'), badge: draft.schedule.length || undefined, content: schedulePage },
            ...(order && order.status !== 'draft' && order.status !== 'submitted' ? [{ id: 'bills', label: t('orderForm.billsTab'), badge: order.bills.length, content: billsPage }] : []),
            { id: 'budget', label: t('orderForm.budgetTab'), content: budgetPage },
            { id: 'notes', label: t('orderForm.notesTab'), sections: [{ title: t('orderForm.termsNotes'), fields: [{ name: 'notes', label: t('orderForm.notes'), type: 'textarea', value: draft.notes, fullWidth: true, readOnly: !editable, placeholder: t('orderForm.notesPlaceholder') }] }] },
          ]}
          onSubmit={editable ? (event) => void save(event) : undefined}
          dirty={dirty}
          onDiscard={() => {
            if (isNew) { navigate('/dashboard/purchase-orders'); return }
            if (order) setDraft(draftFrom(order))
            setError('')
          }}
          saving={saving}
          saved={saved}
          submitLabel={isNew ? t('orderForm.createDraft') : t('orderForm.save')}
          chatter={order ? { model: 'purchaseorder', recordId: order.id, refreshKey: chatterKey } : undefined}
        >
          {order && order.status !== 'draft' && (
            <article className="invoice-printable" aria-label={t('print.label')}>
              <header className="invoice-print-header">
                <div><p className="invoice-print-brand">{t('print.brand')}</p><p className="invoice-print-muted">{t('print.tagline')}</p></div>
                <div className="invoice-print-title"><p>{t('print.title')}</p><h1>{order.reference}</h1></div>
              </header>
              <div className="invoice-print-meta">
                <div><span>{t('print.vendor')}</span><strong>{order.vendor_name}</strong></div>
                <div><span>{t('print.orderDate')}</span><strong>{formatDualDate(order.order_date)}</strong></div>
                <div><span>{t('print.event')}</span><strong>{order.event_name}</strong></div>
                <div><span>{t('print.delivery')}</span><strong>{draft.deliveryDate ? `${formatDualDate(draft.deliveryDate)} ${draft.deliveryTime}` : '—'}</strong></div>
                <div><span>{t('print.deliverTo')}</span><strong>{order.delivery_location || order.event_location}</strong></div>
                <div><span>{t('print.paymentTerms')}</span><strong>{order.vendor_payment_terms}</strong></div>
              </div>
              <table className="invoice-print-table">
                <thead><tr><th>{t('print.description')}</th><th>{t('print.qty')}</th><th>{t('print.unitPrice')}</th><th>{t('print.amount')}</th></tr></thead>
                <tbody>{order.lines.map((line) => <tr key={line.id}><td><strong>{line.description}</strong><small>{line.kind_label}</small></td><td>{Number(line.quantity)}</td><td>{formatMoney(line.unit_price)}</td><td>{formatMoney(line.total)}</td></tr>)}</tbody>
              </table>
              <section className="invoice-print-totals">
                <div className="invoice-print-tax-breakdown">
                  <div><span>{t('print.untaxed')}</span><span>{formatMoney(order.subtotal)}</span></div>
                  <div><span>{t('print.taxes')}</span><span>{formatMoney(order.tax)}</span></div>
                  {order.payment_schedule.map((item) => <div key={item.id}><span>{item.label}{item.due_date ? ` · ${formatDualDate(item.due_date)}` : ''}</span><span>{formatMoney(item.amount)}</span></div>)}
                </div>
                <div className="invoice-print-grand-total"><span>{t('print.total')}</span><strong>{formatMoney(order.total)}</strong></div>
              </section>
              {order.notes && <p className="invoice-print-muted">{order.notes}</p>}
              <footer className="invoice-print-footer">{order.approved_by_name ? t('print.approvedBy', { name: order.approved_by_name }) : t('print.notApproved')}</footer>
            </article>
          )}
        </RecordFormView>
      )}
    </AdminShell>
  )
}
