import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SideNav } from '@/components/side-nav'
import { adminNavigationItems } from '@/components/admin-navigation'
import { RecordFormView, type RecordFormStatus } from '@/components/admin/record-form-view'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

type PlanOption = { id: number; name: string; packages: { id: number; name: string }[] }

const statuses: RecordFormStatus[] = [
  { value: 'lead', label: 'New lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'consultation_scheduled', label: 'Consultation scheduled' },
  { value: 'quotation_sent', label: 'Quotation sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'cancelled', label: 'Cancelled' },
]

function getErrorMessage(body: unknown) {
  if (typeof body !== 'object' || body === null) return 'We could not create this lead.'
  if ('detail' in body && typeof body.detail === 'string') return body.detail
  const firstError = Object.values(body).flatMap((value) => Array.isArray(value) ? value : [value]).find((value) => typeof value === 'string')
  return typeof firstError === 'string' ? firstError : 'Please check the fields and try again.'
}

export function LeadCreatePage() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('lead')
  const [values, setValues] = useState({
    customer_name: '', phone: '', email: '', plan: '', package_id: '', plan_date: '',
    location: '', event_type: '', guest_count: '', budget_tier: '', requirements: '', notes: '',
  })

  useEffect(() => {
    const controller = new AbortController()
    async function loadPlans() {
      setLoading(true)
      try {
        const response = await fetch(`${apiBaseUrl}/website/plans/`, { credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' } })
        const body: unknown = await response.json()
        if (response.status === 401 || response.status === 403) {
          await logout()
          navigate('/login', { replace: true })
          return
        }
        if (!response.ok || !Array.isArray(body)) throw new Error('We could not load event plans.')
        setPlans(body as PlanOption[])
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }
    void loadPlans()
    return () => controller.abort()
  }, [logout, navigate])

  const selectedPlan = useMemo(() => plans.find((plan) => String(plan.id) === values.plan), [plans, values.plan])

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const csrfResponse = await fetch(`${apiBaseUrl}/user/csrf/`, { credentials: 'include', headers: { Accept: 'application/json' } })
      const csrfBody: unknown = await csrfResponse.json()
      const csrfToken = typeof csrfBody === 'object' && csrfBody !== null && 'csrf_token' in csrfBody
        ? (csrfBody as { csrf_token?: unknown }).csrf_token : undefined
      if (!csrfResponse.ok || typeof csrfToken !== 'string') throw new Error('Could not prepare a secure request. Please reload and try again.')

      const response = await fetch(`${apiBaseUrl}/crm/sales/leads/`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({
          customer_name: values.customer_name,
          phone: values.phone,
          ...(values.email ? { email: values.email } : {}),
          plan: Number(values.plan),
          package_id: values.package_id ? Number(values.package_id) : null,
          plan_date: values.plan_date,
          location: values.location,
          event_type: values.event_type,
          guest_count: values.guest_count ? Number(values.guest_count) : null,
          budget_tier: values.budget_tier,
          requirements: values.requirements,
          notes: values.notes,
          status,
        }),
      })
      const body: unknown = await response.json()
      if (response.status === 401 || response.status === 403) {
        if (response.status === 403) throw new Error(getErrorMessage(body))
        await logout()
        navigate('/login', { replace: true })
        return
      }
      if (!response.ok) throw new Error(getErrorMessage(body))
      const data = typeof body === 'object' && body !== null && 'data' in body
        ? (body as { data?: { id?: number } }).data : undefined
      if (typeof data?.id !== 'number') throw new Error('The lead was created, but its reference was missing.')
      navigate(`/dashboard/leads/${data.id}`, { replace: true })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'We could not create this lead.')
    } finally {
      setSaving(false)
    }
  }

  const planOptions = [{ value: '', label: 'Select an event plan' }, ...plans.map((plan) => ({ value: String(plan.id), label: plan.name }))]
  const packageOptions = [{ value: '', label: 'No package selected' }, ...(selectedPlan?.packages ?? []).map((item) => ({ value: String(item.id), label: item.name }))]

  return (
    <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {error && <section className="dashboard-message dashboard-message--error" role="alert"><div><strong>We couldn’t create this lead.</strong><p>{error}</p></div></section>}
          {loading ? <div className="dashboard-message" role="status">Loading event plans…</div> : plans.length === 0 ? <div className="dashboard-message" role="status">Add an event plan before registering a lead.</div> : (
            <RecordFormView
              modelName="Lead"
              title={values.customer_name || 'New walk-in lead'}
              subtitle="Register an inquiry from a customer visiting in person"
              backHref="/dashboard/leads"
              backLabel="All leads"
              status={status}
              statusOptions={statuses}
              onStatusChange={setStatus}
              headerFields={[
                { name: 'customer_name', label: 'Customer', value: values.customer_name, required: true, placeholder: 'Customer full name' },
                { name: 'phone', label: 'Phone', type: 'tel', value: values.phone, required: true, placeholder: 'Phone number' },
                { name: 'email', label: 'Email', type: 'email', value: values.email, placeholder: 'Optional' },
                { name: 'plan', label: 'Event plan', type: 'select', value: values.plan, required: true, options: planOptions },
                { name: 'package_id', label: 'Package', type: 'select', value: values.package_id, options: packageOptions, readOnlyWhen: (current) => !current.plan },
                { name: 'plan_date', label: 'Event date', type: 'date', value: values.plan_date, required: true },
              ]}
              sections={[{
                title: 'Celebration details',
                description: 'Details the walk-in customer shared or the next step to record.',
                fields: [
                  { name: 'event_type', label: 'Event type', value: values.event_type, placeholder: 'e.g. Wedding' },
                  { name: 'guest_count', label: 'Estimated guests', type: 'number', value: values.guest_count, placeholder: 'Number of guests' },
                  { name: 'location', label: 'Venue or location', value: values.location, placeholder: 'To be confirmed' },
                  { name: 'budget_tier', label: 'Budget range', value: values.budget_tier, placeholder: 'Optional' },
                  { name: 'requirements', label: 'Customer requirements', type: 'textarea', value: values.requirements, fullWidth: true, placeholder: 'What does the customer need?' },
                ],
              }]}
              tabs={[
                {
                  id: 'follow-up', label: 'Follow-up', sections: [{
                    title: 'Internal follow-up',
                    description: 'Notes for the team. A walk-in lead is automatically assigned to you.',
                    fields: [{ name: 'notes', label: 'Notes', type: 'textarea', value: values.notes, fullWidth: true, placeholder: 'Add discussion notes or the next step…' }],
                  }],
                },
              ]}
              onFieldChange={(name, value) => setValues((current) => {
                if (name === 'plan') return { ...current, plan: value, package_id: '' }
                return { ...current, [name]: value }
              })}
              onSubmit={createLead}
              saving={saving}
              submitLabel="Create lead"
              submittingLabel="Creating lead…"
            />
          )}
        </div>
      </main>
    </div>
  )
}
