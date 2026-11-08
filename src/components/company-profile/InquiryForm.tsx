import { useMemo, useState, type FormEvent } from 'react'
import { type Plan } from './types'
import { EthiopianCross } from './EthiopianCross'
import { guidanceFor, parseIsoDate, todayUtc } from '@/lib/ethiopian-calendar'
import { EthiopianDateInput } from '@/components/ethiopian-date-input'
import { BUDGET_TIERS } from '@/lib/event-options'
import { LocaleSwitch } from '@/lib/i18n'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

/** Why a submission failed; shown to the visitor in their language. */
export type InquiryError = 'network' | 'invalid' | 'phone' | 'name' | 'plan_date' | 'location' | 'guest_count'

/**
 * Values sent to the API stay in English so staff read leads the same way
 * whatever language the visitor used; only the labels are translated.
 */
const CATERING = [
  { value: 'Fasting (yetsom) menu', key: 'fasting' },
  { value: 'Non-fasting (yefisik) menu', key: 'nonFasting' },
  { value: 'Both fasting and non-fasting', key: 'both' },
  { value: 'No catering needed', key: 'none' },
] as const

export type InquiryNotice =
  | { kind: 'success'; customerName?: string; planName?: string }
  | { kind: 'error'; error: InquiryError }

function DateGuidanceNote({ date, occasion: label, t, amharic }: {
  date: string
  occasion: string
  t: TFunction<'inquiry'>
  amharic: boolean
}) {
  const day = parseIsoDate(date)
  if (!day) return null
  const g = guidanceFor(day)
  // Plan and occasion names are managed in the catalog, so match them loosely.
  const occasion = label.toLowerCase()
  const isTeklil = occasion.includes('teklil') || occasion.includes('church wedding')
  const isWedding = isTeklil || /wedd?ing|serg/.test(occasion)
  const fast = g.periods.find((p) => p.kind === 'fast')
  const feast = g.periods.find((p) => p.kind === 'feast')
  const periodName = (p: { name: string; am: string }) => (amharic ? p.am : `${p.name} (${p.am})`)
  const notes: { tone: 'warn' | 'info'; text: string }[] = []

  if (fast && isTeklil) {
    notes.push({ tone: 'warn', text: t('guidance.teklilInFast', { fast: periodName(fast) }) })
  } else if (fast && isWedding) {
    notes.push({ tone: 'warn', text: t('guidance.weddingInFast', { fast: periodName(fast) }) })
  } else if (fast) {
    notes.push({ tone: 'info', text: t('guidance.inFast', { fast: periodName(fast) }) })
  } else if (g.weeklyFast) {
    notes.push({ tone: 'info', text: t('guidance.weeklyFast') })
  }
  if (feast) {
    notes.push({ tone: 'info', text: t('guidance.feast', { feast: periodName(feast) }) })
  }
  if (/kir?i?st(i)?na|kerstna|christening|baptism/.test(occasion)) {
    notes.push({ tone: 'info', text: t('guidance.christening') })
  }
  if (occasion.includes('tezkar') || occasion.includes('memorial')) {
    notes.push({ tone: 'info', text: t('guidance.memorial') })
  }

  return (
    <div className="date-guidance" aria-live="polite">
      <p className="date-guidance-et">
        <EthiopianCross size={14} />
        <span lang="am">{g.ethiopianAm}</span>
        {!amharic && <span>· {g.ethiopian}</span>}
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
  catalogLoading: boolean
  submitting: boolean
  notice: InquiryNotice | null
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onReset: () => void
}

export function InquiryForm({
  plans,
  selectedPlan,
  setSelectedPlan,
  selectedPackage,
  setSelectedPackage,
  catalogLoading,
  submitting,
  notice,
  onSubmit,
  onReset,
}: InquiryFormProps) {
  const { t, i18n } = useTranslation('inquiry')
  const locale = i18n.language === 'en' ? 'en' : 'am'
  const amharic = locale === 'am'

  const activePlan = useMemo(
    () => plans.find((p) => String(p.id) === selectedPlan),
    [plans, selectedPlan],
  )

  const availablePackages = activePlan?.packages ?? []
  const availableEventTypes = activePlan?.event_types ?? []
  const [eventDate, setEventDate] = useState('')
  const [eventType, setEventType] = useState('')
  const minDate = useMemo(() => todayUtc().toISOString().slice(0, 10), [])
  // A plan with a single occasion needs no choice, so it is picked for the guest.
  const chosenEventType =
    eventType || (availableEventTypes.length === 1 ? String(availableEventTypes[0].id) : '')

  function startOver() {
    setEventDate('')
    setEventType('')
    onReset()
  }

  function handlePlanChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedPlan(e.target.value)
    setSelectedPackage('')
    setEventType('')
  }

  const optional = <span className="optional">{t('optional')}</span>

  // ── Success card ─────────────────────────────────────────────
  if (notice?.kind === 'success') {
    return (
      <section id="contact" className="contact-section contact-section--success" lang={locale}>
        <div className="success-card" role="status" aria-live="polite">
          <span className="success-spark success-spark--one" aria-hidden="true">✦</span>
          <span className="success-spark success-spark--two" aria-hidden="true">✧</span>
          <div className="success-emblem" aria-hidden="true">
            <span className="success-check">✓</span>
            <svg className="success-ring" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="56" stroke="#bd9a57" strokeWidth="1.2" strokeDasharray="4 6" />
            </svg>
          </div>
          <p className="success-eyebrow">✦ &nbsp; {t('success.eyebrow')} &nbsp; ✦</p>
          <h2 className="success-heading">
            {notice.customerName ? t('success.greetingNamed', { name: notice.customerName }) : t('success.greeting')}<br />
            <i>{t('success.accent')}</i>
          </h2>
          <p className="success-body">{t('success.body')}</p>
          {notice.planName && <div className="success-plan"><span>{t('success.planLabel')}</span><strong>{notice.planName}</strong></div>}
          <div className="success-next-steps">
            <div><span>01</span><p><strong>{t('success.step1.title')}</strong><small>{t('success.step1.text')}</small></p></div>
            <div><span>02</span><p><strong>{t('success.step2.title')}</strong><small>{t('success.step2.text')}</small></p></div>
          </div>
          <div className="success-actions">
            <a className="success-reset" href="#experiences">{t('success.explore')} <span>↗</span></a>
            <button className="success-secondary" type="button" onClick={startOver}>{t('success.again')}</button>
          </div>
        </div>
      </section>
    )
  }

  // ── Inquiry form ──────────────────────────────────────────────
  const planReady = plans.length > 0
  const occasionName = availableEventTypes.find((type) => String(type.id) === chosenEventType)?.name ?? ''

  return (
    <section id="contact" className="contact-section" lang={locale}>
      <div className="contact-copy">
        <p className="eyebrow">{t('copy.eyebrow')}</p>
        <h2>{t('copy.title')}<br /><i>{t('copy.titleAccent')}</i></h2>
        <p>{t('copy.body')}</p>
        <div className="contact-detail">
          <span className="contact-icon"><EthiopianCross size={22} /></span>
          <div>
            <small>{t('copy.occasions')}</small>
            <a href="#contact-form">{t('copy.jump')} ↗</a>
          </div>
        </div>
      </div>

      <form id="contact-form" className="inquiry-form" onSubmit={onSubmit}>
        <div className="form-heading">
          <div className="form-heading-text">
            <span>{t('heading.meta')}</span>
            <p>{t('heading.title')}</p>
          </div>
          <LocaleSwitch />
        </div>

        <fieldset className="web-form-step" disabled={!planReady}>
          <legend><span>01</span>{t('step1.title')}<small>{t('step1.hint')}</small></legend>
          <div className="form-grid">
            <label className={availableEventTypes.length > 0 ? undefined : 'form-wide'}>
              {t('plan')}
              <select name="plan" value={selectedPlan} onChange={handlePlanChange} required>
                {!planReady && <option value="">{catalogLoading ? t('planLoading') : t('planNone')}</option>}
                {plans.map((plan) => (
                  <option key={plan.id} value={String(plan.id)}>{plan.name}</option>
                ))}
              </select>
            </label>

            {/* Each plan lists its own occasions; a plan without any skips the question. */}
            {availableEventTypes.length > 0 && (
              <label>
                {t('occasion')}
                <select
                  name="event_type"
                  required
                  value={chosenEventType}
                  onChange={(e) => setEventType(e.target.value)}
                >
                  {availableEventTypes.length > 1 && <option value="" disabled>{t('occasionPlaceholder')}</option>}
                  {availableEventTypes.map((type) => (
                    <option key={type.id} value={String(type.id)}>{type.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label>
              {t('date')}
              <EthiopianDateInput
                name="plan_date"
                required
                value={eventDate}
                onChange={setEventDate}
                min={minDate}
                placeholder={t('datePlaceholder')}
              />
            </label>

            <label>
              {t('guests')} {optional}
              <input name="guest_count" type="number" inputMode="numeric" min="1" max="10000" step="1" placeholder={t('guestsPlaceholder')} />
            </label>

            {eventDate && (
              <div className="form-wide">
                <DateGuidanceNote
                  date={eventDate}
                  occasion={`${activePlan?.name ?? ''} ${occasionName}`}
                  t={t}
                  amharic={amharic}
                />
              </div>
            )}

            <label className="form-wide">
              {t('location')}
              <input name="location" maxLength={255} placeholder={t('locationPlaceholder')} required />
            </label>
          </div>
        </fieldset>

        <fieldset className="web-form-step" disabled={!planReady}>
          <legend><span>02</span>{t('step2.title')}<small>{t('step2.hint')}</small></legend>
          <div className="form-grid">
            {availablePackages.length > 0 && (
              <label className="form-wide">
                {t('package')} {optional}
                <select name="package" value={selectedPackage} onChange={(e) => setSelectedPackage(e.target.value)}>
                  <option value="">{t('packageNone')}</option>
                  {availablePackages.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label>
              {t('catering')} {optional}
              <select name="menu" defaultValue="">
                <option value="">{t('cateringNone')}</option>
                {CATERING.map((item) => (
                  <option key={item.value} value={item.value}>{t(`cateringOptions.${item.key}`)}</option>
                ))}
              </select>
            </label>

            <label>
              {t('budget')} {optional}
              <select name="budget_tier" defaultValue="">
                <option value="">{t('budgetNone')}</option>
                {BUDGET_TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>{t(`budgetTiers.${tier.key}`, { ns: 'common' })}</option>
                ))}
              </select>
            </label>

            <label className="form-wide">
              {t('notes')} {optional}
              <textarea name="notes" rows={4} placeholder={t('notesPlaceholder')} />
            </label>
          </div>
        </fieldset>

        <fieldset className="web-form-step" disabled={!planReady}>
          <legend><span>03</span>{t('step3.title')}<small>{t('step3.hint')}</small></legend>
          <div className="form-grid">
            <label>
              {t('name')}
              <input name="name" autoComplete="name" maxLength={255} placeholder={t('namePlaceholder')} required />
            </label>
            <label>
              {t('phone')}
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t('phonePlaceholder')}
                pattern="\+?[0-9][0-9\s\-]{7,18}"
                title={t('phoneHint')}
                required
              />
            </label>
          </div>
        </fieldset>

        {!planReady && !catalogLoading && (
          <p className="form-notice error" role="alert">{t('unavailable')}</p>
        )}

        {notice?.kind === 'error' && (
          <p className="form-notice error" role="alert">{t(`errors.${notice.error}`)}</p>
        )}

        <button
          className="button button-dark submit-button"
          type="submit"
          disabled={submitting || !planReady}
        >
          {submitting ? t('submitting') : t('submit')} <span>↗</span>
        </button>
        <p className="form-privacy">{t('privacy')}</p>
      </form>
    </section>
  )
}
