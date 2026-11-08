import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessLink } from '@/components/admin/access-link'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { RecordFormView } from '@/components/admin/record-form-view'
import { Many2ManyTags } from '@/components/admin/many2many-tags'
import { apiBaseUrl } from '@/lib/api'
import { apiRequest } from '@/lib/api-request'
import { getErrorMessage } from '@/lib/api-errors'
import { fetchCsrfToken } from '@/lib/csrf'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { formatMoney, splitDateTime } from '../procurement/types'
import { rateLabel, timeRange, type Employee, type HROptions } from './types'

type Draft = {
  full_name: string
  phone: string
  job_title: string
  employment_type: string
  wage_basis: string
  rate: string
  skillIds: number[]
  id_type: string
  id_number: string
  id_verified: string
  emergency_contact: string
  payment_account: string
  hire_date: string
  notes: string
  active: boolean
}

const EMPTY: Draft = {
  full_name: '', phone: '', job_title: '', employment_type: 'freelance', wage_basis: 'daily', rate: '', skillIds: [],
  id_type: '', id_number: '', id_verified: 'false', emergency_contact: '', payment_account: '', hire_date: '', notes: '', active: true,
}


function draftFrom(person: Employee): Draft {
  return {
    full_name: person.full_name, phone: person.phone, job_title: person.job_title, employment_type: person.employment_type,
    wage_basis: person.wage_basis, rate: person.rate, skillIds: person.skill_ids, id_type: person.id_type,
    id_number: person.id_number, id_verified: String(person.id_verified), emergency_contact: person.emergency_contact,
    payment_account: person.payment_account, hire_date: person.hire_date ?? '', notes: person.notes, active: person.active,
  }
}

export function CrewFormPage() {
  const { t } = useTranslation('crew')
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const [person, setPerson] = useState<Employee | null>(null)
  const [options, setOptions] = useState<HROptions | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [chatterKey, setChatterKey] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [loadedOptions, loadedPerson] = await Promise.all([
        apiRequest<HROptions>('/hr/options/', { signal, fallback: t('loadOptions') }),
        isNew ? Promise.resolve(null) : apiRequest<Employee>(`/hr/employees/${id}/`, { signal, fallback: t('form.loadFailed') }),
      ])
      setOptions(loadedOptions)
      if (loadedPerson) {
        setPerson(loadedPerson)
        setDraft(draftFrom(loadedPerson))
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

  const dirty = person ? JSON.stringify(draft) !== JSON.stringify(draftFrom(person)) : undefined
  const update = (changes: Partial<Draft>) => { setDraft((current) => ({ ...current, ...changes })); setSaved(false) }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        full_name: draft.full_name.trim(), phone: draft.phone.trim(), job_title: draft.job_title.trim(),
        employment_type: draft.employment_type, wage_basis: draft.wage_basis, rate: draft.rate || '0',
        skill_ids: draft.skillIds, id_type: draft.id_type, id_number: draft.id_number.trim(), id_verified: draft.id_verified === 'true',
        emergency_contact: draft.emergency_contact.trim(), payment_account: draft.payment_account.trim(),
        hire_date: draft.hire_date || null, notes: draft.notes.trim(), active: draft.active,
      }
      const result = await apiRequest<Employee>(isNew ? '/hr/employees/' : `/hr/employees/${id}/`, {
        method: isNew ? 'POST' : 'PATCH', body, fallback: t('form.saveFailed'), labels: { full_name: t('form.name'), wage_basis: t('form.payBasis'), id_number: t('form.idNumber'), skill_ids: t('form.skills') },
      })
      if (isNew) {
        navigate(`/dashboard/crew/${result.id}`, { replace: true })
        return
      }
      setPerson(result)
      setDraft(draftFrom(result))
      setSaved(true)
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('form.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function uploadId(file: File) {
    if (!person) return
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      body.append('id_document', file)
      const response = await fetch(`${apiBaseUrl}/hr/employees/${person.id}/id-document/`, {
        method: 'POST', credentials: 'include', body,
        headers: { Accept: 'application/json', 'X-CSRFToken': await fetchCsrfToken() },
      })
      const data: unknown = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(data, t('form.uploadFailed')))
      setPerson(data as Employee)
      setChatterKey((key) => key + 1)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('form.uploadFailed'))
    } finally {
      setUploading(false)
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

  const editable = options.can_edit
  // Freelancers can't be on a monthly salary.
  const wageOptions = options.wage_bases.filter((item) => draft.employment_type !== 'freelance' || item.value !== 'monthly')
  const rateHelp = draft.wage_basis === 'monthly' ? t('form.helpMonthly')
    : draft.wage_basis === 'daily' ? t('form.helpDaily') : t('form.helpEvent')

  const shiftsPage = person && (
    <div className="o-list-wrap">
      <table className="o-list">
        <thead><tr><th scope="col">{t('form.event')}</th><th scope="col">{t('form.role')}</th><th scope="col">{t('form.when')}</th><th scope="col">{t('form.status')}</th><th scope="col" className="o-num">{t('form.amount')}</th><th scope="col">{t('form.paid')}</th></tr></thead>
        <tbody>
          {person.shifts.map((shift) => (
            <tr key={shift.id}>
              <td><Link to={`/dashboard/crew-schedule?event=${shift.event_id}`} className="cat-row-link">{shift.event_name}</Link></td>
              <td>{shift.role}</td>
              <td className="o-muted">{formatDualDate(splitDateTime(shift.start).date)} · {timeRange(shift.start, shift.end)}</td>
              <td><span className={`proc-status crew-status--${shift.status}`}>{shift.status_label}</span></td>
              <td className="o-num">{formatMoney(shift.amount)}</td>
              <td>{shift.payout ? <AccessLink module="expenses" to={`/dashboard/expenses/${shift.payout.id}`} className="cat-row-link">{shift.payout.reference}</AccessLink> : <span className="o-muted">—</span>}</td>
            </tr>
          ))}
          {person.shifts.length === 0 && <tr><td colSpan={6} className="o-list-empty">{t('form.noShifts')}</td></tr>}
        </tbody>
      </table>
    </div>
  )

  return (
    <AdminShell>
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {(isNew || person) && (
        <RecordFormView
          modelName={draft.employment_type === 'permanent' ? t('form.staffMember') : t('form.freelancer')}
          title={draft.full_name}
          subtitle={person ? `${person.job_title || person.employment_type_label} · ${rateLabel(person.wage_basis, person.rate)}` : t('form.newSubtitle')}
          recordId={person?.id}
          backHref="/dashboard/crew"
          backLabel={t('form.back')}
          ribbon={person && !person.active ? { label: t('form.archived'), tone: 'danger' } : null}
          actionSlot={person && editable && <>
            <Link to={`/dashboard/crew-schedule?employee=${person.id}`} className="o-btn o-btn-primary">{t('form.book')}</Link>
            <button type="button" className="o-btn o-btn-secondary" onClick={() => update({ active: !draft.active })}>{draft.active ? t('form.archive') : t('form.restore')}</button>
          </>}
          headerAside={person && <>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">#</span>
              <span><strong>{person.totals.events_worked}</strong><small>{t('form.eventsWorked')}</small></span>
            </div>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">Br</span>
              <span><strong>{formatMoney(person.totals.paid_total)}</strong><small>{t('form.paidOut')}</small></span>
            </div>
            <div className={`o-stat-button${person.id_verified ? '' : ' is-danger'}`}>
              <span className="o-stat-icon" aria-hidden="true">✓</span>
              <span><strong>{person.id_verified ? t('form.verified') : t('form.notVerified')}</strong><small>{t('form.id')}</small></span>
            </div>
          </>}
          headerFields={[
            { name: 'full_name', label: t('form.fullName'), value: draft.full_name, required: true },
            { name: 'phone', label: t('form.phone'), type: 'tel', value: draft.phone, required: true },
            { name: 'employment_type', label: t('form.type'), type: 'select', value: draft.employment_type, options: options.employment_types },
            { name: 'job_title', label: t('form.jobTitle'), value: draft.job_title, placeholder: t('form.jobTitlePlaceholder') },
            { name: 'wage_basis', label: t('form.paidBy'), type: 'select', value: draft.wage_basis, options: wageOptions },
            { name: 'rate', label: t('form.rate'), type: 'number', value: draft.rate, required: true, helpText: rateHelp },
          ]}
          onFieldChange={(name, value) => {
            if (name === 'employment_type') {
              update({ employment_type: value, wage_basis: value === 'permanent' ? 'monthly' : draft.wage_basis === 'monthly' ? 'daily' : draft.wage_basis })
              return
            }
            update({ [name]: value } as Partial<Draft>)
          }}
          tabs={[
            {
              id: 'skills', label: t('form.skills'), badge: draft.skillIds.length, content: (
                <>
                  <p className="o-form-hint">{t('form.skillsHint')}</p>
                  {editable
                    ? <Many2ManyTags options={options.skills.map((skill) => ({ id: skill.id, label: skill.name }))} value={draft.skillIds} onChange={(ids) => update({ skillIds: ids })} placeholder={t('form.addSkill')} aria-label={t('form.skills')} />
                    : <div className="cat-tags">{person?.skills.map((skill) => <span key={skill.id} className="o-tag">{skill.name}</span>)}</div>}
                </>
              ),
            },
            {
              id: 'identity', label: t('form.identityTab'), sections: [
                {
                  title: t('form.identification'), fields: [
                    { name: 'id_type', label: t('form.idType'), type: 'select', value: draft.id_type, options: [{ value: '', label: t('form.notRecorded') }, ...options.id_types] },
                    { name: 'id_number', label: t('form.idNumber'), value: draft.id_number },
                    { name: 'id_verified', label: t('form.verifiedLabel'), type: 'select', value: draft.id_verified, options: [{ value: 'false', label: t('form.no') }, { value: 'true', label: t('form.yesChecked') }] },
                    ...(person ? [{
                      name: 'id_document', label: t('form.idCopy'), type: 'custom' as const,
                      render: (
                        <div className="proc-datetime">
                          {person.id_document_url && <a href={person.id_document_url} target="_blank" rel="noreferrer" className="cat-row-link">{t('form.view')}</a>}
                          {editable && <input className="o-input" type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label={t('form.uploadId')} disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadId(file) }} />}
                        </div>
                      ),
                    }] : []),
                  ],
                },
                {
                  title: t('form.paymentContact'), fields: [
                    { name: 'payment_account', label: t('form.payTo'), value: draft.payment_account, placeholder: t('form.payToPlaceholder') },
                    { name: 'emergency_contact', label: t('form.emergency'), value: draft.emergency_contact, placeholder: t('form.emergencyPlaceholder') },
                    { name: 'hire_date', label: t('form.started'), type: 'date', value: draft.hire_date },
                  ],
                },
                { title: t('form.notes'), fields: [{ name: 'notes', label: t('form.notes'), type: 'textarea', value: draft.notes, fullWidth: true }] },
              ],
            },
            ...(person ? [{ id: 'shifts', label: t('form.eventsTab'), badge: person.shifts.length, content: shiftsPage }] : []),
          ]}
          onSubmit={editable ? (event) => void save(event) : undefined}
          dirty={dirty}
          onDiscard={() => {
            if (isNew) { navigate('/dashboard/crew'); return }
            if (person) setDraft(draftFrom(person))
            setError('')
          }}
          saving={saving}
          saved={saved}
          chatter={person ? { model: 'employee', recordId: person.id, refreshKey: chatterKey } : undefined}
        />
      )}
    </AdminShell>
  )
}
