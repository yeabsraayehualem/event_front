import { lazy, Suspense } from 'react'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { CompanyProfilePage } from './pages/CompanyProfilePage'

const DashboardPage = lazy(() =>
  import('./pages/admin/dashboard').then((module) => ({
    default: module.DashboardPage,
  }))
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CompanyProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard/*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
              <DashboardPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
