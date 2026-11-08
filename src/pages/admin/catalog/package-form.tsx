import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { RecordFormView } from '@/components/admin/record-form-view'
import { Many2ManyTags } from '@/components/admin/many2many-tags'
import { apiRequest } from '@/lib/api-request'
import { canManageCatalog, useProfile } from '@/lib/use-profile'
import { formatPrice, type CatalogContent, type CatalogPackage, type CatalogPlan } from './types'

type Draft = { name: string; plan: string; price: string; description: string; contentIds: number[] }


function draftFrom(item: CatalogPackage): Draft {
  return { name: item.name, plan: String(item.plan), price: item.price, description: item.description, contentIds: item.content_ids }
}

function signature(draft: Draft) {
  return JSON.stringify([draft.name.trim(), draft.plan, Number(draft.price || 0), draft.description.trim(), [...draft.contentIds].sort((a, b) => a - b)])
}

export function CatalogPackageFormPage() {
  const { t } = useTranslation('catalog')
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const editable = canManageCatalog(useProfile())
  const [item, setItem] = useState<CatalogPackage | null>(null)
  const [plans, setPlans] = useState<CatalogPlan[]>([])
  const [contents, setContents] = useState<CatalogContent[]>([])
  const [draft, setDraft] = useState<Draft>({ name: '', plan: searchParams.get('plan') ?? '', price: '', description: '', contentIds: [] })
  const [newService, setNewService] = useState('')
  const [creatingService, setCreatingService] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [chatterKey, setChatterKey] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [loadedPlans, loadedContents, loadedItem] = await Promise.all([
        apiRequest<CatalogPlan[]>('/event/catalog/plans/', { signal, fallback: t('packageForm.loadPlans') }),
        apiRequest<CatalogContent[]>('/event/catalog/contents/', { signal, fallback: t('packageForm.loadServices') }),
        isNew ? Promise.resolve(null) : apiRequest<CatalogPackage>(`/event/catalog/packages/${id}/`, { signal, fallback: t('packageForm.loadFailed') }),
      ])
      setPlans(loadedPlans)
      setContents(loadedContents)
      if (loadedItem) {
        setItem(loadedItem)
        setDraft(draftFrom(loadedItem))
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

  const dirty = item ? signature(draft) !== signature(draftFrom(item)) : undefined
  const update = (changes: Partial<Draft>) => { setDraft((current) => ({ ...current, ...changes })); setSaved(false) }

  async function createService() {
    const name = newService.trim()
    if (!name) return
    const existing = contents.find((content) => content.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!draft.contentIds.includes(existing.id)) update({ contentIds: [...draft.contentIds, existing.id] })
      setNewService('')
      return
    }
    setCreatingService(true)
    setError('')
    try {
      const created = await apiRequest<CatalogContent>('/event/catalog/contents/', { method: 'POST', body: { name }, fallback: t('packageForm.createServiceFailed') })
      setContents((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      update({ contentIds: [...draft.contentIds, created.id] })
      setNewService('')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('packageForm.createServiceFailed'))
    } finally {
      setCreatingService(false)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        name: draft.name.trim(), plan: Number(draft.plan), price: draft.price || '0',
        description: draft.description.trim(), content_ids: draft.contentIds,
      }
      const result = await apiRequest<CatalogPackage>(isNew ? '/event/catalog/packages/' : `/event/catalog/packages/${id}/`, {
        method: isNew ? 'POST' : 'PATCH', body, fallback: t('packageForm.saveFailed'), labels: { name: t('packageForm.name'), plan: t('packageForm.plan'), price: t('packageForm.price'), content_ids: t('packageForm.includedServices') },
      })
      if (isNew) {
        navigate(`/dashboard/catalog/packages/${result.id}`, { replace: true })
        return
      }
      setItem(result)
      setDraft(draftFrom(result))
      setSaved(true)
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('packageForm.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const contentOptions = contents.map((content) => ({ id: content.id, label: content.name }))
  const servicesPage = (
    <>
      <p className="o-form-hint">{t('packageForm.servicesHint')}</p>
      {editable ? (
        <>
          <Many2ManyTags options={contentOptions} value={draft.contentIds} onChange={(ids) => update({ contentIds: ids })} placeholder={t('packageForm.addService')} aria-label={t('packageForm.includedServices')} />
          <div className="cat-quick-create">
            <input
              className="o-input"
              aria-label={t('packageForm.newServiceName')}
              placeholder={t('packageForm.newServicePlaceholder')}
              value={newService}
              onChange={(event) => setNewService(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createService() } }}
            />
            <button type="button" className="o-btn o-btn-secondary o-btn-sm" disabled={!newService.trim() || creatingService} onClick={() => void createService()}>
              {creatingService ? t('packageForm.creating') : t('packageForm.createAdd')}
            </button>
          </div>
        </>
      ) : (
        <div className="cat-tags">
          {item?.contents.map((content) => <span key={content.id} className="o-tag">{content.name}</span>)}
          {!item?.contents.length && <span className="cat-muted">{t('packageForm.noServices')}</span>}
        </div>
      )}
      <p className="o-form-hint"><Link to="/dashboard/catalog/services" className="cat-row-link">{t('packageForm.manageServices')}</Link></p>
    </>
  )

  return (
    <AdminShell>
      {loading && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {!loading && (isNew || item) && (
        <RecordFormView
          modelName={t('packages.model')}
          title={draft.name}
          subtitle={item ? `${item.plan_name} · ${formatPrice(item.price)}` : t('packageForm.newSubtitle')}
          recordId={item?.id}
          backHref="/dashboard/catalog/packages"
          backLabel={t('packageForm.back')}
          headerAside={item && <>
            <Link to={`/dashboard/catalog/plans/${item.plan}`} className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">◈</span>
              <span><strong>{item.plan_name}</strong><small>{t('packageForm.statPlan')}</small></span>
            </Link>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">✦</span>
              <span><strong>{item.lead_count}</strong><small>{t('packageForm.statLeads')}</small></span>
            </div>
          </>}
          headerFields={[
            { name: 'name', label: t('packageForm.name'), value: draft.name, required: true, placeholder: t('packageForm.namePlaceholder') },
            { name: 'price', label: t('packageForm.priceLabel'), type: 'number', value: draft.price, placeholder: t('packageForm.pricePlaceholder'), helpText: t('packageForm.priceHelp') },
            {
              name: 'plan', label: t('packageForm.plan'), type: 'select', value: draft.plan, required: true,
              options: [{ value: '', label: t('packageForm.choosePlan') }, ...plans.map((plan) => ({ value: String(plan.id), label: plan.name }))],
            },
            { name: 'description', label: t('packageForm.description'), type: 'textarea', value: draft.description, fullWidth: true, placeholder: t('packageForm.descriptionPlaceholder') },
          ]}
          onFieldChange={(name, value) => update({ [name]: value } as Partial<Draft>)}
          tabs={[{ id: 'services', label: t('packageForm.includedServices'), badge: draft.contentIds.length, content: servicesPage }]}
          onSubmit={editable ? (event) => void save(event) : undefined}
          dirty={dirty}
          onDiscard={() => {
            if (isNew) { navigate('/dashboard/catalog/packages'); return }
            if (item) setDraft(draftFrom(item))
            setError('')
          }}
          saving={saving}
          saved={saved}
          chatter={item ? { model: 'package', recordId: item.id, refreshKey: chatterKey } : undefined}
        />
      )}
    </AdminShell>
  )
}
