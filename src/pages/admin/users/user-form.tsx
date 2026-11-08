import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import type navEn from '@/i18n/en/nav'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { RecordFormView } from '@/components/admin/record-form-view'
import { apiRequest } from '@/lib/api-request'
import { initials, lastSeen, type StaffUser, type UserOptions } from './types'

type Draft = { first_name: string; last_name: string; phone: string; email: string; role: string; employee: string; password: string }

const EMPTY: Draft = { first_name: '', last_name: '', phone: '', email: '', role: 'staff', employee: '', password: '' }

function draftFrom(user: StaffUser): Draft {
  return {
    first_name: user.first_name, last_name: user.last_name, phone: user.phone, email: user.email,
    role: user.role, employee: user.employee ? String(user.employee.id) : '', password: '',
  }
}

/** Access-table module → its menu name in the `nav` translations. */
const MODULE_NAV: Record<string, keyof typeof navEn> = {
  dashboard: 'dashboard', leads: 'leads', invoices: 'invoices', expenses: 'expenses', projects: 'projects',
  catalog: 'catalog', purchase_orders: 'purchaseOrders', vendors: 'vendors', crew: 'crew', payroll: 'payroll', users: 'users',
}

function moduleLabel(module: string) {
  return MODULE_NAV[module] ? i18n.t(`nav:${MODULE_NAV[module]}`) : module.replace(/_/g, ' ')
}

function PasswordNotice({ password, name, onDone }: { password: string; name: string; onDone: () => void }) {
  const { t } = useTranslation('users')
  const [copied, setCopied] = useState(false)
  return (
    <div className="usr-password" role="status">
      <div>
        <strong>{t('form.tempPasswordFor', { name })}</strong>
        <span>{t('form.tempPasswordHint')}</span>
      </div>
      <code>{password}</code>
      <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={() => { void navigator.clipboard?.writeText(password); setCopied(true) }}>{copied ? t('form.copied') : t('form.copy')}</button>
      <button type="button" className="o-btn o-btn-link o-btn-sm" onClick={onDone}>{t('form.done')}</button>
    </div>
  )
}

export function UserFormPage() {
  const { t } = useTranslation('users')
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<StaffUser | null>(null)
  const [options, setOptions] = useState<UserOptions | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [temporaryPassword, setTemporaryPassword] = useState<string>((location.state as { temporaryPassword?: string } | null)?.temporaryPassword ?? '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [chatterKey, setChatterKey] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [loadedOptions, loadedUser] = await Promise.all([
        apiRequest<UserOptions>('/user/users/options/', { signal, fallback: t('loadRoles') }),
        isNew ? Promise.resolve(null) : apiRequest<StaffUser>(`/user/users/${id}/`, { signal, fallback: t('form.loadFailed') }),
      ])
      setOptions(loadedOptions)
      if (loadedUser) { setUser(loadedUser); setDraft(draftFrom(loadedUser)) }
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const dirty = user ? JSON.stringify(draft) !== JSON.stringify(draftFrom(user)) : undefined
  const update = (changes: Partial<Draft>) => { setDraft((current) => ({ ...current, ...changes })); setSaved(false) }
  const isMe = Boolean(user && options && user.id === options.me)
  const lockedSuper = Boolean(user?.role === 'super' && !options?.is_super)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        first_name: draft.first_name.trim(), last_name: draft.last_name.trim(), phone: draft.phone.trim(),
        email: draft.email.trim(), role: draft.role, employee_id: draft.employee ? Number(draft.employee) : null,
      }
      if (isNew && draft.password) body.password = draft.password
      const result = await apiRequest<StaffUser>(isNew ? '/user/users/' : `/user/users/${id}/`, {
        method: isNew ? 'POST' : 'PATCH', body, fallback: t('form.saveFailed'), labels: { phone: t('form.phone'), email: t('form.email'), role: t('role'), password: t('form.password'), employee_id: t('crewRecord') },
      })
      if (isNew) {
        navigate(`/dashboard/users/${result.id}`, { replace: true, state: { temporaryPassword: result.temporary_password } })
        return
      }
      setUser(result)
      setDraft(draftFrom(result))
      setSaved(true)
      setChatterKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('form.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function setActive(active: boolean) {
    if (!user) return
    if (!active && !window.confirm(t('form.confirmDeactivate', { name: user.full_name }))) return
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest<StaffUser>(`/user/users/${user.id}/`, { method: 'PATCH', body: { is_active: active }, fallback: t('form.updateFailed') })
      setUser(result)
      setChatterKey((key) => key + 1)
    } catch (activeError) {
      setError(activeError instanceof Error ? activeError.message : t('form.updateFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    if (!user || !window.confirm(t('form.confirmReset', { name: user.full_name }))) return
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest<{ temporary_password?: string }>(`/user/users/${user.id}/password/`, { method: 'POST', body: {}, fallback: t('form.resetFailed') })
      setTemporaryPassword(result.temporary_password ?? '')
      setChatterKey((key) => key + 1)
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : t('form.resetFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (!options) {
    return (
      <AdminShell>
        {loading && <div className="o-form-loading" role="status"><span /><span /><span /></div>}
        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      </AdminShell>
    )
  }

  const roles = lockedSuper ? [{ value: 'super', label: t('super'), description: t('form.superDescription'), active_count: 0 }] : options.roles
  const freeEmployees = options.employees.filter((employee) => !employee.user_id || employee.user_id === user?.id)
  const name = [draft.first_name, draft.last_name].filter(Boolean).join(' ') || draft.phone

  const rolePicker = (
    <div className="usr-roles" role="radiogroup" aria-label={t('role')}>
      {roles.map((item) => {
        const selected = draft.role === item.value
        const disabled = isMe || lockedSuper
        return (
          <label key={item.value} className={`usr-role-card${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}>
            <input type="radio" name="role" value={item.value} checked={selected} disabled={disabled} onChange={() => update({ role: item.value })} />
            <span className="usr-role-card-head">
              <span className={`usr-role role-${item.value}`}>{item.label}</span>
              {item.active_count > 0 && <small>{t('form.activeCount', { count: item.active_count })}</small>}
            </span>
            <span className="usr-role-card-text">{item.description}</span>
            {item.access && item.access.length > 0 && (
              <span className="usr-access">
                {item.access.map((entry) => (
                  <span key={entry.module} className={entry.actions.some((action) => action !== 'view') ? 'is-full' : ''}
                    title={entry.actions.join(', ')}>
                    {moduleLabel(entry.module)}{entry.actions.some((action) => action !== 'view') ? '' : t('form.viewOnly')}
                  </span>
                ))}
              </span>
            )}
          </label>
        )
      })}
      {isMe && <p className="o-form-hint">{t('form.ownRole')}</p>}
      {lockedSuper && <p className="o-form-hint">{t('form.superOnly')}</p>}
    </div>
  )

  return (
    <AdminShell>
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {temporaryPassword && user && <PasswordNotice password={temporaryPassword} name={user.full_name} onDone={() => { setTemporaryPassword(''); navigate('.', { replace: true, state: null }) }} />}
      {(isNew || user) && (
        <RecordFormView
          modelName={t('model')}
          title={user ? user.full_name : name}
          subtitle={user ? `${user.role_label} · ${lastSeen(user.last_login)}` : t('form.newSubtitle')}
          recordId={user?.id}
          backHref="/dashboard/users"
          backLabel={t('form.back')}
          ribbon={user && !user.is_active ? { label: t('deactivated'), tone: 'danger' } : null}
          actionSlot={user && !lockedSuper && <>
            <button type="button" className="o-btn o-btn-secondary" disabled={busy} onClick={() => void resetPassword()}>{t('form.resetPassword')}</button>
            {!isMe && (user.is_active
              ? <button type="button" className="o-btn o-btn-link o-btn-danger" disabled={busy} onClick={() => void setActive(false)}>{t('form.deactivate')}</button>
              : <button type="button" className="o-btn o-btn-primary" disabled={busy} onClick={() => void setActive(true)}>{t('form.reactivate')}</button>)}
          </>}
          headerAside={user && <>
            <div className="o-stat-button">
              <span className={`usr-avatar role-${user.role}`} aria-hidden="true">{initials(user.full_name)}</span>
              <span><strong>{user.role_label}</strong><small>{t('role')}</small></span>
            </div>
            {user.employee && (
              <Link to={`/dashboard/crew/${user.employee.id}`} className="o-stat-button">
                <span className="o-stat-icon" aria-hidden="true">◈</span>
                <span><strong>{user.employee.full_name}</strong><small>{t('crewRecord')}</small></span>
              </Link>
            )}
          </>}
          headerFields={[
            { name: 'first_name', label: t('form.firstName'), value: draft.first_name, required: true },
            { name: 'last_name', label: t('form.lastName'), value: draft.last_name },
            { name: 'phone', label: t('form.signInPhone'), type: 'tel', value: draft.phone, required: true, readOnly: lockedSuper, helpText: t('form.signInHelp') },
            { name: 'email', label: t('form.email'), type: 'email', value: draft.email, readOnly: lockedSuper },
            ...(isNew ? [{ name: 'password', label: t('form.password'), type: 'text' as const, value: draft.password, placeholder: t('form.passwordPlaceholder'), helpText: t('form.passwordHelp') }] : []),
            {
              name: 'employee', label: t('crewRecord'), type: 'select', value: draft.employee, readOnly: lockedSuper,
              options: [{ value: '', label: t('form.notLinked') }, ...freeEmployees.map((employee) => ({ value: String(employee.id), label: `${employee.full_name} · ${employee.phone}` }))],
              helpText: t('form.crewHelp'),
            },
          ]}
          onFieldChange={(field, value) => update({ [field]: value } as Partial<Draft>)}
          tabs={[{ id: 'role', label: t('form.roleTab'), content: rolePicker }]}
          onSubmit={lockedSuper ? undefined : (event) => void save(event)}
          dirty={dirty}
          onDiscard={() => {
            if (isNew) { navigate('/dashboard/users'); return }
            if (user) setDraft(draftFrom(user))
            setError('')
          }}
          saving={saving}
          saved={saved}
          submitLabel={isNew ? t('form.create') : t('form.save')}
          chatter={user ? { model: 'user', recordId: user.id, refreshKey: chatterKey } : undefined}
        />
      )}
    </AdminShell>
  )
}
