import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
const fieldLabels = { name: 'Plan name', event_types: 'Event types' }

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
      const loaded = await apiRequest<CatalogPlan>(`/event/catalog/plans/${id}/`, { signal, fallback: 'Could not load this plan.' })
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
      if (!response.ok) throw new Error(getErrorMessage(await response.json(), 'The plan was saved, but its picture could not be uploaded.'))
    } else if (removeImage) {
      await apiRequest(`/event/catalog/plans/${planId}/image/`, { method: 'DELETE', fallback: 'Could not remove the picture.' })
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
        method: isNew ? 'POST' : 'PATCH', body, fallback: 'Could not save this plan.', labels: fieldLabels,
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
      setError(saveError instanceof Error ? saveError.message : 'Could not save this plan.')
    } finally {
      setSaving(false)
    }
  }

  const shownImage = imagePreview ?? (removeImage ? null : plan?.image_url ?? null)

  const imagePicker = (
    <div className="cat-image-field">
      <div className="cat-image-preview">
        {shownImage ? <img src={shownImage} alt={`${draft.name || 'Plan'} picture`} /> : <span aria-hidden="true">No picture</span>}
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
          <label htmlFor="plan-image" className="o-btn o-btn-secondary o-btn-sm">{shownImage ? 'Replace' : 'Upload'}</label>
          {shownImage && (
            <button type="button" className="o-btn o-btn-link o-btn-sm o-btn-danger" onClick={() => {
              if (imageFile) resetImage()
              else setRemoveImage(true)
              setSaved(false)
            }}>Remove</button>
          )}
        </div>
      )}
    </div>
  )

  const eventTypesPage = (
    <>
      <p className="o-form-hint">The occasions this plan covers. Leads and the website inquiry form offer only these when this plan is chosen.</p>
      <div className="o-list-wrap">
        <table className="o-list cat-list">
          <thead><tr><th scope="col">Event type</th><th scope="col" className="o-num">Leads</th><th scope="col" className="o-list-actions"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {draft.eventTypes.map((row) => (
              <tr key={row.key} className={row.id ? '' : 'is-new'}>
                <td>
                  {editable
                    ? <input className="o-input" aria-label="Event type name" value={row.name} placeholder="e.g. Church wedding (Teklil)" onChange={(event) => updateRow(row.key, event.target.value)} />
                    : <span className="o-field-value">{row.name}</span>}
                </td>
                <td className="o-num o-muted">{row.lead_count}</td>
                <td className="o-list-actions">
                  {editable && (
                    <button
                      type="button"
                      className="o-btn o-btn-link o-btn-sm o-btn-danger"
                      disabled={row.lead_count > 0}
                      title={row.lead_count > 0 ? 'Used by leads — rename it instead' : 'Remove'}
                      aria-label={`Remove ${row.name || 'event type'}`}
                      onClick={() => { setDraft((current) => ({ ...current, eventTypes: current.eventTypes.filter((item) => item.key !== row.key) })); setSaved(false) }}
                    >🗑</button>
                  )}
                </td>
              </tr>
            ))}
            {draft.eventTypes.length === 0 && <tr><td colSpan={3} className="o-list-empty">No event types yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {editable && (
        <button type="button" className="o-list-add" onClick={() => {
          setDraft((current) => ({ ...current, eventTypes: [...current.eventTypes, { key: `new-${Date.now()}`, name: '', lead_count: 0 }] }))
          setSaved(false)
        }}>Add a line</button>
      )}
    </>
  )

  const packagesPage = plan && (
    <>
      <div className="o-list-wrap">
        <table className="o-list cat-list">
          <thead><tr><th scope="col">Package</th><th scope="col" className="o-num">Services</th><th scope="col" className="o-num">Price</th></tr></thead>
          <tbody>
            {plan.packages.map((item) => (
              <tr key={item.id}>
                <td><Link to={`/dashboard/catalog/packages/${item.id}`} className="cat-row-link">{item.name}</Link></td>
                <td className="o-num o-muted">{item.content_count}</td>
                <td className="o-num">{formatPrice(item.price)}</td>
              </tr>
            ))}
            {plan.packages.length === 0 && <tr><td colSpan={3} className="o-list-empty">No packages in this plan yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {editable && <Link to={`/dashboard/catalog/packages/new?plan=${plan.id}`} className="o-list-add">Add a package</Link>}
    </>
  )

  return (
    <AdminShell>
      {loading && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {!loading && (isNew || plan) && (
        <RecordFormView
          modelName="Plan"
          title={draft.name}
          subtitle={plan ? `${plan.lead_count} ${plan.lead_count === 1 ? 'lead' : 'leads'} so far` : 'A celebration you offer, with its event types and packages.'}
          recordId={plan?.id}
          backHref="/dashboard/catalog/plans"
          backLabel="Plans"
          headerAside={plan && <>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">◈</span>
              <span><strong>{plan.packages.length}</strong><small>Packages</small></span>
            </div>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">✦</span>
              <span><strong>{plan.lead_count}</strong><small>Leads</small></span>
            </div>
          </>}
          headerFields={[
            { name: 'name', label: 'Plan name', value: draft.name, required: true, placeholder: 'e.g. Wedding' },
            { name: 'image', label: 'Picture', render: imagePicker },
            { name: 'description', label: 'Description', type: 'textarea', value: draft.description, fullWidth: true, placeholder: 'Shown on the website plan card.' },
          ]}
          onFieldChange={(name, value) => { setDraft((current) => ({ ...current, [name]: value })); setSaved(false) }}
          tabs={[
            { id: 'event-types', label: 'Event types', badge: draft.eventTypes.length, content: eventTypesPage },
            ...(plan ? [{ id: 'packages', label: 'Packages', badge: plan.packages.length, content: packagesPage }] : []),
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
