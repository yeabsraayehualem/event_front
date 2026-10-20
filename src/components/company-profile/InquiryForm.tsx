import { useMemo, type FormEvent } from 'react'
import { type Plan } from './types'

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
            <button className="success-secondary" type="button" onClick={onReset}>Send another inquiry</button>
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
          Share the date, the occasion, and what your family has in mind. Our team will be
          in touch to plan the next steps with you.
        </p>
        <div className="contact-detail">
          <span className="contact-icon">✥</span>
          <div>
            <small>Planning Orthodox weddings, christenings, and family milestones</small>
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
            Event type
            <select name="event_type" required defaultValue="">
              <option value="" disabled>Select an occasion</option>
              <option>Orthodox wedding</option>
              <option>Engagement</option>
              <option>Christening</option>
              <option>Family celebration</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Package
            {availablePackages.length > 0 && (
              <span className="pkg-count-hint">✥ {availablePackages.length} available</span>
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
            Event date
            <input name="plan_date" type="date" required />
          </label>
          <label>
            Event location
            <input name="location" placeholder="City or venue" required />
          </label>
          <label>
            Estimated guests <span className="optional">OPTIONAL</span>
            <input name="guest_count" type="number" min="1" placeholder="e.g. 150" />
          </label>
          <label>
            Budget range <span className="optional">OPTIONAL</span>
            <select name="budget_tier" defaultValue="">
              <option value="">We are still deciding</option>
              <option>Under ETB 100,000</option>
              <option>ETB 100,000–300,000</option>
              <option>ETB 300,000–600,000</option>
              <option>Over ETB 600,000</option>
            </select>
          </label>
          <label className="form-wide">
            Requirements or traditions to include <span className="optional">OPTIONAL</span>
            <textarea name="requirements" rows={3} placeholder="Share important details, customs, or accessibility needs." />
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

