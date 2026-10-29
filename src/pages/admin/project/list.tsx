import { adminNavigationItems } from "@/components/admin-navigation"
import { SideNav } from "@/components/side-nav"
import { apiBaseUrl } from "@/lib/api"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { formatDualDate } from '@/lib/ethiopian-calendar'


type ProjectItems = {
    id: number
    name:string
    event_name: string
    start_date: Date
    end_date: Date
    lead_name: string 
    status: string 

}

export const ProjectList = ()=>{

    const [projects,setProjects] = useState<ProjectItems[]>([])


    const fetchProjects = async () =>{
        try{ 
             const response = await fetch(`${apiBaseUrl}/event/projects/`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        Accept: 'application/json',
                    },
                });

               const data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.detail || data?.message || 'Could not load invoices.');
                }
                setProjects(data);
            } catch (error) {
                console.error('Error fetching invoices:', error);
            }

            
    }

    useEffect(()=>{
        fetchProjects()
    },[])

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
              <Link to="/dashboard/projects/new" className="invoice-primary-action inline-flex min-h-10 items-center rounded-lg bg-[#28513c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1d3d2c]">New project <span className="ml-2 text-[#e1c779]">+</span></Link>
            </header>
        

         <section className="invoice-toolbar flex flex-wrap items-center justify-between gap-3 border border-[#e5e1d6] bg-white p-4 shadow-sm" aria-label="Invoice filters">
              <input type="search" placeholder="Search invoices…" aria-label="Search invoices" className="min-h-10 w-full max-w-md rounded-lg border border-[#e5e1d6] bg-[#fbfaf7] px-4 text-sm outline-none focus:border-[#71836a]" />
              <button className="min-h-10 rounded-lg border border-[#d8cba8] bg-[#f7f1e2] px-4 text-sm font-medium text-[#53614a] transition-colors hover:bg-[#f1ead7]">Filter</button>
            </section>


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
                {
                    projects.map((project) =>
                      (   
                    <tr key={project.id} className="border-t border-[#e5e1d6]"> 
                      <td className="px-6 py-4">{project.name}</td>
                    <td className="px-6 py-4">{project.event_name}</td>
                      <td className="px-6 py-4">{project.lead_name}</td>

                      <td className="px-6 py-4">{formatDualDate(project.start_date)}</td>

                      <td className="px-6 py-4">{formatDualDate(project.end_date)}</td>

                      <td className="px-6 py-4">{project.status.toUpperCase()}</td>
 <td className="px-6 py-4 ">
                        <Link to={`/dashboard/projects/${project.id}`} className="text-sm font-medium text-[#28513c] hover:underline">View</Link>
                        </td>

                         </tr>
                         )
                    )
                }
                </tbody>
              </table>
            </section>

</div>
        </main>

        </div>
        </>
    )
}