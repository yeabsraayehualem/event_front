import { Fragment, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'check', 'mobile_money'] as const

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

type NewLine = { kind: 'earning' | 'deduction'; description: string; amount: string }

export function PayRunPage() {
  const { t } = useTranslation('payroll')
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
      setRun(await apiRequest<PayRun>(`/hr/pay-runs/${id}/`, { signal, fallback: t('run.loadFailed') }))
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
      setRun(await apiRequest<PayRun>(path, { method, body, fallback: t('run.updateFailed') }))
      if (done) setNotice(done)
      return true
    } catch (actError) {
      setError(actError instanceof Error ? actError.message : t('run.updateFailed'))
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
      if (!response.ok) throw new Error(getErrorMessage(await response.json(), t('run.exportFailed')))
      const url = URL.createObjectURL(await response.blob())
      const link = Object.assign(document.createElement('a'), { href: url, download: `${run.reference}-bank-transfers.csv` })
      link.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : t('run.exportFailed'))
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
      { label: t('run.incomeTax'), amount: slip.income_tax },
      { label: t('run.pensionPct', { rate: Number(run!.rules.employee_pension_rate) }), amount: slip.pension_employee },
      { label: t('run.withholdingPct', { rate: Number(run!.rules.freelance_withholding_rate) }), amount: slip.withholding },
    ].filter((item) => Number(item.amount) > 0)
    const deductionTotal = Number(slip.gross) - Number(slip.net)

    const removeButton = (line: PayslipLine) => draft && !line.is_basic && (
      <button type="button" className="pay-icon-btn is-danger pay-line-remove" aria-label={t('run.removeLine', { name: line.description })}
        title={line.shift ? t('run.takeShiftOff') : t('run.remove')} disabled={busy}
        onClick={() => void act(`/hr/payslips/${slip.id}/lines/${line.id}/`, 'DELETE')}>
        <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.8} />
      </button>
    )

    const addForm = (kind: NewLine['kind']) => {
      if (!draft) return null
      if (pending?.kind !== kind) {
        return (
          <button type="button" className="pay-add-toggle" onClick={() => setPending({ kind, description: '', amount: '' })}>
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />{kind === 'earning' ? t('run.addPay') : t('run.addDeduction')}
          </button>
        )
      }
      const ready = pending.description.trim() && Number(pending.amount) > 0
      const submit = async () => { if (ready && await act(`/hr/payslips/${slip.id}/lines/`, 'POST', pending)) setPending(null) }
      return (
        <form className="pay-add-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <input className="o-input" autoFocus aria-label={t('run.description')} placeholder={kind === 'earning' ? t('run.earningPlaceholder') : t('run.deductionPlaceholder')} value={pending.description} onChange={(event) => setPending({ description: event.target.value })} />
          <input className="o-input o-num" type="number" min="0.01" step="0.01" aria-label={t('run.amount')} placeholder="0.00" value={pending.amount} onChange={(event) => setPending({ amount: event.target.value })} />
          <button type="submit" className="o-btn o-btn-primary o-btn-sm" disabled={busy || !ready}>{t('run.add')}</button>
          <button type="button" className="o-btn o-btn-link o-btn-sm" onClick={() => setPending(null)}>{t('run.cancel')}</button>
        </form>
      )
    }

    return (
      <div className="pay-slip">
        <section className="pay-slip-col" aria-label={t('run.earnings')}>
          <h4>{t('run.earnings')}</h4>
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
                    {line.is_basic && <small>{t('run.basicSalary')}</small>}
                  </span>
                )}
                {draft && line.is_basic ? (
                  <label className="pay-inline-amount-wrap" title={t('run.partialHint')}><span>{t('run.currency')}</span><input className="o-input o-num pay-inline-amount" type="number" min="0" step="0.01" aria-label={t('run.salaryThisMonth')} title={t('run.partialHint')}
                    defaultValue={line.amount} key={line.amount}
                    onBlur={(event) => { if (Number(event.target.value) !== Number(line.amount)) void act(`/hr/payslips/${slip.id}/lines/${line.id}/`, 'PATCH', { amount: event.target.value }) }} /></label>
                ) : <span className="pay-line-amount">{formatMoney(line.amount)}</span>}
                {removeButton(line)}
              </li>
            ))}
          </ul>
          {addForm('earning')}
          <div className="pay-slip-total"><span>{t('run.gross')}</span><strong>{formatMoney(slip.gross)}</strong></div>
        </section>

        <section className="pay-slip-col" aria-label={t('run.deductions')}>
          <h4>{t('run.deductions')}</h4>
          <ul>
            {calculated.map((item) => (
              <li key={item.label}>
                <span className="pay-line-text">{item.label}<small className="is-auto">{t('run.calculated')}</small></span>
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
            {calculated.length === 0 && manualDeductions.length === 0 && <li className="pay-line-empty">{t('run.noDeductions')}</li>}
          </ul>
          {addForm('deduction')}
          <div className="pay-slip-total"><span>{t('run.totalDeductions')}</span><strong>{deductionTotal ? `−${formatMoney(deductionTotal)}` : formatMoney(0)}</strong></div>
        </section>

        <aside className={`pay-slip-net${Number(slip.net) < 0 ? ' is-negative' : ''}`}>
          <span>{t('run.netPay')}</span>
          <strong>{formatMoney(slip.net)}</strong>
          <dl>
            <div><dt>{t('run.payTo')}</dt><dd>{slip.payment_account || <em>{t('run.noAccount')}</em>}</dd></div>
            {Number(slip.pension_employer) > 0 && <div><dt>{t('run.companyPension')}</dt><dd>{formatMoney(slip.pension_employer)}</dd></div>}
            <div><dt>{t('run.companyCost')}</dt><dd>{formatMoney(slip.employer_cost)}</dd></div>
          </dl>
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" disabled={slip.held} onClick={() => print(slip.id)}>
            <HugeiconsIcon icon={PrinterIcon} size={15} strokeWidth={1.8} />{t('run.printPayslip')}
          </button>
        </aside>
      </div>
    )
  }

  return (
    <AdminShell>
      <div className="dash">
        <div className="o-breadcrumb pay-breadcrumb">
          <Link to="/dashboard/payroll" className="o-breadcrumb-parent">{t('run.breadcrumb')}</Link>
          <span className="o-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="o-breadcrumb-current">{run.reference}</span>
        </div>
        <div className="dash-header">
          <div>
            {(run.approved_by_name || run.paid_on) && <p className="dash-eyebrow">{run.approved_by_name ? t('run.approvedBy', { name: run.approved_by_name }) : ''}{run.paid_on ? t('run.paidOn', { date: formatDualDate(run.paid_on) }) : ''}</p>}
            <h1 className="dash-title">{t('run.title', { month })} <span className={`proc-status pay-status--${run.status}`}>{run.status_label}</span></h1>
          </div>
          <div className="pay-actions">
            {draft && <button type="button" className="o-btn o-btn-secondary" disabled={busy} title={t('run.refreshTitle')} onClick={() => void transition('refresh', {}, t('run.refreshed'))}>{t('run.refresh')}</button>}
            {draft && run.can_approve && <button type="button" className="o-btn o-btn-primary" disabled={busy} onClick={() => void transition('approve', {}, t('run.approvedNotice'))}>{t('run.approve')}</button>}
            {draft && !run.can_approve && <span className="cat-muted">{t('run.waitingFinance')}</span>}
            {run.status !== 'cancelled' && <button type="button" className="o-btn o-btn-secondary" onClick={() => print(null)}>{t('run.printPayslips')}</button>}
            {(run.status === 'approved' || run.status === 'paid') && <button type="button" className="o-btn o-btn-secondary" onClick={() => void downloadBankFile()}>{t('run.bankFile')}</button>}
            {run.status === 'approved' && run.can_approve && <button type="button" className="o-btn o-btn-link" disabled={busy} onClick={() => void transition('reopen', {}, t('run.reopened'))}>{t('run.reopen')}</button>}
            {(draft || (run.status === 'approved' && run.can_approve)) && (
              <button type="button" className="o-btn o-btn-link o-btn-danger" disabled={busy} onClick={() => { if (window.confirm(t('run.confirmCancel', { reference: run.reference }))) void transition('cancel', {}, t('run.cancelled')) }}>{t('run.cancelRun')}</button>
            )}
          </div>
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {notice && <p className="o-inline-notice" role="status">{notice}</p>}
        {run.warnings.map((warning) => (
          <p key={warning.code} className="dashboard-message pay-warning" role="status">
            {warning.message}{warning.code === 'tax_table' && <> <Link to="/dashboard/payroll" className="dash-link">{t('run.reviewTaxTable')}</Link></>}
          </p>
        ))}

        <div className="proc-budget pay-totals">
          <div><span>{t('run.peoplePaid')}</span><strong>{totals.people}</strong>{totals.held > 0 && <small>{t('run.onHold', { count: totals.held })}</small>}</div>
          <div><span>{t('run.grossPay')}</span><strong>{formatMoney(totals.gross)}</strong></div>
          <div><span>{t('run.incomeTax')}</span><strong>{formatMoney(totals.income_tax)}</strong><small>{t('run.toTaxAuthority')}</small></div>
          <div><span>{t('run.pension')}</span><strong>{formatMoney(Number(totals.pension_employee) + Number(totals.pension_employer))}</strong><small>{t('run.pensionSplit', { staff: Number(run.rules.employee_pension_rate), company: Number(run.rules.employer_pension_rate) })}</small></div>
          <div className="pay-total-net"><span>{t('run.netToPay')}</span><strong>{formatMoney(totals.net)}</strong></div>
          <div><span>{t('run.companyCost')}</span><strong>{formatMoney(totals.employer_cost)}</strong><small>{t('run.bookedWhenPaid')}</small></div>
        </div>

        {run.status === 'approved' && run.can_approve && (
          <section className="dash-card pay-mark-paid" aria-label={t('run.markPaidLabel')}>
            <div>
              <strong>{t('run.transfersDone')}</strong>
              <span className="cat-muted">{t('run.markPaidHint')}</span>
            </div>
            <div className="pay-mark-paid-fields">
              <EthiopianDateInput value={paidOn} onChange={setPaidOn} />
              <select className="o-input proc-select" aria-label={t('run.paidBy')} value={method} onChange={(event) => setMethod(event.target.value)}>
                {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{t(`methods.${item}`)}</option>)}
              </select>
              <button type="button" className="o-btn o-btn-primary" disabled={busy} onClick={() => { if (window.confirm(t('run.confirmPaid', { reference: run.reference, amount: formatMoney(totals.net), count: totals.people }))) void transition('pay', { paid_on: paidOn, payment_method: method }, t('run.paidNotice')) }}>{t('run.markPaid')}</button>
            </div>
          </section>
        )}

        <section className="dash-card dash-card--flush">
          {run.payslips.length === 0 ? <p className="dash-empty">{t('run.noPayslips')}</p> : (
            <div className="overflow-x-auto">
              <table className="dash-table pay-table">
                <thead><tr>
                  <th scope="col">{t('run.person')}</th><th scope="col" className="o-num">{t('run.gross')}</th><th scope="col" className="o-num">{t('run.deductions')}</th>
                  <th scope="col" className="o-num">{t('run.netPay')}</th><th scope="col">{t('run.payTo')}</th><th scope="col"><span className="sr-only">{t('run.actions')}</span></th>
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
                                  <span className={`pay-kind is-${slip.kind}`}>{slip.kind === 'salary' ? t('run.salary') : t('run.shifts', { count: slip.lines.filter((line) => line.shift).length })}</span>
                                  {slip.job_title && <span>{slip.job_title}</span>}
                                  {slip.held && <span className="pay-held">{t('run.held')}</span>}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="o-num">{formatMoney(slip.gross)}</td>
                          <td className="o-num dash-muted" title={[
                            Number(slip.income_tax) && t('run.tipTax', { amount: formatMoney(slip.income_tax) }),
                            Number(slip.pension_employee) && t('run.tipPension', { amount: formatMoney(slip.pension_employee) }),
                            Number(slip.withholding) && t('run.tipWithholding', { amount: formatMoney(slip.withholding) }),
                            Number(slip.other_deductions) && t('run.tipOther', { amount: formatMoney(slip.other_deductions) }),
                          ].filter(Boolean).join(' · ') || undefined}>{deductions ? `−${formatMoney(deductions)}` : '—'}</td>
                          <td className="o-num"><strong className="pay-net">{formatMoney(slip.net)}</strong></td>
                          <td onClick={(event) => event.stopPropagation()}>
                            {draft && editingAccount ? (
                              <form className="pay-account-form" onSubmit={(event) => { event.preventDefault(); void saveAccount(slip) }}>
                                <input className="o-input" autoFocus aria-label={t('run.accountFor', { name: slip.employee_name })} placeholder={t('run.accountPlaceholder')} value={accountEdit.value}
                                  onChange={(event) => setAccountEdit({ id: slip.id, value: event.target.value })}
                                  onBlur={() => void saveAccount(slip)} onKeyDown={(event) => { if (event.key === 'Escape') setAccountEdit(null) }} />
                              </form>
                            ) : (
                              <button type="button" className={`pay-account${slip.payment_account ? '' : ' is-missing'}`} disabled={!draft}
                                title={draft ? t('run.clickToChange') : undefined} onClick={() => setAccountEdit({ id: slip.id, value: slip.payment_account })}>
                                {slip.payment_account || t('run.addAccount')}
                              </button>
                            )}
                          </td>
                          <td className="pay-row-actions" onClick={(event) => event.stopPropagation()}>
                            {draft && (
                              <button type="button" className={`pay-icon-btn${slip.held ? ' is-active' : ''}`} disabled={busy} aria-label={slip.held ? t('run.include', { name: slip.employee_name }) : t('run.hold', { name: slip.employee_name })}
                                title={slip.held ? t('run.includeTitle') : t('run.holdTitle')} onClick={() => void act(`/hr/payslips/${slip.id}/`, 'PATCH', { held: !slip.held })}>
                                <HugeiconsIcon icon={slip.held ? PlayIcon : PauseIcon} size={16} strokeWidth={1.8} />
                              </button>
                            )}
                            <button type="button" className="pay-icon-btn" disabled={slip.held} aria-label={t('run.printFor', { name: slip.employee_name })} title={t('run.printPayslip')} onClick={() => print(slip.id)}>
                              <HugeiconsIcon icon={PrinterIcon} size={16} strokeWidth={1.8} />
                            </button>
                            {draft && (
                              <button type="button" className="pay-icon-btn is-danger" disabled={busy} aria-label={t('run.takeOff', { name: slip.employee_name })} title={t('run.takeOffTitle')}
                                onClick={() => { if (window.confirm(t('run.confirmTakeOff', { name: slip.employee_name, reference: run.reference }))) void act(`/hr/payslips/${slip.id}/`, 'DELETE') }}>
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

      <div className="invoice-printable pay-printable" aria-label={t('print.label')}>
        {printOnly === null && (
          <article className="pay-print-page">
            <header className="invoice-print-header">
              <div><p className="invoice-print-brand">{t('print.brand')}</p><p className="invoice-print-muted">{t('print.summary')}</p></div>
              <div className="invoice-print-title"><p>{t('print.payrollTitle')}</p><h1>{month}</h1></div>
            </header>
            <table className="invoice-print-table">
              <thead><tr><th>{t('print.name')}</th><th>{t('print.account')}</th><th>{t('print.gross')}</th><th>{t('print.tax')}</th><th>{t('print.pension')}</th><th>{t('print.other')}</th><th>{t('print.net')}</th></tr></thead>
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
                <div><span>{t('print.gross')}</span><span>{formatMoney(totals.gross)}</span></div>
                <div><span>{t('print.incomeTax')}</span><span>{formatMoney(totals.income_tax)}</span></div>
                <div><span>{t('print.pensionBoth')}</span><span>{formatMoney(Number(totals.pension_employee) + Number(totals.pension_employer))}</span></div>
                <div><span>{t('print.companyCost')}</span><span>{formatMoney(totals.employer_cost)}</span></div>
              </div>
              <div className="invoice-print-grand-total"><span>{t('print.netToPay')}</span><strong>{formatMoney(totals.net)}</strong></div>
            </section>
            <footer className="pay-print-sign">
              <span>{t('print.preparedBy')}</span><span>{t('print.approvedBy', { name: run.approved_by_name ?? '____________________' })}</span>
            </footer>
          </article>
        )}
        {printed.map((slip) => (
          <article key={slip.id} className="pay-print-page">
            <header className="invoice-print-header">
              <div><p className="invoice-print-brand">{t('print.brand')}</p><p className="invoice-print-muted">{t('print.payslipOf', { month })}</p></div>
              <div className="invoice-print-title"><p>{t('print.payslipTitle')}</p><h1>{slip.employee_name}</h1></div>
            </header>
            <div className="invoice-print-meta">
              <div><span>{t('print.name')}</span><strong>{slip.employee_name}</strong></div>
              <div><span>{t('print.phone')}</span><strong>{slip.employee_phone}</strong></div>
              <div><span>{t('print.payTo')}</span><strong>{slip.payment_account || '—'}</strong></div>
              <div><span>{t('print.type')}</span><strong>{slip.kind_label}</strong></div>
              <div><span>{t('print.period')}</span><strong>{month}</strong></div>
              <div><span>{t('print.reference')}</span><strong>{run.reference}</strong></div>
            </div>
            <table className="invoice-print-table">
              <thead><tr><th>{t('print.earnings')}</th><th>{t('print.amount')}</th></tr></thead>
              <tbody>{slip.lines.filter((line) => line.kind === 'earning').map((line) => <tr key={line.id}><td>{line.description}</td><td>{formatMoney(line.amount)}</td></tr>)}</tbody>
            </table>
            <section className="invoice-print-totals">
              <div className="invoice-print-tax-breakdown">
                <div><span>{t('print.grossPay')}</span><span>{formatMoney(slip.gross)}</span></div>
                {Number(slip.income_tax) > 0 && <div><span>{t('print.incomeTax')}</span><span>−{formatMoney(slip.income_tax)}</span></div>}
                {Number(slip.pension_employee) > 0 && <div><span>{t('print.pensionPct', { rate: Number(run.rules.employee_pension_rate) })}</span><span>−{formatMoney(slip.pension_employee)}</span></div>}
                {Number(slip.withholding) > 0 && <div><span>{t('print.withholding')}</span><span>−{formatMoney(slip.withholding)}</span></div>}
                {slip.lines.filter((line) => line.kind === 'deduction').map((line) => <div key={line.id}><span>{line.description}</span><span>−{formatMoney(line.amount)}</span></div>)}
              </div>
              <div className="invoice-print-grand-total"><span>{t('print.netPay')}</span><strong>{formatMoney(slip.net)}</strong></div>
            </section>
            {slip.notes && <p className="invoice-print-muted">{slip.notes}</p>}
            <footer className="pay-print-sign"><span>{t('print.receivedBy')}</span><span>{t('print.date')}</span></footer>
          </article>
        ))}
      </div>
    </AdminShell>
  )
}
