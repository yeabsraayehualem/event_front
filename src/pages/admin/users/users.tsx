import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { apiRequest } from '@/lib/api-request'
import { initials, lastSeen, type StaffUser, type UserOptions } from './types'

export function UsersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const role = searchParams.get('role') ?? ''
  const showInactive = searchParams.get('inactive') === 'yes'
  const [users, setUsers] = useState<StaffUser[] | null>(null)
  const [options, setOptions] = useState<UserOptions | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<StaffUser[]>('/user/users/', { signal: controller.signal, fallback: 'Could not load users.' }),
      apiRequest<UserOptions>('/user/users/options/', { signal: controller.signal, fallback: 'Could not load roles.' }),
    ])
      .then(([loaded, loadedOptions]) => { setUsers(loaded); setOptions(loadedOptions) })
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [])

  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    setSearchParams(next)
  }

  const needle = query.trim().toLowerCase()
  const visible = (users ?? []).filter((user) => showInactive || user.is_active)
  const shown = visible.filter((user) => (!role || user.role === role)
    && (!needle || [user.full_name, user.phone, user.email].some((value) => value.toLowerCase().includes(needle))))
  const countFor = (value: string) => visible.filter((user) => user.role === value).length
  const roleLabels = new Map([...(options?.roles ?? []).map((item) => [item.value, item.label] as const), ['super', 'Super']])

  return (
    <AdminShell>
      <div className="dash">
        <div className="dash-header">
          <div>
            <p className="dash-eyebrow">Settings</p>
            <h1 className="dash-title">Users</h1>
          </div>
          <Link to="/dashboard/users/new" className="o-btn o-btn-primary">Add user</Link>
        </div>

        <div className="proc-chips" role="group" aria-label="Filter by role">
          <button type="button" className={!role ? 'is-active' : ''} onClick={() => setFilter('role', '')}>All<span>{visible.length}</span></button>
          {[...roleLabels].filter(([value]) => countFor(value) > 0).map(([value, label]) => (
            <button key={value} type="button" className={role === value ? 'is-active' : ''} onClick={() => setFilter('role', value)}>{label}<span>{countFor(value)}</span></button>
          ))}
        </div>

        <div className="cat-toolbar">
          <input type="search" className="cat-search" placeholder="Search name, phone or email…" aria-label="Search users" value={query} onChange={(event) => setQuery(event.target.value)} />
          <label className="proc-toggle"><input type="checkbox" checked={showInactive} onChange={(event) => setFilter('inactive', event.target.checked ? 'yes' : '')} /> Show deactivated</label>
          {users && <span className="dash-scope">{shown.length} of {visible.length}</span>}
        </div>

        {error && <p className="dashboard-message dashboard-message--error" role="alert">{error}</p>}
        {!users && !error && <div className="o-form-loading" role="status"><span /><span /><span /></div>}

        {users && (
          <section className="dash-card dash-card--flush">
            {shown.length === 0 ? <p className="dash-empty">{users.length ? 'Nobody matches these filters.' : 'No users yet.'}</p> : (
              <div className="overflow-x-auto">
                <table className="dash-table usr-table">
                  <thead><tr>
                    <th scope="col">Name</th><th scope="col">Role</th><th scope="col">Crew record</th><th scope="col">Last signed in</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((user) => (
                      <tr key={user.id} className={user.is_active ? '' : 'is-inactive'} onClick={() => navigate(`/dashboard/users/${user.id}`)}>
                        <td>
                          <div className="usr-person">
                            <span className={`usr-avatar role-${user.role}`} aria-hidden="true">{initials(user.full_name)}</span>
                            <span className="usr-person-text">
                              <Link to={`/dashboard/users/${user.id}`} className="dash-row-title" onClick={(event) => event.stopPropagation()}>
                                {user.full_name}{user.id === options?.me && <span className="usr-you">You</span>}
                              </Link>
                              <span className="cat-muted">{[user.phone, user.email].filter(Boolean).join(' · ')}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`usr-role role-${user.role}`}>{user.role_label}</span>
                          {!user.is_active && <span className="proc-status proc-status--cancelled">Deactivated</span>}
                        </td>
                        <td>{user.employee ? <Link to={`/dashboard/crew/${user.employee.id}`} className="cat-row-link" onClick={(event) => event.stopPropagation()}>{user.employee.full_name}</Link> : <span className="dash-muted">—</span>}</td>
                        <td className="dash-muted">{lastSeen(user.last_login)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </AdminShell>
  )
}
