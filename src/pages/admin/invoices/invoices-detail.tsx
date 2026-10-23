import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminNavigationItems } from '@/components/admin-navigation'
import { SideNav } from '@/components/side-nav'
import { apiBaseUrl } from '@/lib/api'

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

type ContentOption = { id: number; name: string }
type TaxProfile = { id: number; name: string; kind: string; rate: string; inclusive: boolean }
type EditableLine = { key: string; contentId: number | ''; amount: string; taxProfileIds: number[] }

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('en-ET', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

function formatAmount(value: string | number) {
  const amount = Number(value)
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' }).format(amount)
    : value
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
  const [lines, setLines] = useState<EditableLine[]>([])
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
        setDueDate(loadedInvoice.due_date ?? '')
        setLines(loadedInvoice.lines.map((line) => ({
          key: String(line.id),
          contentId: line.selected_content_id,
          amount: line.inclusive_price,
          taxProfileIds: line.selected_tax_profile_ids ?? [],
        })))
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

  const updateLine = (key: string, update: Partial<EditableLine>) => {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...update } : line))
  }

  const addLine = () => setLines((current) => [...current, {
    key: `new-${Date.now()}`,
    contentId: contents[0]?.id ?? '',
    amount: '0.00',
    taxProfileIds: [],
  }])

  const saveInvoice = async () => {
    if (!id || !invoice) return
    if (lines.length === 0) {
      setError('An invoice needs at least one line.')
      return
    }
    if (lines.some((line) => !line.contentId || line.amount.trim() === '' || Number(line.amount) < 0)) {
      setError('Choose a service and enter a valid amount for every line.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/user/csrf/`, {
        credentials: 'include', headers: { Accept: 'application/json' },
      })
      const csrfData = await csrfResponse.json()
      if (!csrfResponse.ok || typeof csrfData.csrf_token !== 'string') {
        throw new Error('Could not prepare a secure save. Reload the page and try again.')
      }

      const response = await fetch(`${apiBaseUrl}/finance/invoices/${encodeURIComponent(id)}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfData.csrf_token },
        body: JSON.stringify({
          due_date: dueDate || null,
          status: invoice.status,
          lines: lines.map((line) => ({
            content_id: line.contentId,
            inclusive_price: line.amount,
            tax_profile_ids: line.taxProfileIds,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(data, 'Could not save this invoice.'))

      const savedInvoice = data as Invoice
      setInvoice(savedInvoice)
      setDueDate(savedInvoice.due_date ?? '')
      setLines(savedInvoice.lines.map((line) => ({
        key: String(line.id), contentId: line.selected_content_id,
        amount: line.inclusive_price, taxProfileIds: line.selected_tax_profile_ids ?? [],
      })))
      setNotice('Invoice saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this invoice.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link to="/dashboard/invoices" className="record-form-back inline-flex items-center gap-2">
              <span aria-hidden="true">←</span> Back to invoices
            </Link>
            {!loading && invoice && <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => window.print()} className="invoice-export-action min-h-10 rounded-lg border border-[#d8cba8] bg-white px-5 text-sm font-medium text-[#53614a] transition-colors hover:bg-[#f7f1e2]">Export PDF</button>
              <button type="button" onClick={() => void saveInvoice()} disabled={saving} className="invoice-primary-action min-h-10 rounded-lg bg-[#28513c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1d3d2c] disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
            </div>}
          </div>

          {loading ? (
            <div className="invoice-panel mt-5 p-8 text-sm text-[#77766c]">Loading invoice…</div>
          ) : error && !invoice ? (
            <section className="invoice-panel mt-5 p-8" role="alert">
              <h1 className="text-xl font-semibold text-[#294635]">Could not open invoice</h1>
              <p className="mt-2 text-sm text-[#77766c]">{error}</p>
            </section>
          ) : invoice ? (
            <>
              <header className="mb-6 mt-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="dashboard-date mb-2">Invoice details</p>
                  <h1 className="dashboard-title">{invoice.reference}</h1>
                  <p className="dashboard-subtitle">{invoice.customer_name}</p>
                </div>
                <div className="rounded-xl border border-[#e5e1d6] bg-white px-5 py-3 text-right shadow-sm">
                  <p className="text-xs text-[#77766c]">Current total</p>
                  <p className="mt-1 text-xl font-semibold text-[#294635]">{formatAmount(invoice.total)}</p>
                </div>
              </header>

              {error && <p className="mb-4 rounded-lg border border-[#e7c9c1] bg-[#fbf0ed] px-4 py-3 text-sm text-[#9a4d3c]" role="alert">{error}</p>}
              {notice && <p className="mb-4 rounded-lg border border-[#d6e1d3] bg-[#eff5ed] px-4 py-3 text-sm text-[#42674b]" role="status">{notice}</p>}

              <section className="invoice-panel grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-2" aria-label="Invoice information">
                <div><label htmlFor="invoice-customer" className="text-xs text-[#858174]">Customer</label><input id="invoice-customer" value={invoice.customer_name} readOnly className="mt-1 block w-full rounded-lg border border-[#eeeae0] bg-[#faf9f6] px-3 py-2 text-sm text-[#32372f]" /></div>
                <div><label htmlFor="invoice-plan" className="text-xs text-[#858174]">Plan</label><input id="invoice-plan" value={invoice.plan_name || ''} readOnly className="mt-1 block w-full rounded-lg border border-[#eeeae0] bg-[#faf9f6] px-3 py-2 text-sm text-[#32372f]" /></div>
                <div><label htmlFor="invoice-package" className="text-xs text-[#858174]">Package</label><input id="invoice-package" value={invoice.package_name || '—'} readOnly className="mt-1 block w-full rounded-lg border border-[#eeeae0] bg-[#faf9f6] px-3 py-2 text-sm text-[#32372f]" /></div>
                <div><label htmlFor="invoice-issued" className="text-xs text-[#858174]">Issue date</label><input id="invoice-issued" value={formatDate(invoice.date)} readOnly className="mt-1 block w-full rounded-lg border border-[#eeeae0] bg-[#faf9f6] px-3 py-2 text-sm text-[#32372f]" /></div>
                <div><label htmlFor="invoice-due-date" className="text-xs text-[#858174]">Due date</label><input id="invoice-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-[#e5e1d6] bg-white px-3 py-2 text-sm text-[#32372f] focus:border-[#71836a] focus:outline-none focus:ring-2 focus:ring-[#71836a]/15" /></div>
                <div><label htmlFor="invoice-status" className="text-xs text-[#858174]">Payment status</label><select id="invoice-status" value={invoice.status} onChange={(event) => setInvoice({ ...invoice, status: event.target.value as Invoice['status'] })} className="mt-1 block w-full rounded-lg border border-[#e5e1d6] bg-white px-3 py-2 text-sm text-[#32372f] focus:border-[#71836a] focus:outline-none focus:ring-2 focus:ring-[#71836a]/15"><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></div>
              </section>

              <section className="invoice-panel mt-5 overflow-x-auto" aria-label="Editable invoice lines">
                <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                  <thead><tr>
                    <th scope="col" className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Service</th>
                    <th scope="col" className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Price</th>
                    <th scope="col" className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Taxes</th>
                    <th scope="col" className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">Saved amount</th>
                    <th scope="col" className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">&nbsp;</th>
                  </tr></thead>
                  <tbody>
                    {lines.map((line) => {
                      const savedLine = invoice.lines.find((item) => String(item.id) === line.key)
                      return <tr key={line.key} className="border-t border-[#e5e1d6] align-top">
                        <td className="px-5 py-4">
                          <select aria-label="Invoice service" value={line.contentId} onChange={(event) => updateLine(line.key, { contentId: event.target.value ? Number(event.target.value) : '' })} className="min-h-10 w-full rounded-lg border border-[#e5e1d6] bg-white px-3 text-sm text-[#32372f] focus:border-[#71836a] focus:outline-none focus:ring-2 focus:ring-[#71836a]/15">
                            <option value="">Choose a service</option>
                            {contents.map((content) => <option key={content.id} value={content.id}>{content.name}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <input aria-label="Line price" type="number" min="0" step="0.01" value={line.amount} onChange={(event) => updateLine(line.key, { amount: event.target.value })} className="min-h-10 w-36 rounded-lg border border-[#e5e1d6] bg-white px-3 text-right text-sm text-[#32372f] focus:border-[#71836a] focus:outline-none focus:ring-2 focus:ring-[#71836a]/15" />
                        </td>
                        <td className="px-5 py-4">
                          {taxProfiles.length ? <div className="grid gap-2">
                            {taxProfiles.map((tax) => <label key={tax.id} className="flex items-center gap-2 text-xs text-[#53614a]">
                              <input type="checkbox" checked={line.taxProfileIds.includes(tax.id)} onChange={(event) => updateLine(line.key, { taxProfileIds: event.target.checked ? [...line.taxProfileIds, tax.id] : line.taxProfileIds.filter((taxId) => taxId !== tax.id) })} className="accent-[#28513c]" />
                              <span>{tax.name} ({tax.rate}%)</span>
                            </label>)}
                          </div> : <span className="text-xs text-[#77766c]">Default VAT (15%)</span>}
                        </td>
                        <td className="px-5 py-4 text-right text-[#77766c]">{savedLine ? formatAmount(savedLine.total) : 'After save'}</td>
                        <td className="px-5 py-4 text-right"><button type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} disabled={lines.length === 1} className="text-xs font-medium text-[#9a4d3c] hover:underline disabled:cursor-not-allowed disabled:opacity-40">Remove</button></td>
                      </tr>
                    })}
                  </tbody>
                </table>
                <div className="border-t border-[#efede5] px-5 py-4">
                  <button type="button" onClick={addLine} disabled={!contents.length} className="rounded-lg border border-[#d8cba8] bg-[#f7f1e2] px-4 py-2 text-sm font-medium text-[#53614a] transition-colors hover:bg-[#f1ead7] disabled:cursor-not-allowed disabled:opacity-50">+ Add a line</button>
                </div>
              </section>

              <section className="invoice-panel mt-5 ml-auto max-w-md p-6" aria-label="Saved tax summary">
                <h2 className="mb-3 font-semibold text-[#294635]">Saved tax summary</h2>
                {invoice.tax_breakdown.length ? invoice.tax_breakdown.map((tax) => (
                  <div key={tax.kind} className="flex justify-between gap-4 border-t border-[#efede5] py-2 text-sm">
                    <span className="text-[#77766c]">{tax.kind}</span><span>{formatAmount(tax.amount)}</span>
                  </div>
                )) : <p className="text-sm text-[#77766c]">No tax recorded.</p>}
                <div className="mt-2 flex justify-between border-t border-[#e5e1d6] pt-3 font-semibold text-[#294635]">
                  <span>Total</span><span>{formatAmount(invoice.total)}</span>
                </div>
              </section>
              <div className="mt-5 flex justify-end pb-8">
                <button type="button" onClick={() => void saveInvoice()} disabled={saving} className="invoice-primary-action min-h-10 rounded-lg bg-[#28513c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1d3d2c] disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
              </div>

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
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
