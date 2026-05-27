import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return `Rs ${asNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function htmlCell(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function monthToRange(monthValue) {
  if (!monthValue) return {};
  const [year, month] = monthValue.split('-').map(Number);
  const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate = new Date(year, month, 0).toISOString().slice(0, 10);
  return { fromDate, toDate };
}

export default function AccountReport() {
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', month: '' });
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (filters.fromDate) params.set('fromDate', filters.fromDate);
    if (filters.toDate) params.set('toDate', filters.toDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/reports/accounts${query}`).then(setReport).catch((err) => setMessage(err.message));
  };

  useEffect(load, [filters.fromDate, filters.toDate]);

  const setMonth = (month) => {
    setFilters({ ...filters, month, ...monthToRange(month) });
  };

  const exportExcel = () => {
    const expenseRows = report?.expenseBreakdown?.map((row) => `<tr><td>${htmlCell(row.category)}</td><td>${htmlCell(row.total)}</td></tr>`).join('');
    const customerRows = report?.topCustomers?.map((row) => `<tr><td>${htmlCell(row.customerName)}</td><td>${htmlCell(row.invoiceCount)}</td><td>${htmlCell(row.revenue)}</td></tr>`).join('');
    const summary = Object.entries(report?.totals || {}).map(([key, value]) => `<tr><td>${htmlCell(key)}</td><td>${htmlCell(value)}</td></tr>`).join('');
    const html = `<h3>Summary</h3><table>${summary}</table><h3>Expense Breakdown</h3><table>${expenseRows}</table><h3>Top Customers</h3><table>${customerRows}</table>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `account-report-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const totals = report?.totals || {};
    const expenseRows = report?.expenseBreakdown?.map((row) => `<tr><td>${htmlCell(row.category)}</td><td>${money(row.total)}</td></tr>`).join('');
    const customerRows = report?.topCustomers?.map((row) => `<tr><td>${htmlCell(row.customerName)}</td><td>${row.invoiceCount}</td><td>${money(row.revenue)}</td></tr>`).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Account Report</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin-bottom:18px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}</style></head><body><h1>Account Report</h1><p>${report?.filters?.fromDate} to ${report?.filters?.toDate}</p><h3>Summary</h3><table><tbody><tr><td>Total Sales</td><td>${money(totals.totalSales)}</td></tr><tr><td>Total Collections</td><td>${money(totals.totalCollections)}</td></tr><tr><td>Outstanding / Receivables</td><td>${money(totals.outstanding)}</td></tr><tr><td>Total Expenses</td><td>${money(totals.totalExpenses)}</td></tr><tr><td>GST Payable</td><td>${money(totals.gstPayable)}</td></tr><tr><td>Gross Profit / Loss</td><td>${money(totals.grossProfit)}</td></tr><tr><td>Net Profit After GST</td><td>${money(totals.netProfitAfterGst)}</td></tr></tbody></table><h3>Expense Breakdown</h3><table><tbody>${expenseRows}</tbody></table><h3>Top Customers</h3><table><thead><tr><th>Customer</th><th>Invoices</th><th>Revenue</th></tr></thead><tbody>${customerRows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const totals = report?.totals || {};

  return (
    <div>
      <PageHeader title="Account Report" subtitle="Income, expenditure, receivables, GST, and profit summary" />

      <section className="panel">
        <h3>Report Filters</h3>
        <div className="form-grid">
          <label>From Date<input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value, month: '' })} /></label>
          <label>To Date<input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value, month: '' })} /></label>
          <label>Month / Year<input type="month" value={filters.month} onChange={(e) => setMonth(e.target.value)} /></label>
          <button type="button" className="btn-ghost" onClick={() => setFilters({ fromDate: '', toDate: '', month: '' })}>Clear Filters</button>
        </div>
      </section>

      {message && <p className="form-error">{message}</p>}

      <section className="panel">
        <div className="panel-toolbar stockin-toolbar">
          <h3>Financial Summary</h3>
          <div className="export-actions">
            <button type="button" className="btn-ghost" onClick={exportExcel}>Export Excel</button>
            <button type="button" className="btn-ghost" onClick={exportPdf}>Print / PDF</button>
          </div>
        </div>
        <div className="report-summary">
          <span>Total Sales (Revenue) <strong>{money(totals.totalSales)}</strong></span>
          <span>Total Collections <strong>{money(totals.totalCollections)}</strong></span>
          <span>Outstanding / Receivables <strong>{money(totals.outstanding)}</strong></span>
          <span>Total Expenses <strong>{money(totals.totalExpenses)}</strong></span>
          <span>GST Payable <strong>{money(totals.gstPayable)}</strong></span>
          <span>Gross Profit / Loss <strong>{money(totals.grossProfit)}</strong></span>
          <span>Net Profit (after GST) <strong>{money(totals.netProfitAfterGst)}</strong></span>
        </div>
      </section>

      <section className="panel">
        <h3>Expense Breakdown by Category</h3>
        <div className="running-total-grid">
          {report?.expenseBreakdown?.map((row) => (
            <div className="running-total" key={row.category}>
              <span>{row.category.replace('_', ' ')}</span>
              <strong>{money(row.total)}</strong>
            </div>
          ))}
          {!report?.expenseBreakdown?.length && <p className="form-note">No expenses found.</p>}
        </div>
      </section>

      <section className="panel">
        <h3>Top Customers by Revenue</h3>
        <table className="data-table">
          <thead><tr><th>Rank</th><th>Customer</th><th>Invoices</th><th>Revenue</th></tr></thead>
          <tbody>
            {report?.topCustomers?.map((customer, index) => (
              <tr key={customer.customerId || customer.customerName}>
                <td>{index + 1}</td>
                <td>{customer.customerName}</td>
                <td>{customer.invoiceCount}</td>
                <td>{money(customer.revenue)}</td>
              </tr>
            ))}
            {!report?.topCustomers?.length && <tr><td colSpan="4">No customer revenue found.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
