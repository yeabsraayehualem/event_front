import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Add01Icon, ArrowDown01Icon, ArrowRight01Icon, Delete02Icon, PauseIcon, PlayIcon, PrinterIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { AdminShell } from '@/components/admin/admin-shell'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { apiBaseUrl } from '@/lib/api'
import { apiRequest } from '@/lib/api-request'
import { getErrorMessage } from '@/lib/api-errors'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { formatMoney } from '../procurement/types'
import { monthLabel, type PayRun, type Payslip, type PayslipLine } from './types'

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'mobile_money', label: 'Mobile money' },
]

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

type NewLine = { kind: 'earning' | 'deduction'; description: string; amount: string }

export function PayRunPage() {
  const { id } = useParams<{ id: string }>()
  const [run, setRun] = useState<PayRun | null>(null)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [newLine, setNewLine] = useState<Record<number, NewLine | undefined>>({})
  const [paidOn, setPaidOn] = useState(todayIso())
  const [method, setMethod] = useState('bank_transfer')
  const [printOnly, setPrintOnly] = useState<number | null>(null)
  const [accountEdit, setAccountEdit] = useState<{ id: number; value: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setRun(await apiRequest<PayRun>(`/hr/pay-runs/${id}/`, { signal, fallback: 'Could not load this pay run.' }))
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    const reset = () => setPrintOnly(null)
    window.addEventListener('afterprint', reset)
    return () => window.removeEventListener('afterprint', reset)
  }, [])

  /** Run a request that answers with the updated pay run. */
  async function act(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown, done?: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      setRun(await apiRequest<PayRun>(path, { method, body, fallback: 'Could not update the pay run.' }))
      if (done) setNotice(done)
      return true
    } catch (actError) {
      setError(actError instanceof Error ? actError.message : 'Could not update the pay run.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const transition = (action: string, extra: Record<string, unknown> = {}, done?: string) =>
    act(`/hr/pay-runs/${id}/transition/`, 'POST', { action, ...extra }, done)

  async function downloadBankFile() {
    if (!run) return
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/hr/pay-runs/${run.id}/bank-file/`, { credentials: 'include' })
      if (!response.ok) throw new Error(getErrorMessage(await response.json(), 'Could not export the bank file.'))
      const url = URL.createObjectURL(await response.blob())
      const link = Object.assign(document.createElement('a'), { href: url, download: `${run.reference}-bank-transfers.csv` })
      link.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not export the bank file.')
    }
  }

  async function saveAccount(slip: Payslip) {
    if (!accountEdit || accountEdit.id !== slip.id) return
    const value = accountEdit.value.trim()
    setAccountEdit(null)
    if (value !== slip.payment_account) await act(`/hr/payslips/${slip.id}/`, 'PATCH', { payment_account: value })
  }

  function print(slipId: number | null) {
    setPrintOnly(slipId)
    requestAnimationFrame(() => window.print())
  }

  const toggle = (slipId: number) => setOpen((current) => {
    const next = new Set(current)
    if (next.has(slipId)) next.delete(slipId)
    else next.add(slipId)
    return next
  })

  if (!run) {
    return (
      <AdminShell>
        {error ? <p className="dashboard-message dashboard-message--error" role="alert">{error}</p> : <div className="o-form-loading" role="status"><span /><span /><span /></div>}
      </AdminShell>
    )
  }

  const draft = run.status === 'draft'
  const month = monthLabel(run.period)
  const totals = run.totals
  const printed = run.payslips.filter((slip) => !slip.held && (printOnly === null || slip.id === printOnly))

  function slipDetail(slip: Payslip) {
    const pending = newLine[slip.id]
    const setPending = (changes: Partial<NewLine> | null) => setNewLine((current) => {
      const next = { ...current }
      if (changes === null) delete next[slip.id]
      else next[slip.id] = { ...(current[slip.id] ?? { kind: 'earning', description: '', amount: '' }), ...changes }
      return next
    })
    const earnings = slip.lines.filter((line) => line.kind === 'earning')
    const manualDeductions = slip.lines.filter((line) => line.kind === 'deduction')
    const calculated = [
      { label: 'Income tax', amount: slip.income_tax },
      { label: `Pension ${Number(run!.rules.employee_pension_rate)}%`, amount: slip.pension_employee },
      { label: `Withholding ${Number(run!.rules.freelance_withholding_rate)}%`, amount: slip.withholding },
    ].filter((item) => Number(item.amount) > 0)
    const deductionTotal = Number(slip.gross) - Number(slip.net)

    const removeButton = (line: PayslipLine) => draft && !line.is_basic && (
      <button type="button" className="pay-icon-btn is-danger pay-line-remove" aria-label={`Remove ${line.description}`}
        title={line.shift ? 'Take this shift off the payslip (it stays unpaid)' : 'Remove'} disabled={busy}
        onClick={() => void act(`/hr/payslips/${slip.id}/lines/${line.id}/`, 'DELETE')}>
        <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.8} />
      </button>
    )

    const addForm = (kind: NewLine['kind']) => {
      if (!draft) return null
      if (pending?.kind !== kind) {
        return (
          <button type="button" className="pay-add-toggle" onClick={() => setPending({ kind, description: '', amount: '' })}>
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />{kind === 'earning' ? 'Add pay' : 'Add deduction'}
          </button>
        )
      }
      const ready = pending.description.trim() && Number(pending.amount) > 0
      const submit = async () => { if (ready && await act(`/hr/payslips/${slip.id}/lines/`, 'POST', pending)) setPending(null) }
      return (
        <form className="pay-add-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <input className="o-input" autoFocus aria-label="Description" placeholder={kind === 'earning' ? 'e.g. Overtime, holiday bonus' : 'e.g. Salary advance'} value={pending.description} onChange={(event) => setPending({ description: event.target.value })} />
          <input className="o-input o-num" type="number" min="0.01" step="0.01" aria-label="Amount" placeholder="0.00" value={pending.amount} onChange={(event) => setPending({ amount: event.target.value })} />
          <button type="submit" className="o-btn o-btn-primary o-btn-sm" disabled={busy || !ready}>Add</button>
          <button type="button" className="o-btn o-btn-link o-btn-sm" onClick={() => setPending(null)}>Cancel</button>
        </form>
      )
    }

    return (
      <div className="pay-slip">
        <section className="pay-slip-col" aria-label="Earnings">
          <h4>Earnings</h4>
          <ul>
            {earnings.map((line) => (
              <li key={line.id}>
                {line.shift && line.event_name && line.description.startsWith(`${line.event_name} – `) ? (
                  <span className="pay-line-text is-stacked">
                    <span>{line.event_name}</span>
                    <small className="is-plain">{line.description.slice(line.event_name.length + 3)}</small>
                  </span>
                ) : (
                  <span className="pay-line-text">
                    {line.description}
                    {line.is_basic && <small>Basic salary</small>}
                  </span>
                )}
                {draft && line.is_basic ? (
                  <label className="pay-inline-amount-wrap" title="Change for unpaid leave or a partial month"><span>ETB</span><input className="o-input o-num pay-inline-amount" type="number" min="0" step="0.01" aria-label="Salary this month" title="Change for unpaid leave or a partial month"
                    defaultValue={line.amount} key={line.amount}
                    onBlur={(event) => { if (Number(event.target.value) !== Number(line.amount)) void act(`/hr/payslips/${slip.id}/lines/${line.id}/`, 'PATCH', { amount: event.target.value }) }} /></label>
                ) : <span className="pay-line-amount">{formatMoney(line.amount)}</span>}
                {removeButton(line)}
              </li>
            ))}
          </ul>
          {addForm('earning')}
          <div className="pay-slip-total"><span>Gross</span><strong>{formatMoney(slip.gross)}</strong></div>
        </section>

        <section className="pay-slip-col" aria-label="Deductions">
          <h4>Deductions</h4>
          <ul>
            {calculated.map((item) => (
              <li key={item.label}>
                <span className="pay-line-text">{item.label}<small className="is-auto">Calculated</small></span>
                <span className="pay-line-amount">−{formatMoney(item.amount)}</span>
              </li>
            ))}
            {manualDeductions.map((line) => (
              <li key={line.id}>
                <span className="pay-line-text">{line.description}</span>
                <span className="pay-line-amount">−{formatMoney(line.amount)}</span>
                {removeButton(line)}
              </li>
            ))}
            {calculated.length === 0 && manualDeductions.length === 0 && <li className="pay-line-empty">No deductions</li>}
          </ul>
          {addForm('deduction')}
          <div className="pay-slip-total"><span>Total deductions</span><strong>{deductionTotal ? `−${formatMoney(deductionTotal)}` : formatMoney(0)}</strong></div>
        </section>

        <aside className={`pay-slip-net${Number(slip.net) < 0 ? ' is-negative' : ''}`}>
          <span>Net pay</span>
          <strong>{formatMoney(slip.net)}</strong>
          <dl>
            <div><dt>Pay to</dt><dd>{slip.payment_account || <em>No account</em>}</dd></div>
            {Number(slip.pension_employer) > 0 && <div><dt>Company pension</dt><dd>{formatMoney(slip.pension_employer)}</dd></div>}
            <div><dt>Company cost</dt><dd>{formatMoney(slip.employer_cost)}</dd></div>
          </dl>
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" disabled={slip.held} onClick={() => print(slip.id)}>
            <HugeiconsIcon icon={PrinterIcon} size={15} strokeWidth={1.8} />Print payslip
          </button>
        </aside>
      </div>
    )
  }

  return (
    <AdminShell>
      <div className="dash">
        <div className="o-breadcrumb pay-breadcrumb">
          <Link to="/dashboard/payroll" className="o-breadcrumb-parent">Payroll</Link>
          <span className="o-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="o-breadcrumb-current">{run.reference}</span>
        </div>
        <div className="dash-header">
          <div>
            {(run.approved_by_name || run.paid_on) && <p className="dash-eyebrow">{run.approved_by_name ? `Approved by ${run.approved_by_name}` : ''}{run.paid_on ? ` · paid ${formatDualDate(run.paid_on)}` : ''}</p>}
            <h1 className="dash-title">{month} payroll <span className={`proc-status pay-status--${run.status}`}>{run.status_label}</span></h1>
          </div>
          <div className="pay-actions">
            {draft && <button type="button" className="o-btn o-btn-secondary" disabled={busy} title="Add anyone newly owed: new staff, or shifts marked worked since this was generated" onClick={() => void transition('refresh', {}, 'Payroll refreshed.')}>Refresh</button>}
            {draft && run.can_approve && <button type="button" className="o-btn o-btn-primary" disabled={busy} onClick={() => void transition('approve', {}, 'Approved. Download the bank file, then mark it paid once the transfers are done.')}>Approve</button>}
            {draft && !run.can_approve && <span className="cat-muted">Waiting for finance to approve.</span>}
            {run.status !== 'cancelled' && <button type="button" className="o-btn o-btn-secondary" onClick={() => print(null)}>Print payslips</button>}
            {(run.status === 'approved' || run.status === 'paid') && <button type="button" className="o-btn o-btn-secondary" onClick={() => void downloadBankFile()}>Bank file (CSV)</button>}
            {run.status === 'approved' && run.can_approve && <button type="button" className="o-btn o-btn-link" disabled={busy} onClick={() => void transition('reopen', {}, 'Reopened as a draft.')}>Reopen</button>}
            {(draft || (run.status === 'approved' && run.can_approve)) && (
              <button type="button" className="o-btn o-btn-link o-btn-danger" disabled={busy} onClick={() => { if (window.confirm(`Cancel ${run.reference}? Its shifts become unpaid again.`)) void transition('cancel', {}, 'Pay run cancelled.') }}>Cancel run</button>
            )}
          </div>
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {notice && <p className="o-inline-notice" role="status">{notice}</p>}
        {run.warnings.map((warning) => (
          <p key={warning.code} className="dashboard-message pay-warning" role="status">
            {warning.message}{warning.code === 'tax_table' && <> <Link to="/dashboard/payroll" className="dash-link">Review the tax table</Link></>}
          </p>
        ))}

        <div className="proc-budget pay-totals">
          <div><span>People paid</span><strong>{totals.people}</strong>{totals.held > 0 && <small>{totals.held} on hold</small>}</div>
          <div><span>Gross pay</span><strong>{formatMoney(totals.gross)}</strong></div>
          <div><span>Income tax</span><strong>{formatMoney(totals.income_tax)}</strong><small>To the tax authority</small></div>
          <div><span>Pension</span><strong>{formatMoney(Number(totals.pension_employee) + Number(totals.pension_employer))}</strong><small>{Number(run.rules.employee_pension_rate)}% staff + {Number(run.rules.employer_pension_rate)}% company</small></div>
          <div className="pay-total-net"><span>Net to pay</span><strong>{formatMoney(totals.net)}</strong></div>
          <div><span>Company cost</span><strong>{formatMoney(totals.employer_cost)}</strong><small>Booked as expense when paid</small></div>
        </div>

        {run.status === 'approved' && run.can_approve && (
          <section className="dash-card pay-mark-paid" aria-label="Mark as paid">
            <div>
              <strong>Transfers done?</strong>
              <span className="cat-muted">Marking paid records the expenses: salaries as overhead, freelance shifts on their events. Held payslips roll over to next month.</span>
            </div>
            <div className="pay-mark-paid-fields">
              <EthiopianDateInput value={paidOn} onChange={setPaidOn} />
              <select className="o-input proc-select" aria-label="Paid by" value={method} onChange={(event) => setMethod(event.target.value)}>
                {PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button type="button" className="o-btn o-btn-primary" disabled={busy} onClick={() => { if (window.confirm(`Mark ${run.reference} as paid: ${formatMoney(totals.net)} to ${totals.people} people?`)) void transition('pay', { paid_on: paidOn, payment_method: method }, 'Marked as paid. Expenses recorded.') }}>Mark as paid</button>
            </div>
          </section>
        )}

        <section className="dash-card dash-card--flush">
          {run.payslips.length === 0 ? <p className="dash-empty">No payslips on this run.</p> : (
            <div className="overflow-x-auto">
              <table className="dash-table pay-table">
                <thead><tr>
                  <th scope="col">Person</th><th scope="col" className="o-num">Gross</th><th scope="col" className="o-num">Deductions</th>
                  <th scope="col" className="o-num">Net pay</th><th scope="col">Pay to</th><th scope="col"><span className="sr-only">Actions</span></th>
                </tr></thead>
                <tbody>
                  {run.payslips.map((slip) => {
                    const expanded = open.has(slip.id)
                    const deductions = Number(slip.gross) - Number(slip.net)
                    const initials = slip.employee_name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
                    const editingAccount = accountEdit?.id === slip.id
                    return (
                      <Fragment key={slip.id}>
                        <tr className={`pay-row${expanded ? ' is-open' : ''}${slip.held ? ' is-held' : ''}${Number(slip.net) < 0 ? ' is-negative' : ''}`} onClick={() => toggle(slip.id)}>
                          <td>
                            <div className="pay-person">
                              <HugeiconsIcon icon={expanded ? ArrowDown01Icon : ArrowRight01Icon} size={16} strokeWidth={2} className="pay-chevron" />
                              <span className={`pay-avatar is-${slip.kind}`} aria-hidden="true">{initials}</span>
                              <span className="pay-person-text">
                                <button type="button" className="pay-person-name" aria-expanded={expanded} onClick={(event) => { event.stopPropagation(); toggle(slip.id) }}>{slip.employee_name}</button>
                                <span className="pay-person-meta">
                                  <span className={`pay-kind is-${slip.kind}`}>{slip.kind === 'salary' ? 'Salary' : `${slip.lines.filter((line) => line.shift).length} shifts`}</span>
                                  {slip.job_title && <span>{slip.job_title}</span>}
                                  {slip.held && <span className="pay-held">On hold</span>}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="o-num">{formatMoney(slip.gross)}</td>
                          <td className="o-num dash-muted" title={[
                            Number(slip.income_tax) && `Tax ${formatMoney(slip.income_tax)}`,
                            Number(slip.pension_employee) && `Pension ${formatMoney(slip.pension_employee)}`,
                            Number(slip.withholding) && `Withholding ${formatMoney(slip.withholding)}`,
                            Number(slip.other_deductions) && `Other ${formatMoney(slip.other_deductions)}`,
                          ].filter(Boolean).join(' · ') || undefined}>{deductions ? `−${formatMoney(deductions)}` : '—'}</td>
                          <td className="o-num"><strong className="pay-net">{formatMoney(slip.net)}</strong></td>
                          <td onClick={(event) => event.stopPropagation()}>
                            {draft && editingAccount ? (
                              <form className="pay-account-form" onSubmit={(event) => { event.preventDefault(); void saveAccount(slip) }}>
                                <input className="o-input" autoFocus aria-label={`Account for ${slip.employee_name}`} placeholder="Bank account or telebirr" value={accountEdit.value}
                                  onChange={(event) => setAccountEdit({ id: slip.id, value: event.target.value })}
                                  onBlur={() => void saveAccount(slip)} onKeyDown={(event) => { if (event.key === 'Escape') setAccountEdit(null) }} />
                              </form>
                            ) : (
                              <button type="button" className={`pay-account${slip.payment_account ? '' : ' is-missing'}`} disabled={!draft}
                                title={draft ? 'Click to change' : undefined} onClick={() => setAccountEdit({ id: slip.id, value: slip.payment_account })}>
                                {slip.payment_account || 'Add account'}
                              </button>
                            )}
                          </td>
                          <td className="pay-row-actions" onClick={(event) => event.stopPropagation()}>
                            {draft && (
                              <button type="button" className={`pay-icon-btn${slip.held ? ' is-active' : ''}`} disabled={busy} aria-label={slip.held ? `Include ${slip.employee_name}` : `Hold ${slip.employee_name}`}
                                title={slip.held ? 'Include in this run' : 'Hold: leave out of this run'} onClick={() => void act(`/hr/payslips/${slip.id}/`, 'PATCH', { held: !slip.held })}>
                                <HugeiconsIcon icon={slip.held ? PlayIcon : PauseIcon} size={16} strokeWidth={1.8} />
                              </button>
                            )}
                            <button type="button" className="pay-icon-btn" disabled={slip.held} aria-label={`Print payslip for ${slip.employee_name}`} title="Print payslip" onClick={() => print(slip.id)}>
                              <HugeiconsIcon icon={PrinterIcon} size={16} strokeWidth={1.8} />
                            </button>
                            {draft && (
                              <button type="button" className="pay-icon-btn is-danger" disabled={busy} aria-label={`Take ${slip.employee_name} off this run`} title="Take off this run"
                                onClick={() => { if (window.confirm(`Take ${slip.employee_name} off ${run.reference}?`)) void act(`/hr/payslips/${slip.id}/`, 'DELETE') }}>
                                <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {expanded && <tr className="pay-detail-row"><td colSpan={6}>{slipDetail(slip)}</td></tr>}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="invoice-printable pay-printable" aria-label="Printable payslips">
        {printOnly === null && (
          <article className="pay-print-page">
            <header className="invoice-print-header">
              <div><p className="invoice-print-brand">Bahran Events</p><p className="invoice-print-muted">Payroll summary</p></div>
              <div className="invoice-print-title"><p>PAYROLL</p><h1>{month}</h1></div>
            </header>
            <table className="invoice-print-table">
              <thead><tr><th>Name</th><th>Account</th><th>Gross</th><th>Tax</th><th>Pension</th><th>Other</th><th>Net</th></tr></thead>
              <tbody>{printed.map((slip) => (
                <tr key={slip.id}>
                  <td><strong>{slip.employee_name}</strong><small>{slip.kind_label}</small></td>
                  <td>{slip.payment_account || '—'}</td>
                  <td>{formatMoney(slip.gross)}</td><td>{formatMoney(slip.income_tax)}</td><td>{formatMoney(slip.pension_employee)}</td>
                  <td>{formatMoney(Number(slip.other_deductions) + Number(slip.withholding))}</td><td>{formatMoney(slip.net)}</td>
                </tr>
              ))}</tbody>
            </table>
            <section className="invoice-print-totals">
              <div className="invoice-print-tax-breakdown">
                <div><span>Gross</span><span>{formatMoney(totals.gross)}</span></div>
                <div><span>Income tax</span><span>{formatMoney(totals.income_tax)}</span></div>
                <div><span>Pension (staff + company)</span><span>{formatMoney(Number(totals.pension_employee) + Number(totals.pension_employer))}</span></div>
                <div><span>Company cost</span><span>{formatMoney(totals.employer_cost)}</span></div>
              </div>
              <div className="invoice-print-grand-total"><span>Net to pay</span><strong>{formatMoney(totals.net)}</strong></div>
            </section>
            <footer className="pay-print-sign">
              <span>Prepared by ____________________</span><span>Approved by {run.approved_by_name ?? '____________________'}</span>
            </footer>
          </article>
        )}
        {printed.map((slip) => (
          <article key={slip.id} className="pay-print-page">
            <header className="invoice-print-header">
              <div><p className="invoice-print-brand">Bahran Events</p><p className="invoice-print-muted">Payslip · {month}</p></div>
              <div className="invoice-print-title"><p>PAYSLIP</p><h1>{slip.employee_name}</h1></div>
            </header>
            <div className="invoice-print-meta">
              <div><span>Name</span><strong>{slip.employee_name}</strong></div>
              <div><span>Phone</span><strong>{slip.employee_phone}</strong></div>
              <div><span>Pay to</span><strong>{slip.payment_account || '—'}</strong></div>
              <div><span>Type</span><strong>{slip.kind_label}</strong></div>
              <div><span>Period</span><strong>{month}</strong></div>
              <div><span>Reference</span><strong>{run.reference}</strong></div>
            </div>
            <table className="invoice-print-table">
              <thead><tr><th>Earnings</th><th>Amount</th></tr></thead>
              <tbody>{slip.lines.filter((line) => line.kind === 'earning').map((line) => <tr key={line.id}><td>{line.description}</td><td>{formatMoney(line.amount)}</td></tr>)}</tbody>
            </table>
            <section className="invoice-print-totals">
              <div className="invoice-print-tax-breakdown">
                <div><span>Gross pay</span><span>{formatMoney(slip.gross)}</span></div>
                {Number(slip.income_tax) > 0 && <div><span>Income tax</span><span>−{formatMoney(slip.income_tax)}</span></div>}
                {Number(slip.pension_employee) > 0 && <div><span>Pension ({Number(run.rules.employee_pension_rate)}%)</span><span>−{formatMoney(slip.pension_employee)}</span></div>}
                {Number(slip.withholding) > 0 && <div><span>Withholding</span><span>−{formatMoney(slip.withholding)}</span></div>}
                {slip.lines.filter((line) => line.kind === 'deduction').map((line) => <div key={line.id}><span>{line.description}</span><span>−{formatMoney(line.amount)}</span></div>)}
              </div>
              <div className="invoice-print-grand-total"><span>Net pay</span><strong>{formatMoney(slip.net)}</strong></div>
            </section>
            {slip.notes && <p className="invoice-print-muted">{slip.notes}</p>}
            <footer className="pay-print-sign"><span>Received by ____________________</span><span>Date ____________</span></footer>
          </article>
        ))}
      </div>
    </AdminShell>
  )
}
