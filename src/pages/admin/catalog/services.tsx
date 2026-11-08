import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminShell } from '@/components/admin/admin-shell'
import { apiRequest } from '@/lib/api-request'
import { canManageCatalog, useProfile } from '@/lib/use-profile'
import type { CatalogContent } from './types'

type Row = { key: string; id?: number; name: string; description: string; package_count: number }

const rowFrom = (content: CatalogContent): Row => ({ key: String(content.id), ...content })

export function CatalogServicesPage() {
  const { t } = useTranslation('catalog')
  const editable = canManageCatalog(useProfile())
  const [saved, setSaved] = useState<Record<string, Row>>({})
  const [rows, setRows] = useState<Row[] | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<CatalogContent[]>('/event/catalog/contents/', { signal: controller.signal, fallback: t('services.loadFailed') })
      .then((loaded) => {
        const loadedRows = loaded.map(rowFrom)
        setRows(loadedRows)
        setSaved(Object.fromEntries(loadedRows.map((row) => [row.key, row])))
      })
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [])

  const isDirty = (row: Row) => !row.id || saved[row.key]?.name !== row.name || saved[row.key]?.description !== row.description
  const update = (key: string, changes: Partial<Row>) => setRows((current) => current?.map((row) => row.key === key ? { ...row, ...changes } : row) ?? current)

  async function saveRow(row: Row) {
    if (!row.name.trim()) {
      setError(t('services.needName'))
      return
    }
    setSavingKey(row.key)
    setError('')
    setNotice('')
    try {
      const body = { name: row.name.trim(), description: row.description.trim() }
      const result = await apiRequest<CatalogContent>(row.id ? `/event/catalog/contents/${row.id}/` : '/event/catalog/contents/', {
        method: row.id ? 'PATCH' : 'POST', body, fallback: t('services.saveFailed'),
      })
      const next = rowFrom(result)
      setRows((current) => current?.map((item) => item.key === row.key ? next : item) ?? current)
      setSaved((current) => ({ ...current, [next.key]: next }))
      setNotice(`“${result.name}” saved.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('services.saveFailed'))
    } finally {
      setSavingKey(null)
    }
  }

  const needle = query.trim().toLowerCase()
  const shown = (rows ?? []).filter((row) => !row.id || !needle || row.name.toLowerCase().includes(needle) || row.description.toLowerCase().includes(needle))

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">{t('eyebrow')}</p>
            <h1 className="dash-title">{t('services.title')}</h1>
          </div>
        </div>
        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder={t('services.searchPlaceholder')} aria-label={t('services.searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} />
          <span className="cat-muted">{t('services.lede')}</span>
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {notice && <p className="o-inline-notice" role="status">{notice}</p>}
        {!rows && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

        {rows && (
          <section className="o-form-view">
            <div className="o-list-wrap cat-services">
              <table className="o-list cat-list">
                <thead><tr><th scope="col">{t('services.service')}</th><th scope="col">{t('services.description')}</th><th scope="col" className="o-num">{t('services.packages')}</th><th scope="col" className="o-list-actions"><span className="sr-only">{t('services.actions')}</span></th></tr></thead>
                <tbody>
                  {shown.map((row) => {
                    const dirty = isDirty(row)
                    return (
                      <tr key={row.key} className={!row.id ? 'is-new' : dirty ? 'is-dirty' : ''}>
                        <td>
                          {editable
                            ? <input className="o-input" aria-label={t('services.nameLabel')} value={row.name} placeholder={t('services.namePlaceholder')} onChange={(event) => update(row.key, { name: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter' && dirty) void saveRow(row) }} />
                            : <strong>{row.name}</strong>}
                        </td>
                        <td>
                          {editable
                            ? <input className="o-input" aria-label={t('services.descriptionOf', { name: row.name || t('services.serviceFallback') })} value={row.description} placeholder={t('services.optional')} onChange={(event) => update(row.key, { description: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter' && dirty) void saveRow(row) }} />
                            : <span className="o-muted">{row.description || '—'}</span>}
                        </td>
                        <td className="o-num o-muted">{row.package_count}</td>
                        <td className="o-list-actions">
                          {editable && dirty && <>
                            <button type="button" className="o-btn o-btn-primary o-btn-sm" disabled={savingKey === row.key} onClick={() => void saveRow(row)}>{savingKey === row.key ? t('services.saving') : t('services.save')}</button>
                            <button
                              type="button"
                              className="o-btn o-btn-link o-btn-sm"
                              aria-label={row.id ? t('services.discardChanges', { name: row.name }) : t('services.cancelNew')}
                              onClick={() => row.id
                                ? update(row.key, { name: saved[row.key].name, description: saved[row.key].description })
                                : setRows((current) => current?.filter((item) => item.key !== row.key) ?? current)}
                            >{row.id ? '↺' : '×'}</button>
                          </>}
                        </td>
                      </tr>
                    )
                  })}
                  {shown.length === 0 && <tr><td colSpan={4} className="o-list-empty">{rows.length ? t('services.noMatch') : t('services.empty')}</td></tr>}
                </tbody>
              </table>
            </div>
            {editable && (
              <button type="button" className="o-list-add" onClick={() => setRows((current) => [...(current ?? []), { key: `new-${Date.now()}`, name: '', description: '', package_count: 0 }])}>
                {t('addLine')}
              </button>
            )}
          </section>
        )}
      </div>
    </AdminShell>
  )
}
