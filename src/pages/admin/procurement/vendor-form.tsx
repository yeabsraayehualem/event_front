import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { RecordFormView } from '@/components/admin/record-form-view'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { apiBaseUrl } from '@/lib/api'
import { apiRequest } from '@/lib/api-request'
import { getErrorMessage } from '@/lib/api-errors'
import { fetchCsrfToken } from '@/lib/csrf'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { formatMoney, type ProcurementOptions, type Vendor } from './types'

const TEXT_FIELDS = [
  'name', 'category', 'contact_person', 'phone', 'email', 'address', 'tin_number', 'license_number',
  'payment_terms', 'bank_name', 'bank_account', 'notes',
] as const
type Draft = Record<(typeof TEXT_FIELDS)[number], string> & { active: boolean }

const EMPTY: Draft = {
  name: '', category: '', contact_person: '', phone: '', email: '', address: '', tin_number: '', license_number: '',
  payment_terms: 'on_delivery', bank_name: '', bank_account: '', notes: '', active: true,
}

const fieldLabels = { name: 'Vendor name', tin_number: 'TIN', license_number: 'Business license number', payment_terms: 'Payment terms' }

function draftFrom(vendor: Vendor): Draft {
  return { ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, String(vendor[field] ?? '')])), active: vendor.active } as Draft
}

export function VendorFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [options, setOptions] = useState<ProcurementOptions | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [chatterKey, setChatterKey] = useState(0)
  const [upload, setUpload] = useState<{ kind: string; file: File | null; expiresOn: string }>({ kind: 'business_license', file: null, expiresOn: '' })
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [loadedOptions, loadedVendor] = await Promise.all([
        apiRequest<ProcurementOptions>('/procurement/options/', { signal, fallback: 'Could not load vendor options.' }),
        isNew ? Promise.resolve(null) : apiRequest<Vendor>(`/procurement/vendors/${id}/`, { signal, fallback: 'Could not load this vendor.' }),
      ])
      setOptions(loadedOptions)
      if (loadedVendor) {
        setVendor(loadedVendor)
        setDraft(draftFrom(loadedVendor))
      } else {
        setDraft((current) => ({ ...current, category: current.category || String(loadedOptions.categories[0]?.id ?? '') }))
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

  const dirty = vendor ? JSON.stringify(draft) !== JSON.stringify(draftFrom(vendor)) : undefined
  const update = (changes: Partial<Draft>) => { setDraft((current) => ({ ...current, ...changes })); setSaved(false) }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = { ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, draft[field].trim()])), category: Number(draft.category), active: draft.active }
      const result = await apiRequest<Vendor>(isNew ? '/procurement/vendors/' : `/procurement/vendors/${id}/`, {
        method: isNew ? 'POST' : 'PATCH', body, fallback: 'Could not save this vendor.', labels: fieldLabels,
      })
      if (isNew) {
        navigate(`/dashboard/vendors/${result.id}`, { replace: true })
        return
      }
      setVendor(result)
      setDraft(draftFrom(result))
      setSaved(true)
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this vendor.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadDocument() {
    if (!vendor || !upload.file) return
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      body.append('kind', upload.kind)
      body.append('file', upload.file)
      if (upload.expiresOn) body.append('expires_on', upload.expiresOn)
      const response = await fetch(`${apiBaseUrl}/procurement/vendors/${vendor.id}/documents/`, {
        method: 'POST', credentials: 'include', body,
        headers: { Accept: 'application/json', 'X-CSRFToken': await fetchCsrfToken() },
      })
      if (!response.ok) throw new Error(getErrorMessage(await response.json(), 'Could not upload this document.'))
      setUpload({ kind: upload.kind, file: null, expiresOn: '' })
      await refreshVendor()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload this document.')
    } finally {
      setUploading(false)
    }
  }

  async function removeDocument(documentId: number, label: string) {
    if (!vendor || !window.confirm(`Remove the ${label.toLowerCase()} from ${vendor.name}?`)) return
    setError('')
    try {
      await apiRequest(`/procurement/vendors/${vendor.id}/documents/${documentId}/`, { method: 'DELETE', fallback: 'Could not remove this document.' })
      await refreshVendor()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove this document.')
    }
  }

  async function refreshVendor() {
    if (!vendor) return
    const fresh = await apiRequest<Vendor>(`/procurement/vendors/${vendor.id}/`, { fallback: 'Could not reload this vendor.' })
    setVendor(fresh)
    setChatterKey((key) => key + 1)
  }

  const documentsPage = vendor && options && (
    <>
      <p className="o-form-hint">Keep the business license and tax registration on file. Expired documents are flagged.</p>
      <div className="o-list-wrap">
        <table className="o-list">
          <thead><tr><th scope="col">Document</th><th scope="col">File</th><th scope="col">Expires</th><th scope="col" className="o-list-actions"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {vendor.documents.map((document) => (
              <tr key={document.id}>
                <td><strong>{document.kind_label}</strong></td>
                <td>{document.file_url ? <a href={document.file_url} target="_blank" rel="noreferrer" className="cat-row-link">{document.file_name}</a> : document.file_name}</td>
                <td>
                  {document.expires_on ? formatDualDate(document.expires_on) : <span className="o-muted">No expiry</span>}
                  {document.is_expired && <span className="proc-status proc-status--cancelled">Expired</span>}
                </td>
                <td className="o-list-actions">
                  <button type="button" className="o-btn o-btn-link o-btn-sm o-btn-danger" aria-label={`Remove ${document.kind_label}`} title="Remove" onClick={() => void removeDocument(document.id, document.kind_label)}>🗑</button>
                </td>
              </tr>
            ))}
            {vendor.documents.length === 0 && <tr><td colSpan={4} className="o-list-empty">No documents on file yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="proc-upload">
        <select className="o-input" aria-label="Document type" value={upload.kind} onChange={(event) => setUpload({ ...upload, kind: event.target.value })}>
          {options.document_kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
        </select>
        <input className="o-input" type="file" aria-label="Document file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] ?? null })} />
        <div className="proc-upload-expiry">
          <span className="cat-muted">Expires (optional)</span>
          <EthiopianDateInput value={upload.expiresOn} onChange={(iso) => setUpload({ ...upload, expiresOn: iso })} />
        </div>
        <button type="button" className="o-btn o-btn-secondary o-btn-sm" disabled={!upload.file || uploading} onClick={() => void uploadDocument()}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </>
  )

  const ordersPage = vendor && (
    <>
      <div className="o-list-wrap">
        <table className="o-list">
          <thead><tr><th scope="col">Order</th><th scope="col">Event</th><th scope="col">Event date</th><th scope="col">Status</th><th scope="col" className="o-num">Total</th></tr></thead>
          <tbody>
            {vendor.purchase_orders.map((order) => (
              <tr key={order.id}>
                <td><Link to={`/dashboard/purchase-orders/${order.id}`} className="cat-row-link">{order.reference}</Link></td>
                <td>{order.event_name}</td>
                <td className="o-muted">{formatDualDate(order.event_date)}</td>
                <td><span className={`proc-status proc-status--${order.status}`}>{order.status_label}</span></td>
                <td className="o-num">{formatMoney(order.total)}</td>
              </tr>
            ))}
            {vendor.purchase_orders.length === 0 && <tr><td colSpan={5} className="o-list-empty">No orders with this vendor yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Link to={`/dashboard/purchase-orders/new?vendor=${vendor.id}`} className="o-list-add">New purchase order</Link>
    </>
  )

  const activeOrders = vendor?.purchase_orders.filter((order) => order.status !== 'cancelled') ?? []
  const committed = activeOrders.filter((order) => order.status === 'approved' || order.status === 'received').reduce((sum, order) => sum + Number(order.total), 0)
  const expiredDocs = vendor?.documents.filter((document) => document.is_expired).length ?? 0

  return (
    <AdminShell>
      {loading && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {!loading && options && (isNew || vendor) && (
        <RecordFormView
          modelName="Vendor"
          title={draft.name}
          subtitle={vendor ? `${vendor.category_name}${vendor.contact_person ? ` · ${vendor.contact_person}` : ''}` : 'A supplier you hire for events: caterer, rental, photographer…'}
          recordId={vendor?.id}
          backHref="/dashboard/vendors"
          backLabel="Vendors"
          ribbon={vendor && !vendor.active ? { label: 'Archived', tone: 'danger' } : null}
          actionSlot={vendor && <>
            <Link to={`/dashboard/purchase-orders/new?vendor=${vendor.id}`} className="o-btn o-btn-primary">New purchase order</Link>
            <button type="button" className="o-btn o-btn-secondary" onClick={() => update({ active: !draft.active })}>{draft.active ? 'Archive' : 'Restore'}</button>
          </>}
          headerAside={vendor && <>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">#</span>
              <span><strong>{activeOrders.length}</strong><small>Orders</small></span>
            </div>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">Br</span>
              <span><strong>{formatMoney(committed)}</strong><small>Committed</small></span>
            </div>
            <div className={`o-stat-button${expiredDocs ? ' is-danger' : vendor.documents.length ? '' : ' is-muted'}`}>
              <span className="o-stat-icon" aria-hidden="true">✓</span>
              <span><strong>{expiredDocs ? `${expiredDocs} expired` : vendor.documents.length}</strong><small>Documents</small></span>
            </div>
          </>}
          headerFields={[
            { name: 'name', label: 'Vendor name', value: draft.name, required: true, placeholder: 'e.g. Yod Abyssinia Catering' },
            { name: 'category', label: 'Category', type: 'select', value: draft.category, required: true, options: options.categories.map((item) => ({ value: String(item.id), label: item.name })) },
            { name: 'phone', label: 'Phone', type: 'tel', value: draft.phone, required: true },
            { name: 'contact_person', label: 'Contact person', value: draft.contact_person },
            { name: 'email', label: 'Email', type: 'email', value: draft.email },
            { name: 'address', label: 'Address', value: draft.address },
          ]}
          onFieldChange={(name, value) => update({ [name]: value } as Partial<Draft>)}
          tabs={[
            {
              id: 'details', label: 'Payment & compliance', sections: [
                {
                  title: 'Payment', fields: [
                    { name: 'payment_terms', label: 'Payment terms', type: 'select', value: draft.payment_terms, options: options.payment_terms },
                    { name: 'bank_name', label: 'Bank', value: draft.bank_name, placeholder: 'e.g. CBE' },
                    { name: 'bank_account', label: 'Account number', value: draft.bank_account },
                  ],
                },
                {
                  title: 'Registration', fields: [
                    { name: 'tin_number', label: 'TIN', value: draft.tin_number },
                    { name: 'license_number', label: 'Business license no.', value: draft.license_number },
                  ],
                },
                { title: 'Notes', fields: [{ name: 'notes', label: 'Notes', type: 'textarea', value: draft.notes, fullWidth: true, placeholder: 'Specialities, minimum order, lead time…' }] },
              ],
            },
            ...(vendor ? [
              { id: 'documents', label: 'Documents', badge: vendor.documents.length, content: documentsPage },
              { id: 'orders', label: 'Purchase orders', badge: vendor.purchase_orders.length, content: ordersPage },
            ] : []),
          ]}
          onSubmit={(event) => void save(event)}
          dirty={dirty}
          onDiscard={() => {
            if (isNew) { navigate('/dashboard/vendors'); return }
            if (vendor) setDraft(draftFrom(vendor))
            setError('')
          }}
          saving={saving}
          saved={saved}
          chatter={vendor ? { model: 'vendor', recordId: vendor.id, refreshKey: chatterKey } : undefined}
        />
      )}
    </AdminShell>
  )
}
