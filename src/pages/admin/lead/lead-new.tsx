import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { RecordFormView } from '@/components/admin/record-form-view'
import { apiBaseUrl } from '@/lib/api'
import { fetchCsrfToken } from '@/lib/csrf'
import { getErrorMessage } from '@/lib/api-errors'
import { BUDGET_TIERS } from '@/lib/event-options'
import { useTranslation } from 'react-i18next'

type PlanOption = { id: number; name: string; packages: { id: number; name: string }[]; event_types: { id: number; name: string }[] }
type FormOptions = { plans: PlanOption[]; sales_people: { id: number; name: string }[]; can_assign_sales: boolean }

const emptyLead = {
  customer_name: '', phone: '', email: '', plan: '', package_id: '', plan_date: '', location: '',
  event_type_id: '', guest_count: '', budget_tier: '', requirements: '', notes: '', assigned_sales_person_id: '',
}
type LeadDraft = typeof emptyLead

export function LeadNewPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('leads')
  const fieldLabels: Record<string, string> = {
    customer_name: t('form.customer'), plan: t('form.eventPlan'), package_id: t('form.package'), plan_date: t('form.eventDate'),
    event_type_id: t('form.eventType'), guest_count: t('form.guestsShort'), assigned_sales_person_id: t('form.salesPerson'),
    phone: t('form.phone'), email: t('form.email'), location: t('form.venue'),
  }
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [draft, setDraft] = useState<LeadDraft>(emptyLead)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiBaseUrl}/crm/sales/lead-form-options/`, { credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const body: unknown = await response.json()
        if (response.status === 401) { navigate('/login', { replace: true }); return }
        if (!response.ok) throw new Error(getErrorMessage(body, t('form.loadFailed')))
        const loaded = body as FormOptions
        setOptions(loaded)
        if (loaded.plans.length === 1) setDraft((current) => ({ ...current, plan: String(loaded.plans[0].id) }))
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
      })
    return () => controller.abort()
  }, [navigate, t])

  const update = (name: string, value: string) => {
    setDraft((current) => ({
      ...current,
      [name]: value,
      // Packages and event types belong to one plan, so changing the plan clears them.
      ...(name === 'plan' ? { package_id: '', event_type_id: '' } : {}),
    }))
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const csrfToken = await fetchCsrfToken()
      const response = await fetch(`${apiBaseUrl}/crm/sales/leads/`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({
          customer_name: draft.customer_name.trim(),
          phone: draft.phone.trim(),
          email: draft.email.trim(),
          plan: Number(draft.plan),
          package_id: draft.package_id ? Number(draft.package_id) : null,
          plan_date: draft.plan_date,
          location: draft.location,
          event_type_id: draft.event_type_id ? Number(draft.event_type_id) : null,
          guest_count: draft.guest_count ? Number(draft.guest_count) : null,
          budget_tier: draft.budget_tier,
          requirements: draft.requirements,
          notes: draft.notes,
          ...(options?.can_assign_sales && draft.assigned_sales_person_id
            ? { assigned_sales_person_id: Number(draft.assigned_sales_person_id) }
            : {}),
        }),
      })
      const body: unknown = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(body, t('form.createFailed'), fieldLabels))
      const id = (body as { data?: { id?: number } }).data?.id
      navigate(id ? `/dashboard/leads/${id}` : '/dashboard/leads', { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('form.createFailed'))
      setSaving(false)
    }
  }

  const plan = options?.plans.find((item) => String(item.id) === draft.plan)

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Hadafe Nefs" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
          {!options && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

          {options && (
            <RecordFormView
              modelName={t('model')}
              title={draft.customer_name}
              subtitle={t('form.newInquiry')}
              backHref="/dashboard/leads"
              backLabel={t('form.backLeads')}
              headerFields={[
                { name: 'customer_name', label: t('form.customer'), value: draft.customer_name, required: true, placeholder: t('form.fullName') },
                { name: 'plan_date', label: t('form.eventDate'), type: 'date', value: draft.plan_date, required: true },
                { name: 'phone', label: t('form.phone'), type: 'tel', value: draft.phone, required: true, placeholder: '+251…', helpText: t('form.phoneHelp') },
                { name: 'location', label: t('form.venue'), value: draft.location, placeholder: t('form.toBeConfirmed') },
                { name: 'email', label: t('form.email'), type: 'email', value: draft.email, placeholder: t('form.optional') },
                {
                  name: 'plan', label: t('form.eventPlan'), type: 'select', value: draft.plan, required: true,
                  options: [{ value: '', label: t('form.choosePlan') }, ...options.plans.map((item) => ({ value: String(item.id), label: item.name }))],
                },
                {
                  name: 'event_type_id', label: t('form.eventType'), type: 'select', value: draft.event_type_id,
                  readOnly: !plan?.event_types.length,
                  placeholder: plan ? t('form.noEventTypes') : t('form.choosePlanFirst'),
                  options: [{ value: '', label: t('form.selectOccasion') }, ...(plan?.event_types ?? []).map((item) => ({ value: String(item.id), label: item.name }))],
                },
                {
                  name: 'package_id', label: t('form.package'), type: 'select', value: draft.package_id,
                  readOnly: !plan, placeholder: t('form.choosePlanFirst'),
                  options: [{ value: '', label: t('form.noPackageYet') }, ...(plan?.packages ?? []).map((item) => ({ value: String(item.id), label: item.name }))],
                },
                ...(options.can_assign_sales ? [{
                  name: 'assigned_sales_person_id', label: t('form.salesPerson'), type: 'select' as const, value: draft.assigned_sales_person_id,
                  options: [{ value: '', label: t('form.unassigned') }, ...options.sales_people.map((person) => ({ value: String(person.id), label: person.name }))],
                }] : []),
              ]}
              tabs={[
                {
                  id: 'celebration',
                  label: t('form.celebrationTab'),
                  sections: [
                    {
                      title: t('form.occasion'),
                      fields: [
                        { name: 'guest_count', label: t('form.guests'), type: 'number', value: draft.guest_count, placeholder: t('form.guestsPlaceholder') },
                        {
                          name: 'budget_tier', label: t('form.budget'), type: 'select', value: draft.budget_tier,
                          options: [{ value: '', label: t('form.stillDeciding') }, ...BUDGET_TIERS.map((tier) => ({ value: tier.value, label: t(`budgetTiers.${tier.key}`, { ns: 'common' }) }))],
                        },
                      ],
                    },
                    {
                      title: t('form.requirements'),
                      fields: [
                        { name: 'requirements', label: t('form.customerNotes'), type: 'textarea', value: draft.requirements, fullWidth: true, placeholder: t('form.customerNotesPlaceholder') },
                      ],
                    },
                  ],
                },
                {
                  id: 'notes',
                  label: t('form.internalNotes'),
                  content: (
                    <textarea
                      className="o-input o-notes-editor"
                      aria-label={t('form.internalNotes')}
                      value={draft.notes}
                      onChange={(event) => update('notes', event.target.value)}
                      placeholder={t('form.internalNotesPlaceholder')}
                    />
                  ),
                },
              ]}
              onFieldChange={update}
              onSubmit={(event) => void createLead(event)}
              onDiscard={() => navigate('/dashboard/leads')}
              saving={saving}
              submittingLabel={t('form.creating')}
            />
          )}
        </div>
      </main>
    </div>
  )
}
