import { useMemo, useState, type FormEvent } from 'react'
import { type Plan } from './types'
import { EthiopianCross } from './EthiopianCross'
import { guidanceFor, parseIsoDate, todayUtc } from '@/lib/ethiopian-calendar'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { BUDGET_TIERS, EVENT_TYPES } from '@/lib/event-options'


function DateGuidanceNote({ date, eventType }: { date: string; eventType: string }) {
  const day = parseIsoDate(date)
  if (!day) return null
  const g = guidanceFor(day)
  const isTeklil = eventType.startsWith('Church wedding')
  const isWedding = isTeklil || eventType.startsWith('Wedding')
  const fast = g.periods.find((p) => p.kind === 'fast')
  const feast = g.periods.find((p) => p.kind === 'feast')
  const notes: { tone: 'warn' | 'info'; text: string }[] = []

  if (fast && isTeklil) {
    notes.push({ tone: 'warn', text: `This date falls in ${fast.name} (${fast.am}). Church weddings are not held during the fast, so we suggest choosing another date or speaking with your parish.` })
  } else if (fast && isWedding) {
    notes.push({ tone: 'warn', text: `This date falls in ${fast.name} (${fast.am}). Many families avoid wedding celebrations during the fast; we can plan a fasting (yetsom) menu if you go ahead.` })
  } else if (fast) {
    notes.push({ tone: 'info', text: `This date falls in ${fast.name} (${fast.am}). We will plan a fasting (yetsom) menu for guests who keep the fast.` })
  } else if (g.weeklyFast) {
    notes.push({ tone: 'info', text: 'This is a Wednesday or Friday fast day. We will include fasting (yetsom) dishes for guests who keep it.' })
  }
  if (feast) {
    notes.push({ tone: 'info', text: `${feast.name} (${feast.am}) falls on this date. Venues, crews and church schedules are busy around feasts, so it helps to book early.` })
  }
  if (eventType.startsWith('Kiristina')) {
    notes.push({ tone: 'info', text: 'Christening is traditionally on the 40th day for a boy and the 80th day for a girl. We will confirm the day with your church.' })
  }
  if (eventType.startsWith('Tezkar')) {
    notes.push({ tone: 'info', text: 'We will keep the gathering quiet and respectful, with no entertainment unless your family asks for it.' })
  }

  return (
    <div className="date-guidance" aria-live="polite">
      <p className="date-guidance-et">
        <EthiopianCross size={14} />
        <span lang="am">{g.ethiopianAm}</span>
        <span>· {g.ethiopian}</span>
      </p>
      {notes.map((n) => (
        <p key={n.text} className={`date-guidance-note date-guidance-note--${n.tone}`}>{n.text}</p>
      ))}
    </div>
  )
}

interface InquiryFormProps {
  plans: Plan[]
  selectedPlan: string
  setSelectedPlan: (id: string) => void
  selectedPackage: string
  setSelectedPackage: (id: string) => void
  submitting: boolean
  notice: { kind: 'success' | 'error'; text: string; customerName?: string; planName?: string } | null
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onReset: () => void
}

export function InquiryForm({
  plans,
  selectedPlan,
  setSelectedPlan,
  selectedPackage,
  setSelectedPackage,
  submitting,
  notice,
  onSubmit,
  onReset,
}: InquiryFormProps) {
  const activePlan = useMemo(
    () => plans.find((p) => String(p.id) === selectedPlan),
    [plans, selectedPlan],
  )

  const availablePackages = activePlan?.packages ?? []
  const [eventDate, setEventDate] = useState('')
  const [eventType, setEventType] = useState('')
  const minDate = useMemo(() => todayUtc().toISOString().slice(0, 10), [])

  function startOver() {
    setEventDate('')
    setEventType('')
    onReset()
  }

  function handlePlanChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedPlan(e.target.value)
    setSelectedPackage('')
  }

  // ── Success card ─────────────────────────────────────────────
  if (notice?.kind === 'success') {
    return (
      <section id="contact" className="contact-section contact-section--success">
        <div className="success-card" role="status" aria-live="polite">
          <span className="success-spark success-spark--one" aria-hidden="true">✦</span>
          <span className="success-spark success-spark--two" aria-hidden="true">✧</span>
          <div className="success-emblem" aria-hidden="true">
            <span className="success-check">✓</span>
            <svg className="success-ring" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="56" stroke="#bd9a57" strokeWidth="1.2" strokeDasharray="4 6" />
            </svg>
          </div>
          <p className="success-eyebrow">✦ &nbsp; YOUR INQUIRY IS WITH OUR TEAM &nbsp; ✦</p>
          <h2 className="success-heading">
            {notice.customerName ? `Wonderful, ${notice.customerName}!` : 'Wonderful news!'}<br />
            <i>Your celebration starts here.</i>
          </h2>
          <p className="success-body">{notice.text}</p>
          {notice.planName && <div className="success-plan"><span>THE CELEBRATION</span><strong>{notice.planName}</strong></div>}
          <div className="success-next-steps">
            <div><span>01</span><p><strong>We’ll be in touch</strong><small>Our team will reach out to hear more about your plans.</small></p></div>
            <div><span>02</span><p><strong>We’ll shape it together</strong><small>We’ll help bring your family’s celebration to life.</small></p></div>
          </div>
          <div className="success-actions">
            <a className="success-reset" href="#experiences">Explore celebrations <span>↗</span></a>
            <button className="success-secondary" type="button" onClick={startOver}>Send another inquiry</button>
          </div>
        </div>
      </section>
    )
  }

  // ── Inquiry form ──────────────────────────────────────────────
  return (
    <section id="contact" className="contact-section">
      <div className="contact-copy">
        <p className="eyebrow">Let&apos;s begin together</p>
        <h2>Tell us about<br /><i>your celebration.</i></h2>
        <p>
          Share the date, the occasion, and what your family has in mind. We show the date in
          the Ethiopian calendar and let you know if it falls in a fast or on a feast day.
        </p>
        <div className="contact-detail">
          <span className="contact-icon"><EthiopianCross size={22} /></span>
          <div>
            <small>Weddings, Kiristina, Tezkar, Mahber and holiday gatherings</small>
            <a href="#contact-form">Share your celebration details ↗</a>
          </div>
        </div>
      </div>

      <form id="contact-form" className="inquiry-form" onSubmit={onSubmit}>
        <div className="form-heading">
          <span>01 — 04</span>
          <p>Let&apos;s begin with the basics.</p>
        </div>
        <div className="form-grid">
          <label>
            Your name
            <input name="name" autoComplete="name" placeholder="Full name" required />
          </label>
          <label>
            Phone number
            <input name="phone" autoComplete="tel" placeholder="+251 …" required />
          </label>
          <label className="form-wide">
            Email address
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </label>

          <label>
            Celebration
            <select name="plan" value={selectedPlan} onChange={handlePlanChange} required>
              {plans.length === 0 && <option value="">Tell us about your event</option>}
              {plans.map((plan) => (
                <option key={plan.id} value={String(plan.id)}>{plan.name}</option>
              ))}
            </select>
          </label>


          <label>
            Package
            {availablePackages.length > 0 && (
              <span className="pkg-count-hint">{availablePackages.length} available</span>
            )}
            <select
              name="package"
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              disabled={availablePackages.length === 0}
            >
              <option value="">
                {availablePackages.length === 0 ? 'No packages for this plan' : "I'm not sure yet"}
              </option>
              {availablePackages.map((item) => (
                <option key={item.id} value={String(item.id)}>{item.name}</option>
              ))}
            </select>
          </label>


          <label>
            Event type
            <select name="event_type" required value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="" disabled>Select an occasion</option>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>


          <label>
            Event date
            <EthiopianDateInput name="plan_date" required value={eventDate} onChange={setEventDate} min={minDate} placeholder="Choose Date" />
          </label>

          {eventDate && (
            <div className="form-wide">
              <DateGuidanceNote date={eventDate} eventType={eventType} />
            </div>
          )}

          <label>
            Event location
            <input name="location" placeholder="City or venue" required />
          </label>

          <label>
            Estimated guests <span className="optional">OPTIONAL</span>
            <input name="guest_count" type="number" min="1" placeholder="e.g. 150" />
          </label>

          <label>
            Menu <span className="optional">OPTIONAL</span>
            <select name="menu" defaultValue="">
              <option value="">Help us decide</option>
              <option>Fasting (yetsom) only</option>
              <option>Fasting and non-fasting</option>
              <option>Non-fasting (yefisik)</option>
              <option>No catering needed</option>
            </select>
          </label>

          <label>
            Meat for guests <span className="optional">OPTIONAL</span>
            <select name="meat" defaultValue="">
              <option value="">Not sure yet</option>
              <option>Christian slaughter</option>
              <option>Halal</option>
              <option>Both, prepared separately</option>
              <option>No meat</option>
            </select>
          </label>

          <label className="form-wide">
            Budget range <span className="optional">OPTIONAL</span>
            <select name="budget_tier" defaultValue="">
              <option value="">We are still deciding</option>
              {BUDGET_TIERS.map((tier) => <option key={tier}>{tier}</option>)}
            </select>
          </label>
          <label className="form-wide">
            Requirements or traditions to include <span className="optional">OPTIONAL</span>
            <textarea name="requirements" rows={3} placeholder="Your parish, family customs, coffee ceremony, accessibility needs…" />
          </label>
          <label className="form-wide">
            A little more about your plans <span className="optional">OPTIONAL</span>
            <textarea name="notes" rows={3} placeholder="What are you celebrating? What should we know?" />
          </label>
        </div>

        {notice?.kind === 'error' && (
          <p className="form-notice error" role="alert">{notice.text}</p>
        )}

        <button
          className="button button-dark submit-button"
          type="submit"
          disabled={submitting || plans.length === 0}
        >
          {submitting ? 'Sending your note…' : 'Send an inquiry'} <span>↗</span>
        </button>
        <p className="form-privacy">
          By submitting, you agree that our team may contact you about your event.
        </p>
      </form>
    </section>
  )
}

