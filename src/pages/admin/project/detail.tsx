import { adminNavigationItems } from "@/components/admin-navigation"
import { SideNav } from "@/components/side-nav"
import { Link } from "react-router-dom"


export const ProjectDetail = () =>{


    return (
        <>
  <div className="bahran-dashboard flex min-h-screen">
      <SideNav items={adminNavigationItems} title="Bahran Events" />
      <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link to="/dashboard/invoices" className="record-form-back inline-flex items-center gap-2">
              <span aria-hidden="true">←</span> Back to invoices
            </Link>
        </div>
    </div>


     <header className="mb-6 mt-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="dashboard-date mb-2">Project details</p>
                  <h1 className="dashboard-title">P-001</h1>
                  <p className="dashboard-subtitle">Abel Girma - Shemglena</p>
                </div>
               
              </header>
    </main>
    </div>
        
        
        
        </>
    )
}