type Option = { id: number; label: string }

type Many2ManyTagsProps = {
  options: Option[]
  value: number[]
  onChange: (ids: number[]) => void
  placeholder?: string
  'aria-label'?: string
}

/** Odoo-style many2many tags: chosen records as removable chips, plus a picker for the rest. */
export function Many2ManyTags({ options, value, onChange, placeholder = 'Add…', 'aria-label': ariaLabel }: Many2ManyTagsProps) {
  const selected = value.map((id) => options.find((option) => option.id === id)).filter((option): option is Option => Boolean(option))
  const remaining = options.filter((option) => !value.includes(option.id))

  return (
    <div className="o-m2m-tags">
      {selected.map((option) => (
        <span key={option.id} className="o-tag">
          {option.label}
          <button type="button" aria-label={`Remove ${option.label}`} onClick={() => onChange(value.filter((id) => id !== option.id))}>×</button>
        </span>
      ))}
      {remaining.length > 0 && (
        <select
          className={`o-m2m-picker${selected.length ? ' is-compact' : ''}`}
          aria-label={ariaLabel}
          value=""
          onChange={(event) => { if (event.target.value) onChange([...value, Number(event.target.value)]) }}
        >
          <option value="">{selected.length ? '+' : placeholder}</option>
          {remaining.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      )}
    </div>
  )
}
