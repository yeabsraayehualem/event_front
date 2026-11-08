import { useEffect, useState, type FormEvent } from 'react'
import { HeroSection } from '../components/company-profile/HeroSection'
import { TraditionSection } from '../components/company-profile/TraditionSection'
import { PlanGrid } from '../components/company-profile/PlanGrid'
import { InquiryForm, type InquiryNotice } from '../components/company-profile/InquiryForm'
import { type InquiryError } from '../components/company-profile/InquiryForm'
import { ChurchYearSection } from '../components/company-profile/ChurchYearSection'
import { HadafeLockup } from '../components/HadafeLogo'
import { type Plan } from '../components/company-profile/types'
import { apiBaseUrl } from '@/lib/api'
import { useTranslation } from 'react-i18next'
import { LocaleSwitch } from '@/lib/i18n'

const FIELD_ERRORS: InquiryError[] = ['phone', 'name', 'plan_date', 'location', 'guest_count']

/** The API answers in English; map its field errors to a code the form shows in the visitor's language. */
function inquiryErrorFrom(result: unknown): InquiryError {
  if (result && typeof result === 'object') {
    const field = FIELD_ERRORS.find((key) => key in result)
    if (field) return field
  }
  return 'invalid'
}

export function CompanyProfilePage() {
  const { t } = useTranslation('website')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [selectedPackage, setSelectedPackage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<InquiryNotice | null>(null)



  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiBaseUrl}/website/plans/`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('load')
        return res.json()
      })
      .then((result) => {
        const raw = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : []
        const catalog = raw.map((plan: Plan) => ({
          ...plan,
          packages: Array.isArray(plan.packages)
            ? plan.packages.map((pkg) => ({
                ...pkg,
                contents: Array.isArray(pkg.contents) ? pkg.contents : [],
              }))
            : [],
        })) as Plan[]
        setPlans(catalog)
        if (catalog.length) setSelectedPlan(String(catalog[0].id))
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') setLoadError('load')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  function resetNotice() {
    setNotice(null)
  }

  function startInquiry(planId?: number, packageId?: number) {
    if (planId) setSelectedPlan(String(planId))
    setSelectedPackage(packageId ? String(packageId) : '')
    setNotice(null)
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setNotice(null)
    const form = new FormData(formElement)
    // The API has no dedicated catering field yet, so the menu choice travels as a requirement.
    const menu = String(form.get('menu') ?? '').trim()
    const eventType = String(form.get('event_type') ?? '').trim()
    const guestCount = String(form.get('guest_count') ?? '').trim()
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      plan: Number(form.get('plan')),
      package: form.get('package') ? Number(form.get('package')) : null,
      plan_date: String(form.get('plan_date') ?? ''),
      location: String(form.get('location') ?? '').trim(),
      notes: String(form.get('notes') ?? '').trim(),
      event_type: eventType ? Number(eventType) : null,
      guest_count: guestCount ? Number(guestCount) : null,
      budget_tier: String(form.get('budget_tier') ?? '').trim(),
      requirements: menu ? `Catering: ${menu}` : '',
    }
    setSubmitting(true)
    try {
      let res: Response
      try {
        res = await fetch(`${apiBaseUrl}/website/public/leads/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch {
        setNotice({ kind: 'error', error: 'network' })
        return
      }
      if (!res.ok) {
        const result: unknown = await res.json().catch(() => null)
        setNotice({ kind: 'error', error: inquiryErrorFrom(result) })
        return
      }
      formElement.reset()
      setSelectedPackage('')
      setNotice({
        kind: 'success',
        customerName: payload.name.split(/\s+/)[0],
        planName: plans.find((plan) => plan.id === payload.plan)?.name,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="profile-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="site-header">
        <a className="brand" href="#top" aria-label={t('header.home')}><HadafeLockup size={56} /></a>
        <nav className="site-nav" aria-label={t('header.navLabel')}>
          <a href="#story">{t('header.tradition')}</a>
          <a href="#experiences">{t('header.celebrations')}</a>
          <a href="#church-year">{t('header.churchYear')}</a>
          <a href="#contact">{t('header.startPlanning')}</a>
        </nav>
        <div className="header-end">
          <LocaleSwitch className="locale-switch--header" />
          <a className="header-cta" href="#contact">{t('header.cta')} <span>↗</span></a>
        </div>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <HeroSection />

        {/* ── Tradition + Ritual ─────────────────────────────────── */}
        <TraditionSection />

        {/* ── Experiences / Plans ────────────────────────────────── */}
        <section id="experiences" className="experience-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('experiences.eyebrow')}</p>
              <h2>{t('experiences.title')}<br /><i>{t('experiences.titleAccent')}</i></h2>
            </div>
            <p>{t('experiences.body')}</p>
          </div>

          {loading && (
            <div className="catalog-message">{t('experiences.loading')}</div>
          )}
          {!loading && loadError && (
            <div className="catalog-message catalog-error">
              {t('experiences.loadError')}
            </div>
          )}
          {!loading && !loadError && plans.length === 0 && (
            <div className="catalog-message">{t('experiences.empty')}</div>
          )}

          {!loading && plans.length > 0 && (
            <PlanGrid plans={plans} onEnquire={startInquiry} />
          )}
        </section>

        {/* ── Church year ────────────────────────────────────────── */}
        <ChurchYearSection />

        {/* ── Contact / Inquiry ──────────────────────────────────── */}
        <InquiryForm
          plans={plans}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          selectedPackage={selectedPackage}
          setSelectedPackage={setSelectedPackage}
          catalogLoading={loading}
          submitting={submitting}
          notice={notice}
          onSubmit={submitInquiry}
          onReset={resetNotice}
        />
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="site-footer">
        <a className="brand footer-brand" href="#top"><HadafeLockup size={42} onDark /></a>
        <p>{t('footer.tagline')}</p>
        <a className="staff-login" href="/login">{t('footer.staffLogin')} ↗</a>
        <span>{t('footer.copyright')}</span>
      </footer>
    </div>
  )
}
