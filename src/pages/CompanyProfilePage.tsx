import { useEffect, useState, type FormEvent } from 'react'
import { HeroSection } from '../components/company-profile/HeroSection'
import { TraditionSection } from '../components/company-profile/TraditionSection'
import { PlanShowcase } from '../components/company-profile/PlanShowcase'
import { InquiryForm } from '../components/company-profile/InquiryForm'
import { ChurchYearSection } from '../components/company-profile/ChurchYearSection'
import { EthiopianCross } from '../components/company-profile/EthiopianCross'
import { SiteHeader } from '../components/company-profile/SiteHeader'
import { HowItWorks } from '../components/company-profile/HowItWorks'
import { Showcase } from '../components/company-profile/Showcase'
import { SiteFooter } from '../components/company-profile/SiteFooter'
import '../styles/website.css'
import { type Plan } from '../components/company-profile/types'
import { apiBaseUrl } from '@/lib/api'

export function CompanyProfilePage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('')
  const [selectedPackage, setSelectedPackage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{
    kind: 'success' | 'error'
    text: string
    customerName?: string
    planName?: string
  } | null>(null)



  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiBaseUrl}/website/plans/`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('We could not load the event plans right now.')
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
        if (err instanceof Error && err.name !== 'AbortError') setLoadError(err.message)
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
    // The API has no dedicated catering fields yet, so the preferences travel with the requirements.
    const preferences = [
      form.get('menu') ? `Menu: ${form.get('menu')}` : '',
      form.get('meat') ? `Meat: ${form.get('meat')}` : '',
    ].filter(Boolean)
    const requirementsText = [String(form.get('requirements') ?? '').trim(), ...preferences]
      .filter(Boolean)
      .join('\n')
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      plan: Number(form.get('plan')),
      package: form.get('package') ? Number(form.get('package')) : null,
      plan_date: String(form.get('plan_date') ?? ''),
      location: String(form.get('location') ?? '').trim(),
      notes: String(form.get('notes') ?? '').trim(),
      event_type: form.get('event_type') ? Number(form.get('event_type')) : null,
      guest_count: form.get('guest_count') ? Number(form.get('guest_count')) : null,
      budget_tier: String(form.get('budget_tier') ?? '').trim(),
      requirements: requirementsText,
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${apiBaseUrl}/website/public/leads/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) {
        const details =
          result && typeof result === 'object'
            ? Object.values(result).flat().find((v) => typeof v === 'string')
            : null
        throw new Error(typeof details === 'string' ? details : 'Please check your details and try again.')
      }
      formElement.reset()
      setSelectedPackage('')
      const planName = plans.find((plan) => plan.id === payload.plan)?.name
      setNotice({
        kind: 'success',
        text: 'Our team has your details and will be in touch soon to talk through the next steps.',
        customerName: payload.name.split(/\s+/)[0],
        planName,
      })
    } catch (err) {
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Your inquiry could not be sent. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="profile-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <SiteHeader />

      <main>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <HeroSection />

        {/* ── Tradition + Ritual ─────────────────────────────────── */}
        <TraditionSection />

        {/* ── How it works ───────────────────────────────────────── */}
        <HowItWorks />

        {/* ── Experiences / Plans ────────────────────────────────── */}
        <section id="experiences" className="experience-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Our celebrations · <span lang="am">በዓላት</span></p>
              <h2>Gatherings with meaning.<br /><i>Celebrations with joy.</i></h2>
            </div>
            <p>
              Every plan comes with packages you can compare, with clear prices. Choose one to
              begin and we&apos;ll tailor it with your family and your parish.
            </p>
          </div>

          {loading && (
            <div className="catalog-message">Gathering our plans for you…</div>
          )}
          {!loading && loadError && (
            <div className="catalog-message catalog-error">
              {loadError} You can still reach us through the contact form below.
            </div>
          )}
          {!loading && !loadError && plans.length === 0 && (
            <div className="catalog-message">
              Our plans are being refreshed. Tell us what you&apos;re planning and we&apos;ll
              create something with you.
            </div>
          )}

          {!loading && plans.length > 0 && (
            <PlanShowcase plans={plans} onEnquire={startInquiry} />
          )}
        </section>

        {/* ── Gallery and testimonials (published from the admin) ─ */}
        <Showcase />

        {/* ── Church year ────────────────────────────────────────── */}
        <ChurchYearSection />

        {/* ── Celebration strip ──────────────────────────────────── */}
        <section className="celebration-strip" aria-label="Celebration traditions">
          <span>TEKLIL <small lang="am">ተክሊል</small></span><i><EthiopianCross size={16} /></i>
          <span>SHIMGILINA <small lang="am">ሽምግልና</small></span><i><EthiopianCross size={16} /></i>
          <span>KIRISTINA <small lang="am">ክርስትና</small></span><i><EthiopianCross size={16} /></i>
          <span>TEZKAR <small lang="am">ተዝካር</small></span><i><EthiopianCross size={16} /></i>
          <span>MAHBER <small lang="am">ማኅበር</small></span>
        </section>

        {/* ── Quote ──────────────────────────────────────────────── */}
        <section className="quote-band">
          <span className="quote-mark">"</span>
          <blockquote>Honor the blessing.<br /><i>Celebrate the joy.</i></blockquote>
          <span className="quote-credit">FAITH · FAMILY · TOGETHERNESS · <span lang="am">እምነት · ቤተሰብ · አንድነት</span></span>
        </section>

        {/* ── Contact / Inquiry ──────────────────────────────────── */}
        <InquiryForm
          plans={plans}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          selectedPackage={selectedPackage}
          setSelectedPackage={setSelectedPackage}
          submitting={submitting}
          notice={notice}
          onSubmit={submitInquiry}
          onReset={resetNotice}
        />
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  )
}
