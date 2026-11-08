import { adminNavigationItems } from "@/components/admin-navigation"
import { useTranslation } from 'react-i18next'
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
    const { t } = useTranslation('projects')

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
                    throw new Error(data?.detail || data?.message || t('list.loadFailed'));
                }
                setProjects(data);
            } catch (error) {
                console.error('Error fetching projects:', error);
            }

            
    }

    useEffect(()=>{
        fetchProjects()
    },[])

    return (
        <>
            <div className="bahran-dashboard flex min-h-screen bg-slate-50">

        <SideNav items={adminNavigationItems} title="Hadafe Nefs" />

        <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="dashboard-date mb-2">{t('list.eyebrow')}</p>
                <h1 className="dashboard-title">{t('list.title')}</h1>
                <p className="dashboard-subtitle">{t('list.subtitle')}</p>
              </div>
            </header>
        

         <section className="invoice-toolbar flex flex-wrap items-center justify-between gap-3 border border-[#e5e1d6] bg-white p-4 shadow-sm" aria-label={t('list.filters')}>
              <input type="search" placeholder={t('list.searchPlaceholder')} aria-label={t('list.searchLabel')} className="min-h-10 w-full max-w-md rounded-lg border border-[#e5e1d6] bg-[#fbfaf7] px-4 text-sm outline-none focus:border-[#71836a]" />
              <button className="min-h-10 rounded-lg border border-[#d8cba8] bg-[#f7f1e2] px-4 text-sm font-medium text-[#802f2b] transition-colors hover:bg-[#f1ead7]">{t('list.filter')}</button>
            </section>


        <section className="invoice-panel dashboard-card mt-5 overflow-x-auto" aria-label={t('list.tableLabel')}>
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.ref')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.event')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.lead')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.startDate')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.endDate')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.status')}</th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">{t('list.columns.actions')}</th>
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

                      <td className="px-6 py-4">{t(`status.${project.status as 'draft'}`, { defaultValue: project.status })}</td>
 <td className="px-6 py-4 ">
                        <Link to={`/dashboard/projects/${project.id}`} className="text-sm font-medium text-[#5b211e] hover:underline">{t('list.view')}</Link>
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