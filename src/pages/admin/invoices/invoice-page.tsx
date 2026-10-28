import { adminNavigationItems } from "@/components/admin-navigation"
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
                    throw new Error(data?.detail || data?.message || 'Could not load invoices.');
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
        <SideNav items={adminNavigationItems} title="Bahran Events" />
        <main className="bahran-dashboard-main min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="dashboard-date mb-2">Billing workspace</p>
                <h1 className="dashboard-title">Invoices</h1>
                <p className="dashboard-subtitle">Manage customer invoices and payments.</p>
              </div>
              <button className="invoice-primary-action min-h-10 rounded-lg bg-[#28513c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1d3d2c]">Add invoice <span className="ml-2 text-[#e1c779]">+</span></button>
            </header>

            <section className="invoice-toolbar flex flex-wrap items-center justify-between gap-3 border border-[#e5e1d6] bg-white p-4 shadow-sm" aria-label="Invoice filters">
              <input type="search" placeholder="Search invoices…" aria-label="Search invoices" className="min-h-10 w-full max-w-md rounded-lg border border-[#e5e1d6] bg-[#fbfaf7] px-4 text-sm outline-none focus:border-[#71836a]" />
              <button className="min-h-10 rounded-lg border border-[#d8cba8] bg-[#f7f1e2] px-4 text-sm font-medium text-[#53614a] transition-colors hover:bg-[#f1ead7]">Filter</button>
            </section>

            <section className="invoice-panel dashboard-card mt-5 overflow-x-auto" aria-label="Invoices">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Invoice ID</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Client</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Plan</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Package</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Due date</th>
                    <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
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
                      <td className="px-6 py-4 ">{ invoice.status === 'paid' ? <span className="text-green-600 font-semibold">Paid</span> : <span className="text-red-600 font-semibold">Unpaid</span>}</td>
                      <td className="px-6 py-4 ">
                        <Link to={`/dashboard/invoices/${invoice.id}`} className="text-sm font-medium text-[#28513c] hover:underline">View</Link>
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
