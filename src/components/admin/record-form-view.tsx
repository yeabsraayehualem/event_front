import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { Chatter, type ChatterModel } from '@/components/admin/chatter'
import { formatDualDate } from '@/lib/ethiopian-calendar'

export type RecordFormValue = string | number | boolean | null
export type RecordFormValues = Record<string, RecordFormValue>
export type RecordFormCondition = boolean | ((values: RecordFormValues) => boolean)

export type RecordFormField = {
  name: string
  label: string
  value?: RecordFormValue
  /** Text shown for a read-only select instead of its raw value. */
  displayValue?: string
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

/** `folded` statuses (e.g. Lost) only appear in the status bar while they are current. */
export type RecordFormStatus = { value: string; label: string; folded?: boolean }
export type RecordFormTab = { id: string; label: string; badge?: string | number; sections?: RecordFormSection[]; content?: ReactNode }
export type RecordFormRibbon = { label: string; tone?: 'success' | 'danger' | 'info' }

type RecordFormViewProps = {
  modelName: string
  title: string
  subtitle?: string
  recordId?: string | number
  backHref?: string
  backLabel?: string
  /** Workflow buttons shown on the left of the status bar row. */
  actionSlot?: ReactNode
  /** Extra controls in the control panel, next to Save/Discard. */
  toolbarAside?: ReactNode
  /** Smart buttons shown in the top-right corner of the sheet. */
  headerAside?: ReactNode
  ribbon?: RecordFormRibbon | null
  status?: string
  statusOptions?: RecordFormStatus[]
  onStatusChange?: (value: string) => void
  headerFields?: RecordFormField[]
  sections?: RecordFormSection[]
  tabs?: RecordFormTab[]
  onFieldChange?: (name: string, value: string) => void
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  /** When set, Save/Discard only appear while there are unsaved changes. */
  dirty?: boolean
  onDiscard?: () => void
  saving?: boolean
  saved?: boolean
  submitLabel?: string
  submittingLabel?: string
  chatter?: { model: ChatterModel; recordId: number; refreshKey?: number }
  /** Rendered after the form, outside the sheet (e.g. a printable layout). */
  children?: ReactNode
}

function displayValue(value: RecordFormValue | undefined) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function conditionMatches(condition: RecordFormCondition | undefined, values: RecordFormValues) {
  return typeof condition === 'function' ? condition(values) : condition === true
}

export function RecordFormView({
  modelName, title, subtitle, recordId, backHref, backLabel = 'Back', actionSlot,
  toolbarAside, headerAside, ribbon, status, statusOptions, onStatusChange, sections = [], onFieldChange,
  headerFields = [], tabs = [], onSubmit, dirty, onDiscard, saving = false, saved = false,
  submitLabel = 'Save', submittingLabel = 'Saving…', chatter, children,
}: RecordFormViewProps) {
  const formId = useId()
  const editable = Boolean(onSubmit)
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '')
  const currentTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0]?.id
  const allSections = [...sections, ...tabs.flatMap((tab) => tab.sections ?? [])]
  const allFields = [...headerFields, ...allSections.flatMap((section) => section.fields)]
  const values = Object.fromEntries(allFields.map((field) => [field.name, field.value ?? null]))
  const showSave = editable && (dirty === undefined || dirty)
  const visibleStatuses = statusOptions?.filter((option) => !option.folded || option.value === status) ?? []

  function renderField(field: RecordFormField) {
    const value = field.value ?? ''
    const fieldId = `${formId}-${field.name}`
    const readOnly = !editable || conditionMatches(field.readOnly, values) || Boolean(field.readOnlyWhen?.(values))
    const required = !readOnly && (conditionMatches(field.required, values) || Boolean(field.requiredWhen?.(values)))
    const shown = field.displayValue
      ?? (field.type === 'select' && value !== '' ? field.options?.find((option) => option.value === String(value))?.label : undefined)
      ?? (field.type === 'date' && field.value ? formatDualDate(String(field.value)) : displayValue(field.value))
    return (
      <div className={`o-field${field.fullWidth ? ' o-field--wide' : ''}${readOnly ? ' o-field--readonly' : ''}${required ? ' o-field--required' : ''}`} key={field.name}>
        <label className="o-field-label" htmlFor={field.render || readOnly ? undefined : fieldId}>{field.label}</label>
        <div className="o-field-widget">
          {field.render ?? (readOnly ? (
            <div className={`o-field-value${shown ? '' : ' is-empty'}`}>{shown || field.placeholder || '—'}</div>
          ) : field.type === 'textarea' ? (
            <textarea className="o-input" id={fieldId} value={String(value)} required={required} placeholder={field.placeholder} onChange={(event) => onFieldChange?.(field.name, event.target.value)} />
          ) : field.type === 'date' ? (
            <EthiopianDateInput id={fieldId} value={String(value ?? '')} required={required} onChange={(iso) => onFieldChange?.(field.name, iso)} />
          ) : field.type === 'select' ? (
            <select className="o-input" id={fieldId} value={String(value)} required={required} onChange={(event) => onFieldChange?.(field.name, event.target.value)}>
              {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : (
            <input className="o-input" id={fieldId} type={field.type ?? 'text'} value={String(value)} required={required} placeholder={field.placeholder} onChange={(event) => onFieldChange?.(field.name, event.target.value)} />
          ))}
          {field.helpText && <small className="o-field-help">{field.helpText}</small>}
        </div>
      </div>
    )
  }

  function renderSections(list: RecordFormSection[]) {
    return (
      <div className="o-groups">
        {list.map((section) => (
          <section className={`o-inner-group${section.fields.some((field) => field.fullWidth) && list.length === 1 ? ' o-inner-group--wide' : ''}`} key={section.title}>
            <div className="o-group-title">
              <h3>{section.title}</h3>
              {section.description && <p>{section.description}</p>}
            </div>
            {section.fields.map(renderField)}
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="o-form-view">
      <div className="o-control-panel">
        <div className="o-breadcrumb">
          {backHref && <Link to={backHref} className="o-breadcrumb-parent">{backLabel}</Link>}
          {backHref && <span className="o-breadcrumb-sep" aria-hidden="true">/</span>}
          <span className="o-breadcrumb-current">{title || 'New'}</span>
          {dirty && <span className="o-dirty-dot" title="Unsaved changes" aria-label="Unsaved changes" />}
        </div>
        <div className="o-cp-actions">
          {showSave && (
            <button type="submit" form={formId} disabled={saving} className="o-btn o-btn-primary">
              {saving ? submittingLabel : submitLabel}
            </button>
          )}
          {showSave && onDiscard && (
            <button type="button" onClick={onDiscard} disabled={saving} className="o-btn o-btn-secondary">Discard</button>
          )}
          {saved && !dirty && !saving && <span className="o-saved-hint" role="status">✓ Saved</span>}
          {toolbarAside}
          {recordId !== undefined && <span className="o-record-id">{modelName} #{recordId}</span>}
        </div>
      </div>

      <div className={`o-form-layout${chatter ? ' o-form-layout--chatter' : ''}`}>
        <form id={formId} className="o-form-main" onSubmit={onSubmit ?? ((event) => event.preventDefault())}>
          {(actionSlot || visibleStatuses.length > 0) && (
            <div className="o-form-statusbar">
              <div className="o-statusbar-buttons">{actionSlot}</div>
              {visibleStatuses.length > 0 && (
                <nav className="o-statusbar-status" aria-label={`${modelName} status`}>
                  {visibleStatuses.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-current={status === option.value ? 'step' : undefined}
                      className={status === option.value ? 'is-current' : ''}
                      disabled={!onStatusChange}
                      onClick={() => onStatusChange?.(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </nav>
              )}
            </div>
          )}

          <section className="o-form-sheet">
            {ribbon && <div className={`o-ribbon o-ribbon--${ribbon.tone ?? 'success'}`} aria-hidden="true"><span>{ribbon.label}</span></div>}
            {headerAside && <div className="o-button-box">{headerAside}</div>}

            <div className="o-title">
              <span className="o-title-model">{modelName}</span>
              <h1>{title || <span className="o-title-placeholder">New</span>}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>

            {headerFields.length > 0 && <div className="o-group-main">{headerFields.map(renderField)}</div>}

            {sections.length > 0 && renderSections(sections)}

            {tabs.length > 0 && (
              <div className="o-notebook">
                <div className="o-notebook-tabs" role="tablist" aria-label={`${modelName} details`}>
                  {tabs.map((tab) => (
                    <button key={tab.id} id={`${formId}-${tab.id}-tab`} type="button" role="tab" aria-selected={currentTab === tab.id} aria-controls={`${formId}-${tab.id}-panel`} className={currentTab === tab.id ? 'is-active' : ''} onClick={() => setActiveTab(tab.id)}>
                      {tab.label}
                      {tab.badge !== undefined && <span className="o-tab-badge">{tab.badge}</span>}
                    </button>
                  ))}
                </div>
                {tabs.filter((tab) => tab.id === currentTab).map((tab) => (
                  <div key={tab.id} id={`${formId}-${tab.id}-panel`} role="tabpanel" aria-labelledby={`${formId}-${tab.id}-tab`} className="o-notebook-page">
                    {tab.content}
                    {tab.sections && renderSections(tab.sections)}
                  </div>
                ))}
              </div>
            )}
          </section>
        </form>

        {chatter && <Chatter model={chatter.model} recordId={chatter.recordId} refreshKey={chatter.refreshKey} />}
      </div>
      {children}
    </div>
  )
}
