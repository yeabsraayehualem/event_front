import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { adminNavigationItems } from '@/components/admin-navigation'
import { SideNav } from '@/components/side-nav'
import { apiBaseUrl } from '@/lib/api'
import { fetchCsrfToken } from '@/lib/csrf'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { RecordFormView } from '@/components/admin/record-form-view'
import {
  InvoiceLinesEditor, formatAmount, invalidInvoiceLines, invoiceLinesPayload,
  type ContentOption, type EditableLine, type TaxProfile,
} from './invoice-lines-editor'

type InvoiceLine = {
  id: number
  selected_content_id: number
  content_name: string
  inclusive_price: string
  price: string
  tax: string
  total: string
  selected_tax_profile_ids: number[]
  tax_components: Array<{ name: string; kind: string; rate: string; amount: string }>
}

type Invoice = {
  id: number
  reference: string
  event: number | null
  customer_name: string
  plan_name: string
  package_name: string | null
  milestone_name: string
  date: string
  due_date: string | null
  total: string
  status: 'paid' | 'unpaid'
  lines: InvoiceLine[]
  tax_breakdown: Array<{ kind: string; amount: string }>
}

function editableLines(invoice: Invoice): EditableLine[] {
  return invoice.lines.map((line) => ({
    key: String(line.id),
    contentId: line.selected_content_id,
    amount: line.inclusive_price,
    taxProfileIds: line.selected_tax_profile_ids ?? [],
  }))
}

function linesSignature(lines: EditableLine[]) {
  return JSON.stringify(lines.map((line) => [line.contentId, Number(line.amount), [...line.taxProfileIds].sort()]))
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return formatDualDate(value)
}

function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null) {
    const values = data as Record<string, unknown>
    if (typeof values.detail === 'string') return values.detail
    if (typeof values.message === 'string') return values.message
    return Object.entries(values).map(([field, message]) => `${field}: ${Array.isArray(message) ? message.join(', ') : String(message)}`).join(' · ')
  }
  return fallback
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [contents, setContents] = useState<ContentOption[]>([])
  const [taxProfiles, setTaxProfiles] = useState<TaxProfile[]>([])
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<Invoice['status']>('unpaid')
  const [milestone, setMilestone] = useState('')
  const [lines, setLines] = useState<EditableLine[]>([])
  const [chatterKey, setChatterKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!id) {
      setError('Invoice number is missing from the page address.')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const loadInvoice = async () => {
      setLoading(true)
      setError('')
      try {
        const [invoiceResponse, optionsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/finance/invoices/${encodeURIComponent(id)}/`, {
            credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' },
          }),
          fetch(`${apiBaseUrl}/finance/invoice-editor-options/`, {
            credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' },
          }),
        ])
        const [invoiceData, optionsData] = await Promise.all([invoiceResponse.json(), optionsResponse.json()])
        if (!invoiceResponse.ok) throw new Error(getErrorMessage(invoiceData, 'Could not load this invoice.'))
        if (!optionsResponse.ok) throw new Error(getErrorMessage(optionsData, 'Could not load invoice editing options.'))

        const loadedInvoice = invoiceData as Invoice
        setInvoice(loadedInvoice)
        setContents(optionsData.contents ?? [])
        setTaxProfiles(optionsData.tax_profiles ?? [])
        resetDraft(loadedInvoice)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load this invoice.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadInvoice()
    return () => controller.abort()
  }, [id])

  function resetDraft(source: Invoice) {
    setDueDate(source.due_date ?? '')
    setStatus(source.status)
    setMilestone(source.milestone_name ?? '')
    setLines(editableLines(source))
  }

  const dirty = Boolean(invoice) && (
    dueDate !== (invoice?.due_date ?? '')
    || status !== invoice?.status
    || milestone !== (invoice?.milestone_name ?? '')
    || linesSignature(lines) !== linesSignature(invoice ? editableLines(invoice) : [])
  )

  const saveInvoice = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!id || !invoice) return
    const linesError = invalidInvoiceLines(lines)
    if (linesError) {
      setError(linesError)
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const csrfToken = await fetchCsrfToken()

      const response = await fetch(`${apiBaseUrl}/finance/invoices/${encodeURIComponent(id)}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({
          due_date: dueDate || null,
          status,
          milestone_name: milestone,
          lines: invoiceLinesPayload(lines),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(data, 'Could not save this invoice.'))

      const savedInvoice = data as Invoice
      setInvoice(savedInvoice)
      resetDraft(savedInvoice)
      setNotice('Invoice saved.')
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this invoice.')
    } finally {
      setSaving(false)
    }
  }

  const linesPage = invoice && (
    <>
      <InvoiceLinesEditor
        lines={lines}
        setLines={setLines}
        contents={contents}
        taxProfiles={taxProfiles}
        savedTotals={Object.fromEntries(invoice.lines.map((line) => [String(line.id), line.total]))}
      />

      <div className="o-totals">
        {invoice.tax_breakdown.map((tax) => (
          <div key={tax.kind}><span>{tax.kind}</span><span>{formatAmount(tax.amount)}</span></div>
        ))}
        <div className="o-totals-grand"><span>Total</span><strong>{formatAmount(invoice.total)}</strong></div>
        {dirty && <small>Totals refresh after you save.</small>}
      </div>
    </>
  )

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {loading && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
          {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}

          {invoice && (
            <RecordFormView
              modelName="Invoice"
              title={invoice.reference}
              subtitle={invoice.customer_name}
              recordId={invoice.id}
              backHref="/dashboard/invoices"
              backLabel="Invoices"
              ribbon={invoice.status === 'paid' ? { label: 'Paid', tone: 'success' } : null}
              status={status}
              statusOptions={[{ value: 'unpaid', label: 'Unpaid' }, { value: 'paid', label: 'Paid' }]}
              onStatusChange={(value) => { setStatus(value as Invoice['status']); setNotice('') }}
              actionSlot={<>
                {status === 'unpaid' && <button type="button" className="o-btn o-btn-primary" onClick={() => { setStatus('paid'); setNotice('') }}>Mark as paid</button>}
                <button type="button" className="o-btn o-btn-secondary" onClick={() => window.print()} disabled={dirty} title={dirty ? 'Save your changes before printing' : undefined}>Print / PDF</button>
              </>}
              headerAside={
                <div className="o-stat-button">
                  <span className="o-stat-icon" aria-hidden="true">Br</span>
                  <span><strong>{formatAmount(invoice.total)}</strong><small>Total</small></span>
                </div>
              }
              headerFields={[
                { name: 'customer', label: 'Customer', value: invoice.customer_name, readOnly: true },
                { name: 'date', label: 'Invoice date', type: 'date', value: invoice.date, readOnly: true },
                { name: 'plan', label: 'Plan', value: invoice.plan_name, readOnly: true },
                { name: 'due_date', label: 'Due date', type: 'date', value: dueDate },
                { name: 'package', label: 'Package', value: invoice.package_name, readOnly: true },
                { name: 'milestone', label: 'Milestone', value: milestone, placeholder: 'e.g. Deposit' },
              ]}
              onFieldChange={(name, value) => {
                setNotice('')
                if (name === 'due_date') setDueDate(value)
                if (name === 'milestone') setMilestone(value)
              }}
              tabs={[{ id: 'lines', label: 'Invoice lines', badge: lines.length, content: linesPage }]}
              onSubmit={(event) => void saveInvoice(event)}
              dirty={dirty}
              onDiscard={() => { resetDraft(invoice); setError('') }}
              saving={saving}
              saved={notice === 'Invoice saved.'}
              chatter={{ model: 'invoice', recordId: invoice.id, refreshKey: chatterKey }}
            >
              <article className="invoice-printable" aria-label="Printable client invoice">
                <header className="invoice-print-header">
                  <div>
                    <p className="invoice-print-brand">Bahran Events</p>
                    <p className="invoice-print-muted">Event planning and experiences</p>
                  </div>
                  <div className="invoice-print-title">
                    <p>INVOICE</p>
                    <h1>{invoice.reference}</h1>
                  </div>
                </header>
                <div className="invoice-print-meta">
                  <div><span>Bill to</span><strong>{invoice.customer_name}</strong></div>
                  <div><span>Issue date</span><strong>{formatDate(invoice.date)}</strong></div>
                  <div><span>Due date</span><strong>{formatDate(invoice.due_date)}</strong></div>
                  <div><span>Status</span><strong>{invoice.status === 'paid' ? 'Paid' : 'Unpaid'}</strong></div>
                  {invoice.milestone_name && <div><span>Milestone</span><strong>{invoice.milestone_name}</strong></div>}
                </div>
                <div className="invoice-print-scope">
                  <span>Plan</span><strong>{invoice.plan_name || '—'}</strong>
                  <span>Package</span><strong>{invoice.package_name || '—'}</strong>
                  {invoice.event && <><span>Event reference</span><strong>#{invoice.event}</strong></>}
                </div>
                <table className="invoice-print-table">
                  <thead><tr><th>Description</th><th>Subtotal</th><th>Tax</th><th>Amount</th></tr></thead>
                  <tbody>{invoice.lines.map((line) => <tr key={line.id}>
                    <td><strong>{line.content_name}</strong>{line.tax_components.length > 0 && <small>{line.tax_components.map((tax) => `${tax.name} ${tax.rate}%`).join(' · ')}</small>}</td>
                    <td>{formatAmount(line.price)}</td>
                    <td>{formatAmount(line.tax)}</td>
                    <td>{formatAmount(line.total)}</td>
                  </tr>)}</tbody>
                </table>
                <section className="invoice-print-totals">
                  <div className="invoice-print-tax-breakdown">
                    {invoice.tax_breakdown.map((tax) => <div key={tax.kind}><span>{tax.kind}</span><span>{formatAmount(tax.amount)}</span></div>)}
                  </div>
                  <div className="invoice-print-grand-total"><span>Total due</span><strong>{formatAmount(invoice.total)}</strong></div>
                </section>
                <footer className="invoice-print-footer">Thank you for choosing Bahran Events.</footer>
              </article>
            </RecordFormView>
          )}
        </div>
      </main>
    </div>
  )
}
