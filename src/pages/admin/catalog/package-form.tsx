import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { RecordFormView } from '@/components/admin/record-form-view'
import { Many2ManyTags } from '@/components/admin/many2many-tags'
import { apiRequest } from '@/lib/api-request'
import { canManageCatalog, useProfile } from '@/lib/use-profile'
import { formatPrice, type CatalogContent, type CatalogPackage, type CatalogPlan } from './types'

type Draft = { name: string; plan: string; price: string; description: string; contentIds: number[] }

const fieldLabels = { name: 'Package name', plan: 'Plan', price: 'Price', content_ids: 'Included services' }

function draftFrom(item: CatalogPackage): Draft {
  return { name: item.name, plan: String(item.plan), price: item.price, description: item.description, contentIds: item.content_ids }
}

function signature(draft: Draft) {
  return JSON.stringify([draft.name.trim(), draft.plan, Number(draft.price || 0), draft.description.trim(), [...draft.contentIds].sort((a, b) => a - b)])
}

export function CatalogPackageFormPage() {
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
        apiRequest<CatalogPlan[]>('/event/catalog/plans/', { signal, fallback: 'Could not load plans.' }),
        apiRequest<CatalogContent[]>('/event/catalog/contents/', { signal, fallback: 'Could not load services.' }),
        isNew ? Promise.resolve(null) : apiRequest<CatalogPackage>(`/event/catalog/packages/${id}/`, { signal, fallback: 'Could not load this package.' }),
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
      const created = await apiRequest<CatalogContent>('/event/catalog/contents/', { method: 'POST', body: { name }, fallback: 'Could not create this service.' })
      setContents((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      update({ contentIds: [...draft.contentIds, created.id] })
      setNewService('')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create this service.')
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
        method: isNew ? 'POST' : 'PATCH', body, fallback: 'Could not save this package.', labels: fieldLabels,
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
      setError(saveError instanceof Error ? saveError.message : 'Could not save this package.')
    } finally {
      setSaving(false)
    }
  }

  const contentOptions = contents.map((content) => ({ id: content.id, label: content.name }))
  const servicesPage = (
    <>
      <p className="o-form-hint">What the customer gets with this package. Deposit invoices for won leads are split across these services.</p>
      {editable ? (
        <>
          <Many2ManyTags options={contentOptions} value={draft.contentIds} onChange={(ids) => update({ contentIds: ids })} placeholder="Add a service…" aria-label="Included services" />
          <div className="cat-quick-create">
            <input
              className="o-input"
              aria-label="New service name"
              placeholder="Not listed? Type a new service…"
              value={newService}
              onChange={(event) => setNewService(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createService() } }}
            />
            <button type="button" className="o-btn o-btn-secondary o-btn-sm" disabled={!newService.trim() || creatingService} onClick={() => void createService()}>
              {creatingService ? 'Creating…' : 'Create & add'}
            </button>
          </div>
        </>
      ) : (
        <div className="cat-tags">
          {item?.contents.map((content) => <span key={content.id} className="o-tag">{content.name}</span>)}
          {!item?.contents.length && <span className="cat-muted">No services listed.</span>}
        </div>
      )}
      <p className="o-form-hint"><Link to="/dashboard/catalog/services" className="cat-row-link">Manage all services</Link></p>
    </>
  )

  return (
    <AdminShell>
      {loading && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {!loading && (isNew || item) && (
        <RecordFormView
          modelName="Package"
          title={draft.name}
          subtitle={item ? `${item.plan_name} · ${formatPrice(item.price)}` : 'A priced bundle of services within a plan.'}
          recordId={item?.id}
          backHref="/dashboard/catalog/packages"
          backLabel="Packages"
          headerAside={item && <>
            <Link to={`/dashboard/catalog/plans/${item.plan}`} className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">◈</span>
              <span><strong>{item.plan_name}</strong><small>Plan</small></span>
            </Link>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">✦</span>
              <span><strong>{item.lead_count}</strong><small>Leads</small></span>
            </div>
          </>}
          headerFields={[
            { name: 'name', label: 'Package name', value: draft.name, required: true, placeholder: 'e.g. Gold' },
            { name: 'price', label: 'Price (ETB)', type: 'number', value: draft.price, placeholder: '0 = quote on request', helpText: 'Tax-inclusive. Used for the automatic deposit invoice.' },
            {
              name: 'plan', label: 'Plan', type: 'select', value: draft.plan, required: true,
              options: [{ value: '', label: 'Choose a plan' }, ...plans.map((plan) => ({ value: String(plan.id), label: plan.name }))],
            },
            { name: 'description', label: 'Description', type: 'textarea', value: draft.description, fullWidth: true, placeholder: 'Optional notes shown with the package.' },
          ]}
          onFieldChange={(name, value) => update({ [name]: value } as Partial<Draft>)}
          tabs={[{ id: 'services', label: 'Included services', badge: draft.contentIds.length, content: servicesPage }]}
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
