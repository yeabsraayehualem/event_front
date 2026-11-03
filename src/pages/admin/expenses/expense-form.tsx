import { useCallback, useEffect, useState, type FormEvent } from 'react'
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

const fieldLabels = {
  amount: 'Amount', tax: 'Tax', purchase_order: 'Purchase order', scheduled_payment: 'Payment milestone',
  category: 'Category', description: 'Description', event: 'Event',
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
        apiRequest<ExpenseOptions>('/finance/expense-options/', { signal, fallback: 'Could not load expense options.' }),
        isNew ? Promise.resolve(null) : apiRequest<Expense>(`/finance/expenses/${id}/`, { signal, fallback: 'Could not load this expense.' }),
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
    if (draft.chargeTo === 'event' && !draft.event) { setError('Choose the event this cost belongs to.'); return }
    if (draft.chargeTo === 'bill' && !draft.purchaseOrder) { setError('Choose the purchase order this bill pays.'); return }
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
        method: isNew ? 'POST' : 'PATCH', body, fallback: 'Could not save this expense.', labels: fieldLabels,
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
      setError(saveError instanceof Error ? saveError.message : 'Could not save this expense.')
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
      if (!response.ok) throw new Error(getErrorMessage(data, 'Could not upload the receipt.'))
      setExpense(data as Expense)
      setChatterKey((key) => key + 1)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the receipt.')
    } finally {
      setUploading(false)
    }
  }

  async function remove() {
    if (!expense || !window.confirm(`Delete ${expense.reference}? This removes ${formatMoney(expense.total)} from the books.`)) return
    setError('')
    try {
      await apiRequest(`/finance/expenses/${expense.id}/`, { method: 'DELETE', fallback: 'Could not delete this expense.' })
      navigate('/dashboard/expenses', { replace: true })
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not delete this expense.')
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
    { value: 'overhead', label: 'Overhead (not tied to an event)' },
    { value: 'event', label: 'An event' },
    { value: 'bill', label: 'A purchase order (vendor bill)' },
  ]
  const orderOptions = orders.map((item) => ({ value: String(item.id), label: `${item.reference} · ${item.vendor_name} · ${formatMoney(item.remaining)} left` }))
  if (expense?.purchase_order && !orderOptions.some((item) => item.value === String(expense.purchase_order))) {
    orderOptions.push({ value: String(expense.purchase_order), label: expense.purchase_order_reference ?? '' })
  }
  const paymentOptions = (order?.payments ?? [])
    .filter((item) => !item.bill_id || String(item.id) === draft.scheduledPayment)
    .map((item) => ({ value: String(item.id), label: `${item.label} · ${formatMoney(item.amount)}${item.due_date ? ` · due ${formatDualDate(item.due_date)}` : ''}` }))

  const linkFields = draft.chargeTo === 'bill' ? [
    {
      name: 'purchaseOrder', label: 'Purchase order', type: 'select' as const, value: draft.purchaseOrder, required: true, readOnly: lockedBill,
      options: [{ value: '', label: orders.length ? 'Choose an approved order' : 'No approved orders to bill' }, ...orderOptions],
      helpText: order ? `${order.event_name} · ${formatMoney(order.remaining)} of ${formatMoney(order.total)} still to bill` : undefined,
    },
    ...(paymentOptions.length ? [{
      name: 'scheduledPayment', label: 'Pays milestone', type: 'select' as const, value: draft.scheduledPayment,
      options: [{ value: '', label: 'Not a scheduled payment' }, ...paymentOptions],
    }] : []),
  ] : [
    ...(draft.chargeTo === 'event' ? [{
      name: 'event', label: 'Event', type: 'select' as const, value: draft.event, required: true,
      options: [{ value: '', label: 'Choose an event' }, ...options.events.map((item) => ({ value: String(item.id), label: `${item.name} · ${formatDualDate(item.event_date)}` }))],
    }] : []),
    {
      name: 'vendor', label: 'Vendor', type: 'select' as const, value: draft.vendor,
      options: [{ value: '', label: 'Not a registered vendor' }, ...options.vendors.map((item) => ({ value: String(item.id), label: item.name }))],
    },
    ...(!draft.vendor ? [{ name: 'payee', label: 'Paid to', value: draft.payee, placeholder: 'e.g. Total fuel station' }] : []),
  ]

  return (
    <AdminShell>
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {(isNew || expense) && (
        <RecordFormView
          modelName="Expense"
          title={expense?.reference ?? ''}
          subtitle={expense ? `${expense.category_name} · ${expense.event_name ?? 'Overhead'}` : 'Money spent: a vendor bill, an event cost or overhead.'}
          recordId={expense?.id}
          backHref="/dashboard/expenses"
          backLabel="Expenses"
          actionSlot={expense && <>
            {expense.purchase_order && <Link to={`/dashboard/purchase-orders/${expense.purchase_order}`} className="o-btn o-btn-secondary">Open {expense.purchase_order_reference}</Link>}
            <button type="button" className="o-btn o-btn-link o-btn-danger" onClick={() => void remove()}>Delete</button>
          </>}
          headerAside={<>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">Br</span>
              <span><strong>{formatMoney(total)}</strong><small>Paid</small></span>
            </div>
            {expense && (
              <div className={`o-stat-button${expense.receipt_url ? '' : ' is-muted'}`}>
                <span className="o-stat-icon" aria-hidden="true">✓</span>
                <span><strong>{expense.receipt_url ? 'Attached' : 'None'}</strong><small>Receipt</small></span>
              </div>
            )}
          </>}
          headerFields={[
            { name: 'description', label: 'Description', value: draft.description, required: true, placeholder: 'e.g. Fuel for the delivery van' },
            { name: 'date', label: 'Date', type: 'date', value: draft.date, required: true },
            { name: 'category', label: 'Category', type: 'select', value: draft.category, required: true, options: options.categories.map((item) => ({ value: String(item.id), label: item.name })) },
            { name: 'chargeTo', label: 'Charged to', type: 'select', value: draft.chargeTo, readOnly: lockedBill, options: chargeOptions },
            ...linkFields,
          ]}
          onFieldChange={(name, value) => {
            if (name === 'purchaseOrder') return chooseOrder(value)
            if (name === 'scheduledPayment') return choosePayment(value)
            update({ [name]: value } as Partial<Draft>)
          }}
          tabs={[
            {
              id: 'payment', label: 'Payment', sections: [
                {
                  title: 'Amount', fields: [
                    { name: 'amount', label: 'Amount excl. VAT', type: 'number', value: draft.amount, required: true, helpText: 'This is what counts as expense on the dashboard.' },
                    {
                      name: 'tax', label: 'Tax', type: 'custom',
                      render: (
                        <div className="proc-datetime">
                          <input className="o-input" type="number" min="0" step="0.01" aria-label="Tax" value={draft.tax} onChange={(event) => update({ tax: event.target.value })} />
                          <button type="button" className="o-btn o-btn-link o-btn-sm" disabled={!Number(draft.amount)} onClick={() => update({ tax: (Math.round(Number(draft.amount) * 15) / 100).toFixed(2) })}>+15% VAT</button>
                        </div>
                      ),
                    },
                    { name: 'total', label: 'Total paid', value: formatMoney(total), readOnly: true },
                  ],
                },
                {
                  title: 'Proof', fields: [
                    { name: 'paymentMethod', label: 'Paid by', type: 'select', value: draft.paymentMethod, options: options.payment_methods },
                    { name: 'receiptNumber', label: 'Receipt no.', value: draft.receiptNumber, placeholder: 'Invoice or receipt number' },
                    ...(expense ? [{
                      name: 'receipt', label: 'Receipt file', type: 'custom' as const,
                      render: (
                        <div className="proc-datetime">
                          {expense.receipt_url && <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="cat-row-link">View</a>}
                          <input className="o-input" type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label="Upload receipt" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadReceipt(file) }} />
                        </div>
                      ),
                    }] : []),
                  ],
                },
                { title: 'Notes', fields: [{ name: 'notes', label: 'Notes', type: 'textarea', value: draft.notes, fullWidth: true }] },
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
          submitLabel={isNew ? 'Record' : 'Save'}
          chatter={expense ? { model: 'expense', recordId: expense.id, refreshKey: chatterKey } : undefined}
        />
      )}
    </AdminShell>
  )
}
