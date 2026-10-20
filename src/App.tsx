import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { CompanyProfilePage } from './pages/CompanyProfilePage'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

function CRMAccess({ children }: { children: React.ReactNode }) {
  const navigateToLogin = useAuthStore((state) => state.logout)
  const [state, setState] = useState<'checking' | 'allowed' | 'unauthenticated' | 'forbidden'>('checking')

  useEffect(() => {
    let active = true
    fetch(`${apiBaseUrl}/user/profile/`, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          await navigateToLogin()
          if (active) setState('unauthenticated')
          return
        }
        const body = await response.json()
        if (!response.ok) {
          if (active) setState('forbidden')
          return
        }
        const role = body?.data?.role
        if (active) setState(role === 'sales' || role === 'super' ? 'allowed' : 'forbidden')
      })
      .catch(() => { if (active) setState('forbidden') })
    return () => { active = false }
  }, [navigateToLogin])

  if (state === 'checking') return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">Checking your access…</div>
  if (state === 'unauthenticated') return <Navigate to="/login" replace />
  if (state === 'forbidden') return <main className="grid min-h-screen place-items-center bg-[#f7f4eb] px-5"><section className="max-w-md border border-[#e8e1d2] bg-white p-8 text-center shadow-sm"><p className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-[#a64f42]">Access restricted</p><h1 className="font-serif text-2xl text-[#294635]">Your account cannot open this workspace.</h1><p className="mt-3 text-sm leading-6 text-[#77766c]">Contact an administrator if you need sales access.</p><Link to="/" className="mt-6 inline-flex min-h-11 items-center bg-[#28513c] px-5 text-sm font-medium text-white">Return to the website</Link></section></main>
  return children
}

const DashboardPage = lazy(() =>
  import('./pages/admin/dashboard').then((module) => ({
    default: module.DashboardPage,
  }))
)
const LeadsPage = lazy(() =>
  import('./pages/admin/leads').then((module) => ({
    default: module.LeadsPage,
  }))
)
const LeadDetailPage = lazy(() =>
  import('./pages/admin/lead-detail').then((module) => ({
    default: module.LeadDetailPage,
  }))
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CompanyProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard/leads/:leadId"
          element={
            <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
              <CRMAccess><LeadDetailPage /></CRMAccess>
            </Suspense>
          }
        />
        <Route
          path="/dashboard/leads"
          element={
            <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
              <CRMAccess><LeadsPage /></CRMAccess>
            </Suspense>
          }
        />
        <Route
          path="/dashboard/*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
              <CRMAccess><DashboardPage /></CRMAccess>
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
