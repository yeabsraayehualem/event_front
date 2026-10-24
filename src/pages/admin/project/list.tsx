import { adminNavigationItems } from "@/components/admin-navigation"
import { SideNav } from "@/components/side-nav"


export const ProjectList = ()=>{

    return (
        <>
            <div className="bahran-dashboard flex min-h-screen bg-slate-50">

        <SideNav items={adminNavigationItems} title="Bahran Events" />

        <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="dashboard-date mb-2">Projects Workspace</p>
                <h1 className="dashboard-title">Projects</h1>
                <p className="dashboard-subtitle">Manage customer projects and tasks.</p>
              </div>
            </header>
        </div>


        <section className="invoice-panel dashboard-card mt-5 overflow-x-auto" aria-label="Invoices">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Ref</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Event</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Lead</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Start Date</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">End date</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                
                </tbody>
              </table>
            </section>


        </main>

        </div>
        </>
    )
}