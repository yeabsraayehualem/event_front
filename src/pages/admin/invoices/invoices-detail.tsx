import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import i18n from '@/i18n'
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
  if (!value) return i18n.t('invoices:detail.notSet')
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
  const { t } = useTranslation('invoices')
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
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setError(i18n.t('invoices:detail.missingId'))
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
        if (!invoiceResponse.ok) throw new Error(getErrorMessage(invoiceData, i18n.t('invoices:detail.loadFailed')))
        if (!optionsResponse.ok) throw new Error(getErrorMessage(optionsData, i18n.t('invoices:detail.loadOptions')))

        const loadedInvoice = invoiceData as Invoice
        setInvoice(loadedInvoice)
        setContents(optionsData.contents ?? [])
        setTaxProfiles(optionsData.tax_profiles ?? [])
        resetDraft(loadedInvoice)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : i18n.t('invoices:detail.loadFailed'))
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
    setSaved(false)
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
      if (!response.ok) throw new Error(getErrorMessage(data, t('detail.saveFailed')))

      const savedInvoice = data as Invoice
      setInvoice(savedInvoice)
      resetDraft(savedInvoice)
      setSaved(true)
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('detail.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const statusLabel = (value: Invoice['status']) => t(`status.${value}`)

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
        <div className="o-totals-grand"><span>{t('detail.total')}</span><strong>{formatAmount(invoice.total)}</strong></div>
        {dirty && <small>{t('record.totalsAfterSave')}</small>}
      </div>
    </>
  )

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Hadafe Nefs" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {loading && <div className="o-form-loading" role="status" aria-label={t('detail.loading')}><span /><span /><span /></div>}
          {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}

          {invoice && (
            <RecordFormView
              modelName={t('model')}
              title={invoice.reference}
              subtitle={invoice.customer_name}
              recordId={invoice.id}
              backHref="/dashboard/invoices"
              backLabel={t('form.backInvoices')}
              ribbon={invoice.status === 'paid' ? { label: statusLabel('paid'), tone: 'success' } : null}
              status={status}
              statusOptions={[{ value: 'unpaid', label: statusLabel('unpaid') }, { value: 'paid', label: statusLabel('paid') }]}
              onStatusChange={(value) => { setStatus(value as Invoice['status']); setSaved(false) }}
              actionSlot={<>
                {status === 'unpaid' && <button type="button" className="o-btn o-btn-primary" onClick={() => { setStatus('paid'); setSaved(false) }}>{t('record.markPaid')}</button>}
                <button type="button" className="o-btn o-btn-secondary" onClick={() => window.print()} disabled={dirty} title={dirty ? t('record.saveBeforePrint') : undefined}>{t('record.printPdf')}</button>
              </>}
              headerAside={
                <div className="o-stat-button">
                  <span className="o-stat-icon" aria-hidden="true">Br</span>
                  <span><strong>{formatAmount(invoice.total)}</strong><small>{t('detail.total')}</small></span>
                </div>
              }
              headerFields={[
                { name: 'customer', label: t('form.customer'), value: invoice.customer_name, readOnly: true },
                { name: 'date', label: t('record.invoiceDate'), type: 'date', value: invoice.date, readOnly: true },
                { name: 'plan', label: t('form.plan'), value: invoice.plan_name, readOnly: true },
                { name: 'due_date', label: t('form.dueDate'), type: 'date', value: dueDate },
                { name: 'package', label: t('form.package'), value: invoice.package_name, readOnly: true },
                { name: 'milestone', label: t('form.milestone'), value: milestone, placeholder: t('form.milestonePlaceholder') },
              ]}
              onFieldChange={(name, value) => {
                setSaved(false)
                if (name === 'due_date') setDueDate(value)
                if (name === 'milestone') setMilestone(value)
              }}
              tabs={[{ id: 'lines', label: t('form.linesTab'), badge: lines.length, content: linesPage }]}
              onSubmit={(event) => void saveInvoice(event)}
              dirty={dirty}
              onDiscard={() => { resetDraft(invoice); setError('') }}
              saving={saving}
              saved={saved}
              chatter={{ model: 'invoice', recordId: invoice.id, refreshKey: chatterKey }}
            >
              <article className="invoice-printable" aria-label={t('print.label')}>
                <header className="invoice-print-header">
                  <div>
                    <p className="invoice-print-brand">{t('print.brand')}</p>
                    <p className="invoice-print-muted">{t('print.tagline')}</p>
                  </div>
                  <div className="invoice-print-title">
                    <p>{t('print.title')}</p>
                    <h1>{invoice.reference}</h1>
                  </div>
                </header>
                <div className="invoice-print-meta">
                  <div><span>{t('print.billTo')}</span><strong>{invoice.customer_name}</strong></div>
                  <div><span>{t('print.issueDate')}</span><strong>{formatDate(invoice.date)}</strong></div>
                  <div><span>{t('print.dueDate')}</span><strong>{formatDate(invoice.due_date)}</strong></div>
                  <div><span>{t('print.status')}</span><strong>{statusLabel(invoice.status)}</strong></div>
                  {invoice.milestone_name && <div><span>{t('print.milestone')}</span><strong>{invoice.milestone_name}</strong></div>}
                </div>
                <div className="invoice-print-scope">
                  <span>{t('print.plan')}</span><strong>{invoice.plan_name || '—'}</strong>
                  <span>{t('print.package')}</span><strong>{invoice.package_name || '—'}</strong>
                  {invoice.event && <><span>{t('print.eventRef')}</span><strong>#{invoice.event}</strong></>}
                </div>
                <table className="invoice-print-table">
                  <thead><tr><th>{t('print.description')}</th><th>{t('print.subtotal')}</th><th>{t('print.tax')}</th><th>{t('print.amount')}</th></tr></thead>
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
                  <div className="invoice-print-grand-total"><span>{t('print.totalDue')}</span><strong>{formatAmount(invoice.total)}</strong></div>
                </section>
                <footer className="invoice-print-footer">{t('print.thanks')}</footer>
              </article>
            </RecordFormView>
          )}
        </div>
      </main>
    </div>
  )
}
