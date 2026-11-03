import { lazy } from 'react'
import { GoToStart, NoAccess, RequireAccess } from './components/require-access'
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
import { VendorsPage } from './pages/admin/procurement/vendors'
import { VendorFormPage } from './pages/admin/procurement/vendor-form'
import { PurchaseOrdersPage } from './pages/admin/procurement/purchase-orders'
import { PurchaseOrderFormPage } from './pages/admin/procurement/purchase-order-form'
import { ExpensesPage } from './pages/admin/expenses/expenses'
import { ExpenseFormPage } from './pages/admin/expenses/expense-form'
import { CrewPage } from './pages/admin/crew/crew'
import { CrewFormPage } from './pages/admin/crew/crew-form'
import { CrewSchedulePage } from './pages/admin/crew/schedule'
import { PayrollPage } from './pages/admin/payroll/payroll'
import { PayRunPage } from './pages/admin/payroll/pay-run'
import { UsersPage } from './pages/admin/users/users'
import { UserFormPage } from './pages/admin/users/user-form'

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
  { path: "/dashboard/no-access", element: <NoAccess /> },
  { path: "/dashboard/*", element: <GoToStart /> },
  { path:"/", element: <CompanyProfilePage />},
  { path:"/login", element: <LoginPage /> },

  { path: "/dashboard", element: <RequireAccess module="dashboard"><DashboardPage /></RequireAccess> } ,


  { path: "/dashboard/leads/new", element: <RequireAccess module="leads" action="create"><LeadNewPage /></RequireAccess> },
  { path: "/dashboard/leads/:leadId", element: <RequireAccess module="leads"><LeadDetailPage /></RequireAccess> },
  { path: "/dashboard/leads", element: <RequireAccess module="leads"><LeadsPage /></RequireAccess> },
  
  { path: "/dashboard/invoices", element: <RequireAccess module="invoices"><InvoicePage /></RequireAccess> },
  { path: "/dashboard/invoices/new", element: <RequireAccess module="invoices" action="create"><InvoiceNewPage /></RequireAccess> },
  { path: "/dashboard/invoices/:id", element: <RequireAccess module="invoices"><InvoiceDetailPage /></RequireAccess> },

  { path: "/dashboard/projects", element: <RequireAccess module="projects"><ProjectList /></RequireAccess> },
  { path: "/dashboard/projects/new", element: <RequireAccess module="projects" action="create"><ProjectNew /></RequireAccess> },
  { path: "/dashboard/projects/:id", element: <RequireAccess module="projects"><ProjectDetail /></RequireAccess> },

  { path: "/dashboard/catalog/plans", element: <RequireAccess module="catalog"><CatalogPlansPage /></RequireAccess> },
  { path: "/dashboard/catalog/plans/new", element: <RequireAccess module="catalog" action="create"><CatalogPlanFormPage /></RequireAccess> },
  { path: "/dashboard/catalog/plans/:id", element: <RequireAccess module="catalog"><CatalogPlanFormPage /></RequireAccess> },
  { path: "/dashboard/catalog/packages", element: <RequireAccess module="catalog"><CatalogPackagesPage /></RequireAccess> },
  { path: "/dashboard/catalog/packages/new", element: <RequireAccess module="catalog" action="create"><CatalogPackageFormPage /></RequireAccess> },
  { path: "/dashboard/catalog/packages/:id", element: <RequireAccess module="catalog"><CatalogPackageFormPage /></RequireAccess> },
  { path: "/dashboard/catalog/services", element: <RequireAccess module="catalog"><CatalogServicesPage /></RequireAccess> },

  { path: "/dashboard/vendors", element: <RequireAccess module="vendors"><VendorsPage /></RequireAccess> },
  { path: "/dashboard/vendors/new", element: <RequireAccess module="vendors" action="create"><VendorFormPage /></RequireAccess> },
  { path: "/dashboard/vendors/:id", element: <RequireAccess module="vendors"><VendorFormPage /></RequireAccess> },
  { path: "/dashboard/purchase-orders", element: <RequireAccess module="purchase_orders"><PurchaseOrdersPage /></RequireAccess> },
  { path: "/dashboard/purchase-orders/new", element: <RequireAccess module="purchase_orders" action="create"><PurchaseOrderFormPage /></RequireAccess> },
  { path: "/dashboard/purchase-orders/:id", element: <RequireAccess module="purchase_orders"><PurchaseOrderFormPage /></RequireAccess> },
  { path: "/dashboard/expenses", element: <RequireAccess module="expenses"><ExpensesPage /></RequireAccess> },
  { path: "/dashboard/expenses/new", element: <RequireAccess module="expenses" action="create"><ExpenseFormPage /></RequireAccess> },
  { path: "/dashboard/expenses/:id", element: <RequireAccess module="expenses"><ExpenseFormPage /></RequireAccess> },
  { path: "/dashboard/crew", element: <RequireAccess module="crew"><CrewPage /></RequireAccess> },
  { path: "/dashboard/crew/new", element: <RequireAccess module="crew" action="create"><CrewFormPage /></RequireAccess> },
  { path: "/dashboard/crew/:id", element: <RequireAccess module="crew"><CrewFormPage /></RequireAccess> },
  { path: "/dashboard/crew-schedule", element: <RequireAccess module="crew"><CrewSchedulePage /></RequireAccess> },
  { path: "/dashboard/payroll", element: <RequireAccess module="payroll"><PayrollPage /></RequireAccess> },
  { path: "/dashboard/payroll/:id", element: <RequireAccess module="payroll"><PayRunPage /></RequireAccess> },
  { path: "/dashboard/users", element: <RequireAccess module="users"><UsersPage /></RequireAccess> },
  { path: "/dashboard/users/new", element: <RequireAccess module="users" action="create"><UserFormPage /></RequireAccess> },
  { path: "/dashboard/users/:id", element: <RequireAccess module="users"><UserFormPage /></RequireAccess> },

 
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
