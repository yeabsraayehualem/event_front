import { adminNavigationItems } from "@/components/admin-navigation"
import { useTranslation } from 'react-i18next'
import { SideNav } from "@/components/side-nav"
import { useState,useEffect } from "react"
import { Link } from 'react-router-dom'
import { apiBaseUrl } from '@/lib/api'
import { formatDualDate } from '@/lib/ethiopian-calendar'
    
type InvoiceListItem = {
    id: string
    reference: string
    customer: string
    plan: string
    package: string
    due_date: Date
    total: number
    status: string

}


export const InvoicePage = () =>{
    const { t } = useTranslation('invoices')

    const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
    const fetchInvoices = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/finance/invoices/`, {
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
                setInvoices(data);
            } catch (error) {
                console.error('Error fetching invoices:', error);
            }
        };

    useEffect(() => {
        

        fetchInvoices();
    }, []);

    return (
      <div className="bahran-dashboard flex min-h-screen">
        <SideNav items={adminNavigationItems} title="Hadafe Nefs" />
        <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="dashboard-date mb-2">{t('list.eyebrow')}</p>
                <h1 className="dashboard-title">{t('list.title')}</h1>
                <p className="dashboard-subtitle">{t('list.subtitle')}</p>
              </div>
              <Link to="/dashboard/invoices/new" className="invoice-primary-action inline-flex min-h-10 items-center rounded-lg bg-[#5b211e] px-4 text-sm font-medium text-white transition-colors hover:bg-[#441917]">{t('list.add')} <span className="ml-2 text-[#e1c779]">+</span></Link>
            </header>

            <section className="invoice-toolbar flex flex-wrap items-center justify-between gap-3 border border-[#e5e1d6] bg-white p-4 shadow-sm" aria-label={t('list.filters')}>
              <input type="search" placeholder={t('list.searchPlaceholder')} aria-label={t('list.searchLabel')} className="min-h-10 w-full max-w-md rounded-lg border border-[#e5e1d6] bg-[#fbfaf7] px-4 text-sm outline-none focus:border-[#71836a]" />
              <button className="min-h-10 rounded-lg border border-[#d8cba8] bg-[#f7f1e2] px-4 text-sm font-medium text-[#802f2b] transition-colors hover:bg-[#f1ead7]">{t('list.filter')}</button>
            </section>

            <section className="invoice-panel dashboard-card mt-5 overflow-x-auto" aria-label={t('list.tableLabel')}>
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.id')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.client')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.plan')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.package')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.dueDate')}</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{t('list.columns.status')}</th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">{t('list.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                 {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-[#e5e1d6]">
                      <td className="px-6 py-4">{invoice.reference}</td>
                      <td className="px-6 py-4">{invoice.customer}</td>
                      <td className="px-6 py-4">{invoice.plan}</td>
                      <td className="px-6 py-4">{invoice.package}</td>
                      <td className="px-6 py-4">{formatDualDate(invoice.due_date)}</td>
                      <td className="px-6 py-4 ">{ invoice.status === 'paid' ? <span className="text-green-600 font-semibold">{t('status.paid')}</span> : <span className="text-red-600 font-semibold">{t('status.unpaid')}</span>}</td>
                      <td className="px-6 py-4 ">
                        <Link to={`/dashboard/invoices/${invoice.id}`} className="text-sm font-medium text-[#5b211e] hover:underline">{t('list.view')}</Link>
                        </td>
                    </tr>
                    ))}
                </tbody>
              </table>
            </section>
          </div>
        </main>
      </div>
    )
}
