import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { RecordFormView } from '@/components/admin/record-form-view'
import { apiRequest } from '@/lib/api-request'
import { initials, lastSeen, type StaffUser, type UserOptions } from './types'

type Draft = { first_name: string; last_name: string; phone: string; email: string; role: string; employee: string; password: string }

const EMPTY: Draft = { first_name: '', last_name: '', phone: '', email: '', role: 'staff', employee: '', password: '' }
const fieldLabels = { phone: 'Phone', email: 'Email', role: 'Role', password: 'Password', employee_id: 'Crew record' }

function draftFrom(user: StaffUser): Draft {
  return {
    first_name: user.first_name, last_name: user.last_name, phone: user.phone, email: user.email,
    role: user.role, employee: user.employee ? String(user.employee.id) : '', password: '',
  }
}

function PasswordNotice({ password, name, onDone }: { password: string; name: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="usr-password" role="status">
      <div>
        <strong>Temporary password for {name}</strong>
        <span>Share it privately. It won’t be shown again. They can change it from the menu after signing in.</span>
      </div>
      <code>{password}</code>
      <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={() => { void navigator.clipboard?.writeText(password); setCopied(true) }}>{copied ? 'Copied' : 'Copy'}</button>
      <button type="button" className="o-btn o-btn-link o-btn-sm" onClick={onDone}>Done</button>
    </div>
  )
}

export function UserFormPage() {
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
        apiRequest<UserOptions>('/user/users/options/', { signal, fallback: 'Could not load roles.' }),
        isNew ? Promise.resolve(null) : apiRequest<StaffUser>(`/user/users/${id}/`, { signal, fallback: 'Could not load this user.' }),
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
        method: isNew ? 'POST' : 'PATCH', body, fallback: 'Could not save this user.', labels: fieldLabels,
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
      setError(saveError instanceof Error ? saveError.message : 'Could not save this user.')
    } finally {
      setSaving(false)
    }
  }

  async function setActive(active: boolean) {
    if (!user) return
    if (!active && !window.confirm(`Deactivate ${user.full_name}? They’ll be signed out and can’t sign in until reactivated. Their history is kept.`)) return
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest<StaffUser>(`/user/users/${user.id}/`, { method: 'PATCH', body: { is_active: active }, fallback: 'Could not update this user.' })
      setUser(result)
      setChatterKey((key) => key + 1)
    } catch (activeError) {
      setError(activeError instanceof Error ? activeError.message : 'Could not update this user.')
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    if (!user || !window.confirm(`Reset ${user.full_name}’s password? Their current password stops working and they’re signed out.`)) return
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest<{ temporary_password?: string }>(`/user/users/${user.id}/password/`, { method: 'POST', body: {}, fallback: 'Could not reset the password.' })
      setTemporaryPassword(result.temporary_password ?? '')
      setChatterKey((key) => key + 1)
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not reset the password.')
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

  const roles = lockedSuper ? [{ value: 'super', label: 'Super', description: 'Everything, including other super users.', active_count: 0 }] : options.roles
  const freeEmployees = options.employees.filter((employee) => !employee.user_id || employee.user_id === user?.id)
  const name = [draft.first_name, draft.last_name].filter(Boolean).join(' ') || draft.phone

  const rolePicker = (
    <div className="usr-roles" role="radiogroup" aria-label="Role">
      {roles.map((item) => {
        const selected = draft.role === item.value
        const disabled = isMe || lockedSuper
        return (
          <label key={item.value} className={`usr-role-card${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}>
            <input type="radio" name="role" value={item.value} checked={selected} disabled={disabled} onChange={() => update({ role: item.value })} />
            <span className="usr-role-card-head">
              <span className={`usr-role role-${item.value}`}>{item.label}</span>
              {item.active_count > 0 && <small>{item.active_count} active</small>}
            </span>
            <span className="usr-role-card-text">{item.description}</span>
            {item.access && item.access.length > 0 && (
              <span className="usr-access">
                {item.access.map((entry) => (
                  <span key={entry.module} className={entry.actions.some((action) => action !== 'view') ? 'is-full' : ''}
                    title={entry.actions.join(', ')}>
                    {entry.module}{entry.actions.some((action) => action !== 'view') ? '' : ' · view'}
                  </span>
                ))}
              </span>
            )}
          </label>
        )
      })}
      {isMe && <p className="o-form-hint">You can’t change your own role. Ask another admin.</p>}
      {lockedSuper && <p className="o-form-hint">Only a super user can change a super user.</p>}
    </div>
  )

  return (
    <AdminShell>
      {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
      {temporaryPassword && user && <PasswordNotice password={temporaryPassword} name={user.full_name} onDone={() => { setTemporaryPassword(''); navigate('.', { replace: true, state: null }) }} />}
      {(isNew || user) && (
        <RecordFormView
          modelName="User"
          title={user ? user.full_name : name}
          subtitle={user ? `${user.role_label} · ${lastSeen(user.last_login)}` : 'Someone who signs in to the system.'}
          recordId={user?.id}
          backHref="/dashboard/users"
          backLabel="Users"
          ribbon={user && !user.is_active ? { label: 'Deactivated', tone: 'danger' } : null}
          actionSlot={user && !lockedSuper && <>
            <button type="button" className="o-btn o-btn-secondary" disabled={busy} onClick={() => void resetPassword()}>Reset password</button>
            {!isMe && (user.is_active
              ? <button type="button" className="o-btn o-btn-link o-btn-danger" disabled={busy} onClick={() => void setActive(false)}>Deactivate</button>
              : <button type="button" className="o-btn o-btn-primary" disabled={busy} onClick={() => void setActive(true)}>Reactivate</button>)}
          </>}
          headerAside={user && <>
            <div className="o-stat-button">
              <span className={`usr-avatar role-${user.role}`} aria-hidden="true">{initials(user.full_name)}</span>
              <span><strong>{user.role_label}</strong><small>Role</small></span>
            </div>
            {user.employee && (
              <Link to={`/dashboard/crew/${user.employee.id}`} className="o-stat-button">
                <span className="o-stat-icon" aria-hidden="true">◈</span>
                <span><strong>{user.employee.full_name}</strong><small>Crew record</small></span>
              </Link>
            )}
          </>}
          headerFields={[
            { name: 'first_name', label: 'First name', value: draft.first_name, required: true },
            { name: 'last_name', label: 'Last name', value: draft.last_name },
            { name: 'phone', label: 'Phone (sign-in)', type: 'tel', value: draft.phone, required: true, readOnly: lockedSuper, helpText: 'They sign in with this number.' },
            { name: 'email', label: 'Email', type: 'email', value: draft.email, readOnly: lockedSuper },
            ...(isNew ? [{ name: 'password', label: 'Password', type: 'text' as const, value: draft.password, placeholder: 'Leave empty to generate one', helpText: 'At least 8 characters, not only numbers.' }] : []),
            {
              name: 'employee', label: 'Crew record', type: 'select', value: draft.employee, readOnly: lockedSuper,
              options: [{ value: '', label: 'Not linked' }, ...freeEmployees.map((employee) => ({ value: String(employee.id), label: `${employee.full_name} · ${employee.phone}` }))],
              helpText: 'Link if this person is also on the crew directory.',
            },
          ]}
          onFieldChange={(field, value) => update({ [field]: value } as Partial<Draft>)}
          tabs={[{ id: 'role', label: 'Role & access', content: rolePicker }]}
          onSubmit={lockedSuper ? undefined : (event) => void save(event)}
          dirty={dirty}
          onDiscard={() => {
            if (isNew) { navigate('/dashboard/users'); return }
            if (user) setDraft(draftFrom(user))
            setError('')
          }}
          saving={saving}
          saved={saved}
          submitLabel={isNew ? 'Create user' : 'Save'}
          chatter={user ? { model: 'user', recordId: user.id, refreshKey: chatterKey } : undefined}
        />
      )}
    </AdminShell>
  )
}
