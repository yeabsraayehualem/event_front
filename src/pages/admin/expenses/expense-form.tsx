import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { RecordFormView } from '@/components/admin/record-form-view'
import { apiBaseUrl } from '@/lib/api'
import { apiRequest } from '@/lib/api-request'
import { getErrorMessage } from '@/lib/api-errors'
import { fetchCsrfToken } from '@/lib/csrf'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { formatMoney } from '../procurement/types'
import { splitPayable, type Expense, type ExpenseOptions } from './types'

type ChargeTo = 'overhead' | 'event' | 'bill'
type Draft = {
  chargeTo: ChargeTo
  date: string
  category: string
  description: string
  event: string
  vendor: string
  purchaseOrder: string
  scheduledPayment: string
  payee: string
  amount: string
  tax: string
  paymentMethod: string
  receiptNumber: string
  notes: string
}


function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function draftFrom(expense: Expense): Draft {
  return {
    chargeTo: expense.purchase_order ? 'bill' : expense.event ? 'event' : 'overhead',
    date: expense.date,
    category: String(expense.category),
    description: expense.description,
    event: expense.event ? String(expense.event) : '',
    vendor: expense.vendor ? String(expense.vendor) : '',
    purchaseOrder: expense.purchase_order ? String(expense.purchase_order) : '',
    scheduledPayment: expense.scheduled_payment ? String(expense.scheduled_payment) : '',
    payee: expense.payee,
    amount: expense.amount,
    tax: expense.tax,
    paymentMethod: expense.payment_method,
    receiptNumber: expense.receipt_number,
    notes: expense.notes,
  }
}

export function ExpenseFormPage() {
  const { t } = useTranslation('expenses')
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [expense, setExpense] = useState<Expense | null>(null)
  const [options, setOptions] = useState<ExpenseOptions | null>(null)
  const [draft, setDraft] = useState<Draft>({
    chargeTo: searchParams.get('purchase_order') ? 'bill' : searchParams.get('event') ? 'event' : 'overhead',
    date: todayIso(), category: '', description: '', event: searchParams.get('event') ?? '', vendor: '',
    purchaseOrder: searchParams.get('purchase_order') ?? '', scheduledPayment: '', payee: '',
    amount: '', tax: '0.00', paymentMethod: 'bank_transfer', receiptNumber: '', notes: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [chatterKey, setChatterKey] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [loadedOptions, loadedExpense] = await Promise.all([
        apiRequest<ExpenseOptions>('/finance/expense-options/', { signal, fallback: t('form.loadOptions') }),
        isNew ? Promise.resolve(null) : apiRequest<Expense>(`/finance/expenses/${id}/`, { signal, fallback: t('form.loadFailed') }),
      ])
      setOptions(loadedOptions)
      if (loadedExpense) {
        setExpense(loadedExpense)
        setDraft(draftFrom(loadedExpense))
        return
      }
      // A new bill opened from a purchase order: prefill from the order and the chosen milestone.
      const order = loadedOptions.purchase_orders.find((item) => String(item.id) === searchParams.get('purchase_order'))
      const payment = order?.payments.find((item) => String(item.id) === searchParams.get('payment') && !item.bill_id)
      const vendorCategory = loadedOptions.categories.find((item) => item.name === 'Vendor services')
      setDraft((current) => ({
        ...current,
        category: current.category || String((order ? vendorCategory : undefined)?.id ?? loadedOptions.categories[0]?.id ?? ''),
        ...(order ? {
          description: payment ? `${order.vendor_name} – ${payment.label}` : `${order.vendor_name} – ${order.reference}`,
          scheduledPayment: payment ? String(payment.id) : '',
          ...splitPayable(Number(payment?.amount ?? order.remaining), order),
        } : {}),
      }))
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [id, isNew, searchParams])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const dirty = expense ? JSON.stringify(draft) !== JSON.stringify(draftFrom(expense)) : undefined
  const update = (changes: Partial<Draft>) => { setDraft((current) => ({ ...current, ...changes })); setSaved(false) }
  const orders = options?.purchase_orders ?? []
  const order = orders.find((item) => String(item.id) === draft.purchaseOrder)
  const total = Number(draft.amount || 0) + Number(draft.tax || 0)

  function chooseOrder(orderId: string) {
    const next = orders.find((item) => String(item.id) === orderId)
    update({ purchaseOrder: orderId, scheduledPayment: '', ...(next ? splitPayable(Number(next.remaining), next) : {}) })
  }

  function choosePayment(paymentId: string) {
    const payment = order?.payments.find((item) => String(item.id) === paymentId)
    update({ scheduledPayment: paymentId, ...(order && payment ? splitPayable(Number(payment.amount), order) : {}) })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draft.chargeTo === 'event' && !draft.event) { setError(t('form.needEvent')); return }
    if (draft.chargeTo === 'bill' && !draft.purchaseOrder) { setError(t('form.needOrder')); return }
    setSaving(true)
    setError('')
    try {
      const isBill = draft.chargeTo === 'bill'
      const body = {
        date: draft.date,
        category: Number(draft.category),
        description: draft.description.trim(),
        event: draft.chargeTo === 'event' ? Number(draft.event) : null,
        vendor: !isBill && draft.vendor ? Number(draft.vendor) : null,
        purchase_order: isBill ? Number(draft.purchaseOrder) : null,
        scheduled_payment: isBill && draft.scheduledPayment ? Number(draft.scheduledPayment) : null,
        payee: draft.payee.trim(),
        amount: draft.amount,
        tax: draft.tax || '0',
        payment_method: draft.paymentMethod,
        receipt_number: draft.receiptNumber.trim(),
        notes: draft.notes.trim(),
      }
      // Bills keep their order (and the event/vendor that come with it) once recorded.
      if (!isNew && expense?.purchase_order) {
        delete (body as Partial<typeof body>).purchase_order
        delete (body as Partial<typeof body>).event
        delete (body as Partial<typeof body>).vendor
      }
      const result = await apiRequest<Expense>(isNew ? '/finance/expenses/' : `/finance/expenses/${id}/`, {
        method: isNew ? 'POST' : 'PATCH', body, fallback: t('form.saveFailed'), labels: {
          amount: t('form.amount'), tax: t('form.tax'), purchase_order: t('form.purchaseOrder'), scheduled_payment: t('form.milestone'),
          category: t('form.category'), description: t('form.description'), event: t('form.event'),
        },
      })
      if (isNew) {
        navigate(`/dashboard/expenses/${result.id}`, { replace: true })
        return
      }
      setExpense(result)
      setDraft(draftFrom(result))
      setSaved(true)
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('form.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function uploadReceipt(file: File) {
    if (!expense) return
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      body.append('receipt', file)
      const response = await fetch(`${apiBaseUrl}/finance/expenses/${expense.id}/receipt/`, {
        method: 'POST', credentials: 'include', body,
        headers: { Accept: 'application/json', 'X-CSRFToken': await fetchCsrfToken() },
      })
      const data: unknown = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(data, t('form.uploadFailed')))
      setExpense(data as Expense)
      setChatterKey((key) => key + 1)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('form.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function remove() {
    if (!expense || !window.confirm(t('form.confirmDelete', { reference: expense.reference, amount: formatMoney(expense.total) }))) return
    setError('')
    try {
      await apiRequest(`/finance/expenses/${expense.id}/`, { method: 'DELETE', fallback: t('form.deleteFailed') })
      navigate('/dashboard/expenses', { replace: true })
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('form.deleteFailed'))
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

  const lockedBill = Boolean(expense?.purchase_order)
  const chargeOptions = [
    { value: 'overhead', label: t('form.chargeOverhead') },
    { value: 'event', label: t('form.chargeEvent') },
    { value: 'bill', label: t('form.chargeBill') },
  ]
  const orderOptions = orders.map((item) => ({ value: String(item.id), label: t('form.orderLeft', { reference: item.reference, vendor: item.vendor_name, amount: formatMoney(item.remaining) }) }))
  if (expense?.purchase_order && !orderOptions.some((item) => item.value === String(expense.purchase_order))) {
    orderOptions.push({ value: String(expense.purchase_order), label: expense.purchase_order_reference ?? '' })
  }
  const paymentOptions = (order?.payments ?? [])
    .filter((item) => !item.bill_id || String(item.id) === draft.scheduledPayment)
    .map((item) => ({ value: String(item.id), label: `${item.label} · ${formatMoney(item.amount)}${item.due_date ? ` · ${t('form.due', { date: formatDualDate(item.due_date) })}` : ''}` }))

  const linkFields = draft.chargeTo === 'bill' ? [
    {
      name: 'purchaseOrder', label: t('form.purchaseOrder'), type: 'select' as const, value: draft.purchaseOrder, required: true, readOnly: lockedBill,
      options: [{ value: '', label: orders.length ? t('form.chooseOrder') : t('form.noOrders') }, ...orderOptions],
      helpText: order ? `${order.event_name} · ${formatMoney(order.remaining)} of ${formatMoney(order.total)} still to bill` : undefined,
    },
    ...(paymentOptions.length ? [{
      name: 'scheduledPayment', label: t('form.paysMilestone'), type: 'select' as const, value: draft.scheduledPayment,
      options: [{ value: '', label: t('form.notScheduled') }, ...paymentOptions],
    }] : []),
  ] : [
    ...(draft.chargeTo === 'event' ? [{
      name: 'event', label: t('form.event'), type: 'select' as const, value: draft.event, required: true,
      options: [{ value: '', label: t('form.chooseEvent') }, ...options.events.map((item) => ({ value: String(item.id), label: `${item.name} · ${formatDualDate(item.event_date)}` }))],
    }] : []),
    {
      name: 'vendor', label: t('form.vendor'), type: 'select' as const, value: draft.vendor,
      options: [{ value: '', label: t('form.notRegistered') }, ...options.vendors.map((item) => ({ value: String(item.id), label: item.name }))],
    },
    ...(!draft.vendor ? [{ name: 'payee', label: t('form.paidTo'), value: draft.payee, placeholder: t('form.paidToPlaceholder') }] : []),
  ]

  return (
    <AdminShell>
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {(isNew || expense) && (
        <RecordFormView
          modelName={t('model')}
          title={expense?.reference ?? ''}
          subtitle={expense ? `${expense.category_name} · ${expense.event_name ?? t('overhead')}` : t('form.newSubtitle')}
          recordId={expense?.id}
          backHref="/dashboard/expenses"
          backLabel={t('form.back')}
          actionSlot={expense && <>
            {expense.purchase_order && <Link to={`/dashboard/purchase-orders/${expense.purchase_order}`} className="o-btn o-btn-secondary">{t('form.openOrder', { reference: expense.purchase_order_reference })}</Link>}
            <button type="button" className="o-btn o-btn-link o-btn-danger" onClick={() => void remove()}>{t('form.delete')}</button>
          </>}
          headerAside={<>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">Br</span>
              <span><strong>{formatMoney(total)}</strong><small>{t('form.statPaid')}</small></span>
            </div>
            {expense && (
              <div className={`o-stat-button${expense.receipt_url ? '' : ' is-muted'}`}>
                <span className="o-stat-icon" aria-hidden="true">✓</span>
                <span><strong>{expense.receipt_url ? t('form.attached') : t('form.none')}</strong><small>{t('form.statReceipt')}</small></span>
              </div>
            )}
          </>}
          headerFields={[
            { name: 'description', label: t('form.description'), value: draft.description, required: true, placeholder: t('form.descriptionPlaceholder') },
            { name: 'date', label: t('form.date'), type: 'date', value: draft.date, required: true },
            { name: 'category', label: t('form.category'), type: 'select', value: draft.category, required: true, options: options.categories.map((item) => ({ value: String(item.id), label: item.name })) },
            { name: 'chargeTo', label: t('form.chargedTo'), type: 'select', value: draft.chargeTo, readOnly: lockedBill, options: chargeOptions },
            ...linkFields,
          ]}
          onFieldChange={(name, value) => {
            if (name === 'purchaseOrder') return chooseOrder(value)
            if (name === 'scheduledPayment') return choosePayment(value)
            update({ [name]: value } as Partial<Draft>)
          }}
          tabs={[
            {
              id: 'payment', label: t('form.paymentTab'), sections: [
                {
                  title: t('form.amountSection'), fields: [
                    { name: 'amount', label: t('form.amountExcl'), type: 'number', value: draft.amount, required: true, helpText: t('form.amountHelp') },
                    {
                      name: 'tax', label: t('form.tax'), type: 'custom',
                      render: (
                        <div className="proc-datetime">
                          <input className="o-input" type="number" min="0" step="0.01" aria-label={t('form.tax')} value={draft.tax} onChange={(event) => update({ tax: event.target.value })} />
                          <button type="button" className="o-btn o-btn-link o-btn-sm" disabled={!Number(draft.amount)} onClick={() => update({ tax: (Math.round(Number(draft.amount) * 15) / 100).toFixed(2) })}>{t('form.addVat')}</button>
                        </div>
                      ),
                    },
                    { name: 'total', label: t('form.totalPaid'), value: formatMoney(total), readOnly: true },
                  ],
                },
                {
                  title: t('form.proof'), fields: [
                    { name: 'paymentMethod', label: t('form.paidBy'), type: 'select', value: draft.paymentMethod, options: options.payment_methods },
                    { name: 'receiptNumber', label: t('form.receiptNo'), value: draft.receiptNumber, placeholder: t('form.receiptPlaceholder') },
                    ...(expense ? [{
                      name: 'receipt', label: t('form.receiptFile'), type: 'custom' as const,
                      render: (
                        <div className="proc-datetime">
                          {expense.receipt_url && <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="cat-row-link">{t('form.view')}</a>}
                          <input className="o-input" type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label={t('form.uploadReceipt')} disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadReceipt(file) }} />
                        </div>
                      ),
                    }] : []),
                  ],
                },
                { title: t('form.notes'), fields: [{ name: 'notes', label: t('form.notes'), type: 'textarea', value: draft.notes, fullWidth: true }] },
              ],
            },
          ]}
          onSubmit={(event) => void save(event)}
          dirty={dirty}
          onDiscard={() => {
            if (isNew) { navigate(-1); return }
            if (expense) setDraft(draftFrom(expense))
            setError('')
          }}
          saving={saving}
          saved={saved}
          submitLabel={isNew ? t('form.record') : t('form.save')}
          chatter={expense ? { model: 'expense', recordId: expense.id, refreshKey: chatterKey } : undefined}
        />
      )}
    </AdminShell>
  )
}
