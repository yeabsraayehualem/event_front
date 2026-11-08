import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { RecordFormView } from '@/components/admin/record-form-view'
import { apiBaseUrl } from '@/lib/api'
import { fetchCsrfToken } from '@/lib/csrf'
import { getErrorMessage } from '@/lib/api-errors'
import { apiRequest } from '@/lib/api-request'
import { canManageCatalog, useProfile } from '@/lib/use-profile'
import { formatPrice, type CatalogPlan } from './types'

type EventTypeRow = { key: string; id?: number; name: string; lead_count: number }
type Draft = { name: string; description: string; eventTypes: EventTypeRow[] }

const emptyDraft: Draft = { name: '', description: '', eventTypes: [] }

function draftFrom(plan: CatalogPlan): Draft {
  return {
    name: plan.name,
    description: plan.description,
    eventTypes: plan.event_types.map((item) => ({ key: String(item.id), id: item.id, name: item.name, lead_count: item.lead_count ?? 0 })),
  }
}

function signature(draft: Draft) {
  return JSON.stringify([draft.name.trim(), draft.description.trim(), draft.eventTypes.map((row) => [row.id ?? null, row.name.trim()])])
}

export function CatalogPlanFormPage() {
  const { t } = useTranslation('catalog')
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const editable = canManageCatalog(useProfile())
  const [plan, setPlan] = useState<CatalogPlan | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [chatterKey, setChatterKey] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    if (isNew) return
    try {
      const loaded = await apiRequest<CatalogPlan>(`/event/catalog/plans/${id}/`, { signal, fallback: t('planForm.loadFailed') })
      setPlan(loaded)
      setDraft(draftFrom(loaded))
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

  // Release the local preview URL when it is replaced or the page closes.
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])

  const dirty = signature(draft) !== signature(plan ? draftFrom(plan) : emptyDraft) || Boolean(imageFile) || removeImage

  function resetImage() {
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  function updateRow(key: string, name: string) {
    setDraft((current) => ({ ...current, eventTypes: current.eventTypes.map((row) => row.key === key ? { ...row, name } : row) }))
    setSaved(false)
  }

  async function uploadImage(planId: number) {
    if (imageFile) {
      const body = new FormData()
      body.append('image', imageFile)
      const response = await fetch(`${apiBaseUrl}/event/catalog/plans/${planId}/image/`, {
        method: 'POST', credentials: 'include', body,
        headers: { Accept: 'application/json', 'X-CSRFToken': await fetchCsrfToken() },
      })
      if (!response.ok) throw new Error(getErrorMessage(await response.json(), t('planForm.imageUploadFailed')))
    } else if (removeImage) {
      await apiRequest(`/event/catalog/plans/${planId}/image/`, { method: 'DELETE', fallback: t('planForm.imageRemoveFailed') })
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        event_types: draft.eventTypes.filter((row) => row.name.trim()).map((row) => ({ ...(row.id ? { id: row.id } : {}), name: row.name.trim() })),
      }
      const result = await apiRequest<CatalogPlan>(isNew ? '/event/catalog/plans/' : `/event/catalog/plans/${id}/`, {
        method: isNew ? 'POST' : 'PATCH', body, fallback: t('planForm.saveFailed'), labels: { name: t('planForm.name'), event_types: t('planForm.eventTypes') },
      })
      await uploadImage(result.id)
      resetImage()
      if (isNew) {
        navigate(`/dashboard/catalog/plans/${result.id}`, { replace: true })
        return
      }
      await load()
      setSaved(true)
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('planForm.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const shownImage = imagePreview ?? (removeImage ? null : plan?.image_url ?? null)

  const imagePicker = (
    <div className="cat-image-field">
      <div className="cat-image-preview">
        {shownImage ? <img src={shownImage} alt={t('planForm.pictureAlt', { name: draft.name || t('planForm.planFallback') })} /> : <span aria-hidden="true">{t('planForm.noPicture')}</span>}
      </div>
      {editable && (
        <div className="cat-image-actions">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            id="plan-image"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setImageFile(file)
              setImagePreview(URL.createObjectURL(file))
              setRemoveImage(false)
              setSaved(false)
            }}
          />
          <label htmlFor="plan-image" className="o-btn o-btn-secondary o-btn-sm">{shownImage ? t('planForm.replace') : t('planForm.upload')}</label>
          {shownImage && (
            <button type="button" className="o-btn o-btn-link o-btn-sm o-btn-danger" onClick={() => {
              if (imageFile) resetImage()
              else setRemoveImage(true)
              setSaved(false)
            }}>{t('planForm.remove')}</button>
          )}
        </div>
      )}
    </div>
  )

  const eventTypesPage = (
    <>
      <p className="o-form-hint">{t('planForm.eventTypesHint')}</p>
      <div className="o-list-wrap">
        <table className="o-list cat-list">
          <thead><tr><th scope="col">{t('planForm.eventType')}</th><th scope="col" className="o-num">{t('planForm.leads')}</th><th scope="col" className="o-list-actions"><span className="sr-only">{t('planForm.actions')}</span></th></tr></thead>
          <tbody>
            {draft.eventTypes.map((row) => (
              <tr key={row.key} className={row.id ? '' : 'is-new'}>
                <td>
                  {editable
                    ? <input className="o-input" aria-label={t('planForm.eventTypeName')} value={row.name} placeholder={t('planForm.eventTypePlaceholder')} onChange={(event) => updateRow(row.key, event.target.value)} />
                    : <span className="o-field-value">{row.name}</span>}
                </td>
                <td className="o-num o-muted">{row.lead_count}</td>
                <td className="o-list-actions">
                  {editable && (
                    <button
                      type="button"
                      className="o-btn o-btn-link o-btn-sm o-btn-danger"
                      disabled={row.lead_count > 0}
                      title={row.lead_count > 0 ? t('planForm.usedByLeads') : t('planForm.remove')}
                      aria-label={t('planForm.removeRow', { name: row.name || t('planForm.eventTypeFallback') })}
                      onClick={() => { setDraft((current) => ({ ...current, eventTypes: current.eventTypes.filter((item) => item.key !== row.key) })); setSaved(false) }}
                    >🗑</button>
                  )}
                </td>
              </tr>
            ))}
            {draft.eventTypes.length === 0 && <tr><td colSpan={3} className="o-list-empty">{t('planForm.noEventTypes')}</td></tr>}
          </tbody>
        </table>
      </div>
      {editable && (
        <button type="button" className="o-list-add" onClick={() => {
          setDraft((current) => ({ ...current, eventTypes: [...current.eventTypes, { key: `new-${Date.now()}`, name: '', lead_count: 0 }] }))
          setSaved(false)
        }}>{t('addLine')}</button>
      )}
    </>
  )

  const packagesPage = plan && (
    <>
      <div className="o-list-wrap">
        <table className="o-list cat-list">
          <thead><tr><th scope="col">{t('planForm.package')}</th><th scope="col" className="o-num">{t('planForm.services')}</th><th scope="col" className="o-num">{t('planForm.price')}</th></tr></thead>
          <tbody>
            {plan.packages.map((item) => (
              <tr key={item.id}>
                <td><Link to={`/dashboard/catalog/packages/${item.id}`} className="cat-row-link">{item.name}</Link></td>
                <td className="o-num o-muted">{item.content_count}</td>
                <td className="o-num">{formatPrice(item.price)}</td>
              </tr>
            ))}
            {plan.packages.length === 0 && <tr><td colSpan={3} className="o-list-empty">{t('planForm.noPackages')}</td></tr>}
          </tbody>
        </table>
      </div>
      {editable && <Link to={`/dashboard/catalog/packages/new?plan=${plan.id}`} className="o-list-add">{t('planForm.addPackage')}</Link>}
    </>
  )

  return (
    <AdminShell>
      {loading && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {!loading && (isNew || plan) && (
        <RecordFormView
          modelName={t('plans.model')}
          title={draft.name}
          subtitle={plan ? t('planForm.leadsSoFar', { count: plan.lead_count }) : t('planForm.newSubtitle')}
          recordId={plan?.id}
          backHref="/dashboard/catalog/plans"
          backLabel={t('planForm.back')}
          headerAside={plan && <>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">◈</span>
              <span><strong>{plan.packages.length}</strong><small>{t('planForm.statPackages')}</small></span>
            </div>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">✦</span>
              <span><strong>{plan.lead_count}</strong><small>{t('planForm.statLeads')}</small></span>
            </div>
          </>}
          headerFields={[
            { name: 'name', label: t('planForm.name'), value: draft.name, required: true, placeholder: t('planForm.namePlaceholder') },
            { name: 'image', label: t('planForm.picture'), render: imagePicker },
            { name: 'description', label: t('planForm.description'), type: 'textarea', value: draft.description, fullWidth: true, placeholder: t('planForm.descriptionPlaceholder') },
          ]}
          onFieldChange={(name, value) => { setDraft((current) => ({ ...current, [name]: value })); setSaved(false) }}
          tabs={[
            { id: 'event-types', label: t('planForm.eventTypes'), badge: draft.eventTypes.length, content: eventTypesPage },
            ...(plan ? [{ id: 'packages', label: t('planForm.packagesTab'), badge: plan.packages.length, content: packagesPage }] : []),
          ]}
          onSubmit={editable ? (event) => void save(event) : undefined}
          dirty={isNew ? undefined : dirty}
          onDiscard={() => {
            if (isNew) { navigate('/dashboard/catalog/plans'); return }
            if (plan) setDraft(draftFrom(plan))
            resetImage()
            setError('')
          }}
          saving={saving}
          saved={saved}
          chatter={plan ? { model: 'plan', recordId: plan.id, refreshKey: chatterKey } : undefined}
        />
      )}
    </AdminShell>
  )
}
