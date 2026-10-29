import { lazy } from 'react'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { CompanyProfilePage } from './pages/CompanyProfilePage'
import { InvoicePage } from './pages/admin/invoices/invoice-page'
import { InvoiceDetailPage } from './pages/admin/invoices/invoices-detail'
import { ProjectList } from './pages/admin/project/list'
import { ProjectDetail } from './pages/admin/project/detail'
import { ProjectNew } from './pages/admin/project/new'
import { InvoiceNewPage } from './pages/admin/invoices/invoice-new'
import { LeadNewPage } from './pages/admin/lead/lead-new'
import { CatalogPlansPage } from './pages/admin/catalog/plans'
import { CatalogPlanFormPage } from './pages/admin/catalog/plan-form'
import { CatalogPackagesPage } from './pages/admin/catalog/packages'
import { CatalogPackageFormPage } from './pages/admin/catalog/package-form'
import { CatalogServicesPage } from './pages/admin/catalog/services'

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


  { path: "/dashboard/leads/new", element: <LeadNewPage /> },
  { path: "/dashboard/leads/:leadId", element: <LeadDetailPage /> },
  { path: "/dashboard/leads", element: <LeadsPage />},
  
  { path: "/dashboard/invoices", element: <InvoicePage /> },
  { path: "/dashboard/invoices/new", element: <InvoiceNewPage /> },
  { path: "/dashboard/invoices/:id", element: <InvoiceDetailPage />},

  { path: "/dashboard/projects", element: <ProjectList />},
  { path: "/dashboard/projects/new", element: <ProjectNew /> },
  { path: "/dashboard/projects/:id", element: <ProjectDetail /> },

  { path: "/dashboard/catalog/plans", element: <CatalogPlansPage /> },
  { path: "/dashboard/catalog/plans/new", element: <CatalogPlanFormPage /> },
  { path: "/dashboard/catalog/plans/:id", element: <CatalogPlanFormPage /> },
  { path: "/dashboard/catalog/packages", element: <CatalogPackagesPage /> },
  { path: "/dashboard/catalog/packages/new", element: <CatalogPackageFormPage /> },
  { path: "/dashboard/catalog/packages/:id", element: <CatalogPackageFormPage /> },
  { path: "/dashboard/catalog/services", element: <CatalogServicesPage /> },

 
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
