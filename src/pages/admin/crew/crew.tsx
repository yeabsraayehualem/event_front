import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { apiRequest } from '@/lib/api-request'
import { rateLabel, type EmployeeListItem, type HROptions } from './types'

export function CrewPage() {
  const { t } = useTranslation('crew')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [people, setPeople] = useState<EmployeeListItem[] | null>(null)
  const [options, setOptions] = useState<HROptions | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const filter = (name: string) => searchParams.get(name) ?? ''

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<EmployeeListItem[]>('/hr/employees/', { signal: controller.signal, fallback: t('directory.loadFailed') }),
      apiRequest<HROptions>('/hr/options/', { signal: controller.signal, fallback: t('loadOptions') }),
    ])
      .then(([loaded, loadedOptions]) => { setPeople(loaded); setOptions(loadedOptions) })
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [t])

  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    setSearchParams(next)
  }

  const needle = query.trim().toLowerCase()
  const shown = (people ?? []).filter((person) => (
    (filter('archived') === 'yes' || person.active)
    && (!filter('type') || person.employment_type === filter('type'))
    && (!filter('basis') || person.wage_basis === filter('basis'))
    && (!filter('skill') || person.skills.some((skill) => String(skill.id) === filter('skill')))
    && (!filter('verified') || String(person.id_verified) === filter('verified'))
    && (!needle || [person.full_name, person.phone, person.job_title].some((value) => value.toLowerCase().includes(needle)))
  ))

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">{t('eyebrow')}</p>
            <h1 className="dash-title">{t('directory.title')}</h1>
          </div>
          {options?.can_edit && <Link to="/dashboard/crew/new" className="o-btn o-btn-primary">{t('directory.addPerson')}</Link>}
        </div>

        <div className="proc-chips" role="group" aria-label={t('directory.filterByType')}>
          <button type="button" className={!filter('type') ? 'is-active' : ''} onClick={() => setFilter('type', '')}>{t('directory.everyone')}</button>
          {options?.employment_types.map((item) => (
            <button key={item.value} type="button" className={filter('type') === item.value ? 'is-active' : ''} onClick={() => setFilter('type', item.value)}>{item.label}</button>
          ))}
        </div>

        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder={t('directory.searchPlaceholder')} aria-label={t('directory.searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="o-input proc-select" aria-label={t('directory.skill')} value={filter('skill')} onChange={(event) => setFilter('skill', event.target.value)}>
            <option value="">{t('directory.allSkills')}</option>
            {options?.skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
          </select>
          <select className="o-input proc-select" aria-label={t('directory.wageBasis')} value={filter('basis')} onChange={(event) => setFilter('basis', event.target.value)}>
            <option value="">{t('directory.anyBasis')}</option>
            {options?.wage_bases.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select className="o-input proc-select" aria-label={t('directory.idStatus')} value={filter('verified')} onChange={(event) => setFilter('verified', event.target.value)}>
            <option value="">{t('directory.anyId')}</option>
            <option value="true">{t('directory.idVerified')}</option>
            <option value="false">{t('directory.idNotVerified')}</option>
          </select>
          <label className="proc-toggle"><input type="checkbox" checked={filter('archived') === 'yes'} onChange={(event) => setFilter('archived', event.target.checked ? 'yes' : '')} /> {t('directory.showArchived')}</label>
          {people && <span className="dash-scope">{t('shownOf', { ns: 'common', shown: shown.length, total: people.length })}</span>}
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!people && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

        {people && (
          <section className="dash-card dash-card--flush">
            {shown.length === 0 ? <p className="dash-empty">{people.length ? t('directory.noMatch') : t('directory.empty')}</p> : (
              <div className="overflow-x-auto">
                <table className="dash-table">
                  <thead><tr>
                    <th scope="col">{t('directory.name')}</th><th scope="col">{t('directory.skills')}</th><th scope="col">{t('directory.type')}</th>
                    <th scope="col" className="o-num">{t('directory.rate')}</th><th scope="col">{t('directory.id')}</th><th scope="col" className="o-num">{t('directory.upcoming')}</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((person) => (
                      <tr key={person.id} onClick={() => navigate(`/dashboard/crew/${person.id}`)}>
                        <td>
                          <Link to={`/dashboard/crew/${person.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>{person.full_name}</Link>
                          {!person.active && <span className="proc-status proc-status--cancelled">{t('directory.archived')}</span>}
                          <div className="cat-muted">{[person.job_title, person.phone].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td>
                          <div className="cat-tags">
                            {person.skills.slice(0, 3).map((skill) => <span key={skill.id} className="o-tag">{skill.name}</span>)}
                            {person.skills.length > 3 && <span className="cat-muted">+{person.skills.length - 3}</span>}
                          </div>
                        </td>
                        <td className="dash-muted">{person.employment_type_label}</td>
                        <td className="o-num">{rateLabel(person.wage_basis, person.rate)}</td>
                        <td>{person.id_verified ? <span className="proc-status proc-status--received">{t('directory.verified')}</span> : <span className="proc-status proc-status--submitted">{t('directory.notVerified')}</span>}</td>
                        <td className="o-num dash-muted">{person.upcoming_shifts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </AdminShell>
  )
}
