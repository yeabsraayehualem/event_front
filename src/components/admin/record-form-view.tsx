import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { formatDualDate } from '@/lib/ethiopian-calendar'

export type RecordFormValue = string | number | boolean | null
export type RecordFormValues = Record<string, RecordFormValue>
export type RecordFormCondition = boolean | ((values: RecordFormValues) => boolean)

export type RecordFormField = {
  name: string
  label: string
  value?: RecordFormValue
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'custom'
  options?: { value: string; label: string }[]
  placeholder?: string
  helpText?: string
  required?: RecordFormCondition
  requiredWhen?: (values: RecordFormValues) => boolean
  readOnly?: RecordFormCondition
  readOnlyWhen?: (values: RecordFormValues) => boolean
  fullWidth?: boolean
  render?: ReactNode
}

export type RecordFormSection = {
  title: string
  description?: string
  fields: RecordFormField[]
}

export type RecordFormStatus = { value: string; label: string }
export type RecordFormTab = { id: string; label: string; sections?: RecordFormSection[]; content?: ReactNode }

type RecordFormViewProps = {
  modelName: string
  title: string
  subtitle?: string
  recordId?: string | number
  backHref?: string
  backLabel?: string
  actionSlot?: ReactNode
  toolbarAside?: ReactNode
  headerAside?: ReactNode
  status?: string
  statusOptions?: RecordFormStatus[]
  onStatusChange?: (value: string) => void
  headerFields?: RecordFormField[]
  sections?: RecordFormSection[]
  tabs?: RecordFormTab[]
  onFieldChange?: (name: string, value: string) => void
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  saving?: boolean
  saved?: boolean
  submitLabel?: string
  submittingLabel?: string
}

function displayValue(value: RecordFormValue | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function conditionMatches(condition: RecordFormCondition | undefined, values: RecordFormValues) {
  return typeof condition === 'function' ? condition(values) : condition === true
}

export function RecordFormView({
  modelName, title, subtitle, recordId, backHref, backLabel = 'Back', actionSlot,
  toolbarAside, headerAside, status, statusOptions, onStatusChange, sections = [], onFieldChange,
  headerFields = [], tabs = [],
  onSubmit, saving = false, saved = false, submitLabel = 'Save',
  submittingLabel = 'Saving…',
}: RecordFormViewProps) {
  const editable = Boolean(onSubmit)
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '')
  const allSections = [...sections, ...tabs.flatMap((tab) => tab.sections ?? [])]
  const allFields = [...headerFields, ...allSections.flatMap((section) => section.fields)]
  const values = Object.fromEntries(allFields.map((field) => [field.name, field.value ?? null]))

  function renderField(field: RecordFormField, variant: 'header' | 'tab') {
    const value = field.value ?? ''
    const fieldId = `${modelName.toLowerCase().replace(/\\W+/g, '-')}-${field.name}`
    const readOnly = conditionMatches(field.readOnly, values) || Boolean(field.readOnlyWhen?.(values))
    const required = conditionMatches(field.required, values) || Boolean(field.requiredWhen?.(values))
    return (
      <div className={`record-form-field record-form-field--${variant}${field.fullWidth ? ' record-form-field--wide' : ''}${readOnly ? ' record-form-field--readonly' : ''}`} key={field.name}>
        <label htmlFor={field.render || readOnly ? undefined : fieldId}>{field.label}{required && <span className="record-form-required" aria-hidden="true"> *</span>}</label>
        <div className="record-form-control">
          {field.render ?? (readOnly || !editable ? (
            <div className="record-form-value">{field.type === 'date' && field.value ? formatDualDate(String(field.value)) : displayValue(field.value)}</div>
          ) : field.type === 'textarea' ? (
            <textarea id={fieldId} value={String(value)} required={required} placeholder={field.placeholder} onChange={(event) => onFieldChange?.(field.name, event.target.value)} />
          ) : field.type === 'date' ? (
            <EthiopianDateInput id={fieldId} value={String(value ?? '')} required={required} onChange={(iso) => onFieldChange?.(field.name, iso)} />
          ) : field.type === 'select' ? (
            <select id={fieldId} value={String(value)} required={required} onChange={(event) => onFieldChange?.(field.name, event.target.value)}>
              {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : (
            <input id={fieldId} type={field.type ?? 'text'} value={String(value)} required={required} placeholder={field.placeholder} onChange={(event) => onFieldChange?.(field.name, event.target.value)} />
          ))}
          {field.helpText && <small>{field.helpText}</small>}
        </div>
      </div>
    )
  }

  return (
    <form className="record-form-shell" onSubmit={onSubmit}>
      <div className="record-form-toolbar">
        <div className="record-form-toolbar-actions">
          {backHref && <Link className="record-form-back" to={backHref}>{backLabel}</Link>}
          {editable && (
            <button type="submit" disabled={saving} className="record-form-save">
              {saved ? 'Saved' : (saving ? submittingLabel : submitLabel)}
            </button>
          )}
          {actionSlot}
          {recordId !== undefined && <span className="record-form-id">{modelName} #{recordId}</span>}
        </div>
        <div className="record-form-toolbar-meta">
          {toolbarAside && <div className="record-form-aside">{toolbarAside}</div>}
          {statusOptions?.length ? (
            <nav className="record-form-statusbar" aria-label={`${modelName} status`}>
              {statusOptions.map((option) => (
                <button key={option.value} type="button" aria-current={status === option.value ? 'step' : undefined} className={status === option.value ? 'is-current' : ''} onClick={() => onStatusChange?.(option.value)}>
                  {option.label}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </div>

      <section className="record-form-sheet">
        <header className="record-form-heading">
          <div>
            <span className="record-form-model">{modelName}</span>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {headerAside && <div className="record-form-heading-aside">{headerAside}</div>}
        </header>

        {headerFields.length > 0 && <div className="record-form-header-fields">{headerFields.map((field) => renderField(field, 'header'))}</div>}

        {allSections.length > 0 && (
          <div className="record-form-group">
            <div className="record-form-group-heading">
              <h2 className="record-form-group-title">Details</h2>
              {allSections[0].description && <p>{allSections[0].description}</p>}
            </div>
            {allSections.map((section) => (
              <section className="record-form-section" key={section.title}>
                <div className="record-form-section-heading">
                  <h3 className="record-form-section-title">{section.title}</h3>
                  {section.description && <p>{section.description}</p>}
                </div>
                <div className="record-form-fields">
                  {section.fields.map((field) => renderField(field, 'tab'))}
                </div>
              </section>
            ))}
          </div>
        )}

        {tabs.length > 0 && (
          <div className="record-form-notebook">
            <div className="record-form-tabs" role="tablist" aria-label={`${modelName} details`}>
              {tabs.map((tab) => (
                <button key={tab.id} id={`${tab.id}-tab`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`${tab.id}-panel`} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
            {tabs.filter((tab) => tab.id === activeTab).map((tab) => (
              <div key={tab.id} id={`${tab.id}-panel`} role="tabpanel" aria-labelledby={`${tab.id}-tab`} className="record-form-tab-panel">
                {tab.content}
                {tab.sections?.map((section) => (
                  <section className="record-form-section" key={section.title}>
                    <div className="record-form-section-heading">
                      <h3 className="record-form-section-title">{section.title}</h3>
                      {section.description && <p>{section.description}</p>}
                    </div>
                    <div className="record-form-fields">
                      {section.fields.map((field) => renderField(field, 'tab'))}
                    </div>
                  </section>
                ))}
              </div>
            ))}
          </div>
        )}

        {editable && (
          <footer className="record-form-footer">
            {saved ? <p role="status">Changes saved.</p> : <span />}
            <div className="record-form-footer-actions">
              <button type="submit" disabled={saving} className="record-form-save">
                {saving ? submittingLabel : submitLabel}
              </button>
            </div>
          </footer>
        )}
      </section>
    </form>
  )
}
