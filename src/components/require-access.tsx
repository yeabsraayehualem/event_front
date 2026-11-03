import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { landingPath } from '@/components/admin-navigation'
import { can, useProfileStatus } from '@/lib/use-profile'

const ROLE_LABELS: Record<string, string> = {
  super: 'Super user', admin: 'Admin', sales: 'Sales', finance: 'Finance', pm: 'Project management',
  hr: 'HR', stock: 'Stock', staff: 'Staff',
}

/** Shown when a signed-in role opens a page it can't use. */
export function NoAccess({ module }: { module?: string }) {
  const { profile } = useProfileStatus()
  const home = landingPath(profile)
  const nothing = home === '/dashboard/no-access'
  return (
    <AdminShell>
      <section className="dash-card no-access" role="alert">
        <span className="no-access-mark" aria-hidden="true">⊘</span>
        <h1>{nothing ? 'No modules yet' : 'You don’t have access to this page'}</h1>
        <p>
          {nothing
            ? `Your account (${ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}) can sign in, but hasn’t been given any modules. Ask an admin to change your role.`
            : `Your role (${ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}) can’t open ${module ? `the ${module.replace(/_/g, ' ')} module` : 'this page'}. If you need it, ask an admin to change your role.`}
        </p>
        {!nothing && <Link to={home} className="o-btn o-btn-primary">Go to my start page</Link>}
      </section>
    </AdminShell>
  )
}

/** Renders `children` only for roles that may `action` in `module`; sends signed-out visitors to the login page. */
export function RequireAccess({ module, action = 'view', children }: { module: string; action?: string; children: ReactNode }) {
  const { profile, loading } = useProfileStatus()
  const location = useLocation()
  if (loading) {
    return <AdminShell><div className="o-form-loading" role="status" aria-label="Checking access"><span /><span /><span /></div></AdminShell>
  }
  if (!profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!can(profile, module, action)) return <NoAccess module={module} />
  return <>{children}</>
}

/** Unknown staff addresses go to the person's start page (or the login page if signed out). */
export function GoToStart() {
  const { profile, loading } = useProfileStatus()
  if (loading) return <AdminShell><div className="o-form-loading" role="status"><span /><span /><span /></div></AdminShell>
  return <Navigate to={profile ? landingPath(profile) : '/login'} replace />
}
