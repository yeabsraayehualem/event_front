import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { apiBaseUrl } from '@/lib/api'
import { apiRequest } from '@/lib/api-request'
import { fetchCsrfToken } from '@/lib/csrf'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { formatMoney } from '../procurement/types'
import { monthLabel, type Bracket, type PayRunListItem, type PayrollRules } from './types'

type ListResponse = { runs: PayRunListItem[]; rules: PayrollRules; can_approve: boolean }

/** The last two months, this month and next, newest first, as YYYY-MM. */
function monthChoices() {
  const now = new Date()
  return [1, 0, -1, -2].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
}

function bandLabel(brackets: Bracket[], index: number) {
  const lower = index === 0 ? 0 : Number(brackets[index - 1].upper_limit)
  const upper = brackets[index].upper_limit
  const amount = (value: number) => value.toLocaleString('en-US')
  return upper === null ? `Over ${amount(lower)}` : `${amount(index === 0 ? 0 : lower + 1)} – ${amount(Number(upper))}`
}

export function PayrollPage() {
  const navigate = useNavigate()
  const months = monthChoices()
  const thisMonth = months[1]
  const [data, setData] = useState<ListResponse | null>(null)
  const [period, setPeriod] = useState(thisMonth)
  const [generating, setGenerating] = useState(false)
  const [editingRules, setEditingRules] = useState<PayrollRules | null>(null)
  const [savingRules, setSavingRules] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<ListResponse>('/hr/pay-runs/', { signal: controller.signal, fallback: 'Could not load payroll.' })
      .then(setData)
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [])

  const existing = data?.runs.find((run) => run.period.startsWith(period) && run.status !== 'cancelled')

  async function generate() {
    if (existing) { navigate(`/dashboard/payroll/${existing.id}`); return }
    setGenerating(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/hr/pay-runs/`, {
        method: 'POST', credentials: 'include', body: JSON.stringify({ period }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': await fetchCsrfToken() },
      })
      const body = await response.json() as { id?: number; detail?: string; run_id?: number }
      if (response.ok && body.id) { navigate(`/dashboard/payroll/${body.id}`); return }
      if (body.run_id) { navigate(`/dashboard/payroll/${body.run_id}`); return }
      throw new Error(body.detail ?? 'Could not generate payroll.')
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Could not generate payroll.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveRules(changes: Partial<PayrollRules>) {
    setSavingRules(true)
    setError('')
    try {
      const rules = await apiRequest<PayrollRules>('/hr/payroll/rules/', { method: 'PATCH', body: changes, fallback: 'Could not save the payroll rules.' })
      setData((current) => current && { ...current, rules })
      setEditingRules(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the payroll rules.')
    } finally {
      setSavingRules(false)
    }
  }

  const rules = data?.rules
  const draft = editingRules

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">Crew</p>
            <h1 className="dash-title">Payroll</h1>
          </div>
          <div className="pay-generate">
            <select className="o-input proc-select" aria-label="Month to pay" value={period} onChange={(event) => setPeriod(event.target.value)}>
              {months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
            </select>
            <button type="button" className="o-btn o-btn-primary" disabled={generating || !data} onClick={() => void generate()}>
              {generating ? 'Generating…' : existing ? `Open ${monthLabel(period)} payroll` : `Generate ${monthLabel(period)} payroll`}
            </button>
          </div>
        </div>
        <p className="o-form-hint pay-intro">
          Generating creates a <strong>draft</strong> with a payslip for every salaried staff member and every freelancer with worked, unpaid shifts.
          Adjust or hold individual payslips, then approve, print, export the bank file and mark it paid.
        </p>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!data && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

        {data && (
          <section className="dash-card dash-card--flush">
            {data.runs.length === 0 ? <p className="dash-empty">No pay runs yet. Generate this month’s to start.</p> : (
              <div className="overflow-x-auto">
                <table className="dash-table">
                  <thead><tr>
                    <th scope="col">Pay run</th><th scope="col">Status</th><th scope="col" className="o-num">People</th>
                    <th scope="col" className="o-num">Gross</th><th scope="col" className="o-num">Net to pay</th><th scope="col" className="o-num">Company cost</th>
                  </tr></thead>
                  <tbody>
                    {data.runs.map((run) => (
                      <tr key={run.id} onClick={() => navigate(`/dashboard/payroll/${run.id}`)}>
                        <td><Link to={`/dashboard/payroll/${run.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>{monthLabel(run.period)}</Link><div className="cat-muted">{run.reference}</div></td>
                        <td><span className={`proc-status pay-status--${run.status}`}>{run.status_label}</span>{run.paid_on && <div className="cat-muted">{formatDualDate(run.paid_on)}</div>}</td>
                        <td className="o-num">{run.totals.people}{run.totals.held > 0 && <div className="cat-muted">{run.totals.held} held</div>}</td>
                        <td className="o-num">{formatMoney(run.totals.gross)}</td>
                        <td className="o-num"><strong>{formatMoney(run.totals.net)}</strong></td>
                        <td className="o-num dash-muted">{formatMoney(run.totals.employer_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {rules && (
          <section className="dash-card pay-rules">
            <div className="dash-card-head">
              <div>
                <h2>Tax & pension rules</h2>
                {rules.tax_table_confirmed
                  ? <span className="proc-status proc-status--received">Confirmed{rules.confirmed_by ? ` by ${rules.confirmed_by}` : ''}{rules.confirmed_at ? ` · ${formatDualDate(rules.confirmed_at.slice(0, 10))}` : ''}</span>
                  : <span className="proc-status proc-status--submitted">Not confirmed: salaried payroll can’t be approved until your accountant checks this table</span>}
              </div>
              {data?.can_approve && !draft && (
                <div className="pay-rules-actions">
                  <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={() => setEditingRules(structuredClone(rules))}>Edit</button>
                  {!rules.tax_table_confirmed && <button type="button" className="o-btn o-btn-primary o-btn-sm" disabled={savingRules} onClick={() => void saveRules({ tax_table_confirmed: true })}>Confirm table is current</button>}
                </div>
              )}
            </div>

            <div className="pay-rules-grid">
              <div>
                <h3 className="proc-subhead">Monthly income tax (ETB)</h3>
                <table className="o-list pay-brackets">
                  <thead><tr><th scope="col">Monthly income</th><th scope="col" className="o-num">Rate</th></tr></thead>
                  <tbody>
                    {(draft ?? rules).brackets.map((bracket, index, list) => (
                      <tr key={index}>
                        <td>
                          {draft && bracket.upper_limit !== null ? (
                            <span className="pay-band-edit">up to <input className="o-input o-num" type="number" min="0" aria-label="Upper limit" value={bracket.upper_limit} onChange={(event) => setEditingRules({ ...draft, brackets: list.map((row, i) => i === index ? { ...row, upper_limit: event.target.value } : row) })} /></span>
                          ) : bandLabel(list, index)}
                        </td>
                        <td className="o-num">
                          {draft ? <input className="o-input o-num pay-rate" type="number" min="0" max="100" step="0.5" aria-label="Rate" value={bracket.rate} onChange={(event) => setEditingRules({ ...draft, brackets: list.map((row, i) => i === index ? { ...row, rate: event.target.value } : row) })} /> : `${Number(bracket.rate)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {draft && <button type="button" className="o-list-add" onClick={() => {
                  const open = draft.brackets[draft.brackets.length - 1]
                  const lastLimit = Number(draft.brackets[draft.brackets.length - 2]?.upper_limit ?? 0)
                  setEditingRules({ ...draft, brackets: [...draft.brackets.slice(0, -1), { upper_limit: String(lastLimit + 1000), rate: open.rate }, open] })
                }}>Add a band</button>}
              </div>
              <div>
                <h3 className="proc-subhead">Pension & withholding</h3>
                {([
                  ['employee_pension_rate', 'Employee pension', 'Deducted from salary'],
                  ['employer_pension_rate', 'Employer pension', 'Paid by the company on top'],
                  ['freelance_withholding_rate', 'Freelancer withholding', 'Deducted from freelance pay'],
                ] as const).map(([key, label, help]) => (
                  <div key={key} className="pay-rate-row">
                    <span>{label}<small>{help}</small></span>
                    {draft ? <input className="o-input o-num pay-rate" type="number" min="0" max="100" step="0.5" aria-label={label} value={draft[key]} onChange={(event) => setEditingRules({ ...draft, [key]: event.target.value })} /> : <strong>{Number(rules[key])}%</strong>}
                  </div>
                ))}
                <p className="o-form-hint">Seeded from the July 2025 amendment (Proclamation 1395/2025). Confirm with your accountant, especially if a newer proclamation applies.</p>
              </div>
            </div>
            {draft && (
              <div className="pay-rules-actions">
                <button type="button" className="o-btn o-btn-primary o-btn-sm" disabled={savingRules} onClick={() => void saveRules({
                  employee_pension_rate: draft.employee_pension_rate, employer_pension_rate: draft.employer_pension_rate,
                  freelance_withholding_rate: draft.freelance_withholding_rate, brackets: draft.brackets,
                })}>{savingRules ? 'Saving…' : 'Save rules'}</button>
                <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={() => setEditingRules(null)}>Discard</button>
                <span className="cat-muted">Changing the brackets clears the confirmation. Draft pay runs are recalculated.</span>
              </div>
            )}
          </section>
        )}
      </div>
    </AdminShell>
  )
}
