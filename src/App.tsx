import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { CompanyProfilePage } from './pages/CompanyProfilePage'
import { apiBaseUrl } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { InvoicePage } from './pages/admin/invoices/invoice-page'
import { InvoiceDetailPage } from './pages/admin/invoices/invoices-detail'
import { Login } from '@hugeicons/core-free-icons'
import { ProjectList } from './pages/admin/project/list'

const defaultCrmRoles = ['sales', 'super']
const invoiceRoles = ['sales', 'finance', 'super']

function CRMAccess({ children, allowedRoles = defaultCrmRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
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
        if (active) setState(typeof role === 'string' && allowedRoles.includes(role) ? 'allowed' : 'forbidden')
      })
      .catch(() => { if (active) setState('forbidden') })
    return () => { active = false }
  }, [allowedRoles, navigateToLogin])

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
  import('./pages/admin/lead/leads').then((module) => ({
    default: module.LeadsPage,
  }))
)
const LeadDetailPage = lazy(() =>
  import('./pages/admin/lead/lead-detail').then((module) => ({
    default: module.LeadDetailPage,
  }))
)

const routes = [
  { path:"/", element: <CompanyProfilePage />},
  { path:"/login", element: <LoginPage /> },

  {path: "/dashboard/*", element: <DashboardPage />} ,


  { path: "/dashboard/leads/:leadId", element: <LeadDetailPage /> },
  { path: "/dashboard/leads", element: <LeadsPage />},
  
  { path: "/dashboard/invoices", element: <InvoicePage /> },
  { path: "/dashboard/invoices/:id", element: <InvoiceDetailPage />},

  { path: "/dashboard/projects", element: <ProjectList />}
]

export default function App() {


  return (
    <BrowserRouter>
    <Routes>
  {routes.map((route) => (
    <Route key={route.path} path={route.path} element={route.element} />
  ))}
</Routes>
    </BrowserRouter>
  )
}
