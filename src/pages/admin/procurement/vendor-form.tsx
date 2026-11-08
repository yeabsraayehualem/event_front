import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
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


function draftFrom(vendor: Vendor): Draft {
  return { ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, String(vendor[field] ?? '')])), active: vendor.active } as Draft
}

export function VendorFormPage() {
  const { t } = useTranslation('procurement')
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
        apiRequest<ProcurementOptions>('/procurement/options/', { signal, fallback: t('vendorForm.loadOptions') }),
        isNew ? Promise.resolve(null) : apiRequest<Vendor>(`/procurement/vendors/${id}/`, { signal, fallback: t('vendorForm.loadFailed') }),
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
        method: isNew ? 'POST' : 'PATCH', body, fallback: t('vendorForm.saveFailed'), labels: { name: t('vendorForm.name'), tin_number: t('vendorForm.tin'), license_number: t('vendorForm.licenseNumber'), payment_terms: t('vendorForm.paymentTerms') },
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
      setError(saveError instanceof Error ? saveError.message : t('vendorForm.saveFailed'))
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
      if (!response.ok) throw new Error(getErrorMessage(await response.json(), t('vendorForm.uploadFailed')))
      setUpload({ kind: upload.kind, file: null, expiresOn: '' })
      await refreshVendor()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('vendorForm.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function removeDocument(documentId: number, label: string) {
    if (!vendor || !window.confirm(t('vendorForm.confirmRemove', { document: label, vendor: vendor.name }))) return
    setError('')
    try {
      await apiRequest(`/procurement/vendors/${vendor.id}/documents/${documentId}/`, { method: 'DELETE', fallback: t('vendorForm.removeFailed') })
      await refreshVendor()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('vendorForm.removeFailed'))
    }
  }

  async function refreshVendor() {
    if (!vendor) return
    const fresh = await apiRequest<Vendor>(`/procurement/vendors/${vendor.id}/`, { fallback: t('vendorForm.reloadFailed') })
    setVendor(fresh)
    setChatterKey((key) => key + 1)
  }

  const documentsPage = vendor && options && (
    <>
      <p className="o-form-hint">{t('vendorForm.documentsHint')}</p>
      <div className="o-list-wrap">
        <table className="o-list">
          <thead><tr><th scope="col">{t('vendorForm.document')}</th><th scope="col">{t('vendorForm.file')}</th><th scope="col">{t('vendorForm.expires')}</th><th scope="col" className="o-list-actions"><span className="sr-only">{t('vendorForm.actions')}</span></th></tr></thead>
          <tbody>
            {vendor.documents.map((document) => (
              <tr key={document.id}>
                <td><strong>{document.kind_label}</strong></td>
                <td>{document.file_url ? <a href={document.file_url} target="_blank" rel="noreferrer" className="cat-row-link">{document.file_name}</a> : document.file_name}</td>
                <td>
                  {document.expires_on ? formatDualDate(document.expires_on) : <span className="o-muted">{t('vendorForm.noExpiry')}</span>}
                  {document.is_expired && <span className="proc-status proc-status--cancelled">{t('vendorForm.expired')}</span>}
                </td>
                <td className="o-list-actions">
                  <button type="button" className="o-btn o-btn-link o-btn-sm o-btn-danger" aria-label={t('vendorForm.removeDocument', { document: document.kind_label })} title={t('vendorForm.remove')} onClick={() => void removeDocument(document.id, document.kind_label)}>🗑</button>
                </td>
              </tr>
            ))}
            {vendor.documents.length === 0 && <tr><td colSpan={4} className="o-list-empty">{t('vendorForm.noDocuments')}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="proc-upload">
        <select className="o-input" aria-label={t('vendorForm.documentType')} value={upload.kind} onChange={(event) => setUpload({ ...upload, kind: event.target.value })}>
          {options.document_kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
        </select>
        <input className="o-input" type="file" aria-label={t('vendorForm.documentFile')} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] ?? null })} />
        <div className="proc-upload-expiry">
          <span className="cat-muted">{t('vendorForm.expiresOptional')}</span>
          <EthiopianDateInput value={upload.expiresOn} onChange={(iso) => setUpload({ ...upload, expiresOn: iso })} />
        </div>
        <button type="button" className="o-btn o-btn-secondary o-btn-sm" disabled={!upload.file || uploading} onClick={() => void uploadDocument()}>
          {uploading ? t('vendorForm.uploading') : t('vendorForm.upload')}
        </button>
      </div>
    </>
  )

  const ordersPage = vendor && (
    <>
      <div className="o-list-wrap">
        <table className="o-list">
          <thead><tr><th scope="col">{t('vendorForm.order')}</th><th scope="col">{t('vendorForm.event')}</th><th scope="col">{t('vendorForm.eventDate')}</th><th scope="col">{t('vendorForm.status')}</th><th scope="col" className="o-num">{t('vendorForm.total')}</th></tr></thead>
          <tbody>
            {vendor.purchase_orders.map((order) => (
              <tr key={order.id}>
                <td><Link to={`/dashboard/purchase-orders/${order.id}`} className="cat-row-link">{order.reference}</Link></td>
                <td>{order.event_name}</td>
                <td className="o-muted">{formatDualDate(order.event_date)}</td>
                <td><span className={`proc-status proc-status--${order.status}`}>{t(`orderStatus.${order.status as 'draft'}`, { defaultValue: order.status_label })}</span></td>
                <td className="o-num">{formatMoney(order.total)}</td>
              </tr>
            ))}
            {vendor.purchase_orders.length === 0 && <tr><td colSpan={5} className="o-list-empty">{t('vendorForm.noOrders')}</td></tr>}
          </tbody>
        </table>
      </div>
      <Link to={`/dashboard/purchase-orders/new?vendor=${vendor.id}`} className="o-list-add">{t('vendorForm.newOrder')}</Link>
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
          modelName={t('vendors.model')}
          title={draft.name}
          subtitle={vendor ? `${vendor.category_name}${vendor.contact_person ? ` · ${vendor.contact_person}` : ''}` : t('vendorForm.newSubtitle')}
          recordId={vendor?.id}
          backHref="/dashboard/vendors"
          backLabel={t('vendorForm.back')}
          ribbon={vendor && !vendor.active ? { label: t('vendorForm.archived'), tone: 'danger' } : null}
          actionSlot={vendor && <>
            <Link to={`/dashboard/purchase-orders/new?vendor=${vendor.id}`} className="o-btn o-btn-primary">{t('vendorForm.newOrder')}</Link>
            <button type="button" className="o-btn o-btn-secondary" onClick={() => update({ active: !draft.active })}>{draft.active ? t('vendorForm.archive') : t('vendorForm.restore')}</button>
          </>}
          headerAside={vendor && <>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">#</span>
              <span><strong>{activeOrders.length}</strong><small>{t('vendorForm.statOrders')}</small></span>
            </div>
            <div className="o-stat-button">
              <span className="o-stat-icon" aria-hidden="true">Br</span>
              <span><strong>{formatMoney(committed)}</strong><small>{t('vendorForm.statCommitted')}</small></span>
            </div>
            <div className={`o-stat-button${expiredDocs ? ' is-danger' : vendor.documents.length ? '' : ' is-muted'}`}>
              <span className="o-stat-icon" aria-hidden="true">✓</span>
              <span><strong>{expiredDocs ? t('vendorForm.expiredCount', { count: expiredDocs }) : vendor.documents.length}</strong><small>{t('vendorForm.statDocuments')}</small></span>
            </div>
          </>}
          headerFields={[
            { name: 'name', label: t('vendorForm.name'), value: draft.name, required: true, placeholder: t('vendorForm.namePlaceholder') },
            { name: 'category', label: t('vendorForm.category'), type: 'select', value: draft.category, required: true, options: options.categories.map((item) => ({ value: String(item.id), label: item.name })) },
            { name: 'phone', label: t('vendorForm.phone'), type: 'tel', value: draft.phone, required: true },
            { name: 'contact_person', label: t('vendorForm.contactPerson'), value: draft.contact_person },
            { name: 'email', label: t('vendorForm.email'), type: 'email', value: draft.email },
            { name: 'address', label: t('vendorForm.address'), value: draft.address },
          ]}
          onFieldChange={(name, value) => update({ [name]: value } as Partial<Draft>)}
          tabs={[
            {
              id: 'details', label: t('vendorForm.paymentTab'), sections: [
                {
                  title: t('vendorForm.payment'), fields: [
                    { name: 'payment_terms', label: t('vendorForm.paymentTerms'), type: 'select', value: draft.payment_terms, options: options.payment_terms },
                    { name: 'bank_name', label: t('vendorForm.bank'), value: draft.bank_name, placeholder: t('vendorForm.bankPlaceholder') },
                    { name: 'bank_account', label: t('vendorForm.account'), value: draft.bank_account },
                  ],
                },
                {
                  title: t('vendorForm.registration'), fields: [
                    { name: 'tin_number', label: t('vendorForm.tin'), value: draft.tin_number },
                    { name: 'license_number', label: t('vendorForm.licenseShort'), value: draft.license_number },
                  ],
                },
                { title: t('vendorForm.notes'), fields: [{ name: 'notes', label: t('vendorForm.notes'), type: 'textarea', value: draft.notes, fullWidth: true, placeholder: t('vendorForm.notesPlaceholder') }] },
              ],
            },
            ...(vendor ? [
              { id: 'documents', label: t('vendorForm.documentsTab'), badge: vendor.documents.length, content: documentsPage },
              { id: 'orders', label: t('vendorForm.ordersTab'), badge: vendor.purchase_orders.length, content: ordersPage },
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
