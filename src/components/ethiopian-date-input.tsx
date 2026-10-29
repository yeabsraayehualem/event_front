import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  ETHIOPIAN_MONTHS,
  addDays,
  churchYear,
  formatGregorian,
  fromEthiopian,
  parseIsoDate,
  toEthiopian,
  todayUtc,
  type EthiopianDate,
} from '@/lib/ethiopian-calendar'

/** Ethiopian weekday names, Monday first. */
const WEEKDAYS = [
  { am: 'ሰኞ', en: 'Mon' },
  { am: 'ማክ', en: 'Tue' },
  { am: 'ረቡ', en: 'Wed' },
  { am: 'ሐሙ', en: 'Thu' },
  { am: 'ዓር', en: 'Fri' },
  { am: 'ቅዳ', en: 'Sat' },
  { am: 'እሑ', en: 'Sun' },
]

const toIso = (d: Date) => d.toISOString().slice(0, 10)
const POP_WIDTH = 300
const POP_GAP = 6
const VIEWPORT_MARGIN = 8

function daysInMonth(year: number, month: number) {
  if (month < 13) return 30
  return year % 4 === 3 ? 6 : 5
}

type Props = {
  /** Gregorian ISO date (yyyy-mm-dd) or empty string. */
  value: string
  onChange: (iso: string) => void
  name?: string
  id?: string
  required?: boolean
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  'aria-label'?: string
  /** Mark feast and fast days in the grid (on by default). */
  showChurchDays?: boolean
}

export function EthiopianDateInput({
  value,
  onChange,
  name,
  id,
  required,
  min,
  max,
  disabled,
  placeholder = 'Choose a date',
  className,
  showChurchDays = true,
  ...rest
}: Props) {
  const autoId = useId()
  const triggerId = id ?? `etdp-${autoId}`
  const selected = parseIsoDate(value)
  const today = useMemo(() => todayUtc(), [])
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const et = toEthiopian(selected ?? today)
    return { year: et.year, month: et.month }
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [popStyle, setPopStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const minDate = min ? parseIsoDate(min) : null
  const maxDate = max ? parseIsoDate(max) : null

  // When the popover opens, start on the month of the current value.
  function toggle() {
    if (!open) {
      const et = toEthiopian(selected ?? today)
      setView({ year: et.year, month: et.month })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // The popover is portalled to <body> so scrolling tables and cards with
  // overflow clipping can't cut it off; keep it pinned to the trigger.
  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const popHeight = popRef.current?.offsetHeight ?? 0
      const width = Math.min(POP_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN))
      const fitsBelow = rect.bottom + POP_GAP + popHeight <= window.innerHeight - VIEWPORT_MARGIN
      const fitsAbove = rect.top - POP_GAP - popHeight >= VIEWPORT_MARGIN
      const top = fitsBelow || !fitsAbove
        ? rect.bottom + POP_GAP
        : rect.top - POP_GAP - popHeight
      setPopStyle({ top, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, view])

  const churchDays = useMemo(() => {
    if (!showChurchDays) return new Map<string, 'feast' | 'fast'>()
    const map = new Map<string, 'feast' | 'fast'>()
    for (const p of churchYear(view.year)) {
      for (let d = p.start; d <= p.end; d = addDays(d, 1)) {
        const key = toIso(d)
        if (p.kind === 'feast' || !map.has(key)) map.set(key, p.kind)
      }
    }
    return map
  }, [view.year, showChurchDays])

  const first = fromEthiopian({ year: view.year, month: view.month, day: 1 })
  const leading = (first.getUTCDay() + 6) % 7 // Monday-first offset
  const count = daysInMonth(view.year, view.month)

  function step(delta: number) {
    setView(({ year, month }) => {
      let m = month + delta
      let y = year
      if (m < 1) { m = 13; y -= 1 }
      if (m > 13) { m = 1; y += 1 }
      return { year: y, month: m }
    })
  }

  function pick(et: EthiopianDate) {
    onChange(toIso(fromEthiopian(et)))
    setOpen(false)
    triggerRef.current?.focus()
  }

  const outOfRange = (d: Date) => (minDate && d < minDate) || (maxDate && d > maxDate)
  const selectedEt = selected ? toEthiopian(selected) : null

  return (
    <div className="etdp" ref={rootRef}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={`etdp-trigger ${className ?? ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={rest['aria-label']}
      >
        {selected ? (
          <span className="etdp-value">
            <span lang="am">{ETHIOPIAN_MONTHS[selectedEt!.month - 1].am} {selectedEt!.day}፣ {selectedEt!.year}</span>
            <small>{formatGregorian(selected)}</small>
          </span>
        ) : (
          <span className="etdp-placeholder">{placeholder}</span>
        )}
        <svg className="etdp-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      </button>

      {/* Keeps the value in native form submissions and required-field validation. */}
      <input
        className="etdp-native"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value}
        required={required}
        onChange={() => {}}
        onInvalid={() => triggerRef.current?.focus()}
      />

      {open && createPortal(
        <div className="etdp-pop" role="dialog" aria-label="Choose a date" ref={popRef} style={popStyle}>
          <div className="etdp-head">
            <button type="button" className="etdp-nav" onClick={() => step(-1)} aria-label="Previous month">‹</button>
            <div className="etdp-title">
              <strong lang="am">{ETHIOPIAN_MONTHS[view.month - 1].am} {view.year}</strong>
              <span>{ETHIOPIAN_MONTHS[view.month - 1].en} {view.year} E.C.</span>
            </div>
            <button type="button" className="etdp-nav" onClick={() => step(1)} aria-label="Next month">›</button>
          </div>

          <div className="etdp-grid" role="grid">
            {WEEKDAYS.map((w) => (
              <span key={w.en} className="etdp-dow" title={w.en} lang="am">{w.am}</span>
            ))}
            {Array.from({ length: leading }, (_, i) => <span key={`pad-${i}`} />)}
            {Array.from({ length: count }, (_, i) => {
              const day = i + 1
              const greg = fromEthiopian({ year: view.year, month: view.month, day })
              const iso = toIso(greg)
              const isSelected = iso === value
              const isToday = iso === toIso(today)
              const kind = churchDays.get(iso)
              const disabledDay = Boolean(outOfRange(greg))
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    'etdp-day',
                    isSelected && 'is-selected',
                    isToday && 'is-today',
                    kind && `is-${kind}`,
                  ].filter(Boolean).join(' ')}
                  disabled={disabledDay}
                  onClick={() => pick({ year: view.year, month: view.month, day })}
                  aria-label={`${ETHIOPIAN_MONTHS[view.month - 1].en} ${day}, ${view.year} E.C. (${formatGregorian(greg)})${kind ? `, ${kind} day` : ''}`}
                  aria-pressed={isSelected}
                >
                  <span>{day}</span>
                  <small>{greg.getUTCDate()}</small>
                </button>
              )
            })}
          </div>

          <div className="etdp-foot">
            {showChurchDays && (
              <span className="etdp-legend">
                <i className="is-feast" /> Feast <i className="is-fast" /> Fast
              </span>
            )}
            <span className="etdp-actions">
              {!required && value && (
                <button type="button" onClick={() => { onChange(''); setOpen(false) }}>Clear</button>
              )}
              <button
                type="button"
                onClick={() => {
                  const et = toEthiopian(today)
                  if (outOfRange(today)) setView({ year: et.year, month: et.month })
                  else pick(et)
                }}
              >
                Today
              </button>
            </span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
