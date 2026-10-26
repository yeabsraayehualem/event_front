import { lazy } from 'react'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { CompanyProfilePage } from './pages/CompanyProfilePage'
import { InvoicePage } from './pages/admin/invoices/invoice-page'
import { InvoiceDetailPage } from './pages/admin/invoices/invoices-detail'
import { ProjectList } from './pages/admin/project/list'
import { ProjectDetail } from './pages/admin/project/detail'

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

  { path: "/dashboard/projects", element: <ProjectList />},
{path:"/dashboard/projects/:id",element: <ProjectDetail />}

 
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
