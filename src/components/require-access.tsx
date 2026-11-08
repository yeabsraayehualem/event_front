import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AdminShell } from '@/components/admin/admin-shell'
import { landingPath } from '@/components/admin-navigation'
import { can, useProfileStatus } from '@/lib/use-profile'
import { useTranslation } from 'react-i18next'
import { roleLabel } from '@/i18n'
import type navEn from '@/i18n/en/nav'

/** Access-table module → its menu name in the `nav` translations. */
const MODULE_NAV: Record<string, keyof typeof navEn> = {
  dashboard: 'dashboard', leads: 'leads', invoices: 'invoices', expenses: 'expenses', projects: 'projects',
  catalog: 'catalog', purchase_orders: 'purchaseOrders', vendors: 'vendors', crew: 'crew', payroll: 'payroll', users: 'users',
}

/** Shown when a signed-in role opens a page it can't use. */
export function NoAccess({ module }: { module?: string }) {
  const { profile } = useProfileStatus()
  const { t } = useTranslation('auth')
  const role = roleLabel(profile?.role)
  const moduleName = module ? (MODULE_NAV[module] ? t(MODULE_NAV[module], { ns: 'nav' }) : module.replace(/_/g, ' ')) : ''
  const home = landingPath(profile)
  const nothing = home === '/dashboard/no-access'
  return (
    <AdminShell>
      <section className="dash-card no-access" role="alert">
        <span className="no-access-mark" aria-hidden="true">⊘</span>
        <h1>{nothing ? t('noAccess.noModulesTitle') : t('noAccess.deniedTitle')}</h1>
        <p>
          {nothing
            ? t('noAccess.noModulesBody', { role })
            : module
              ? t('noAccess.deniedModule', { role, module: moduleName })
              : t('noAccess.deniedPage', { role })}
        </p>
        {!nothing && <Link to={home} className="o-btn o-btn-primary">{t('noAccess.goHome')}</Link>}
      </section>
    </AdminShell>
  )
}

/** Renders `children` only for roles that may `action` in `module`; sends signed-out visitors to the login page. */
export function RequireAccess({ module, action = 'view', children }: { module: string; action?: string; children: ReactNode }) {
  const { profile, loading } = useProfileStatus()
  const location = useLocation()
  const { t } = useTranslation('auth')
  if (loading) {
    return <AdminShell><div className="o-form-loading" role="status" aria-label={t('noAccess.checking')}><span /><span /><span /></div></AdminShell>
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
