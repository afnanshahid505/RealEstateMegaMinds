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

function number(value) {
  return asNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function htmlCell(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export default function StockReport() {
  const [filters, setFilters] = useState({ fromDate: '', toDate: '' });
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/reports/stock-movements${query}`).then(setReport).catch((err) => setMessage(err.message));
  };

  useEffect(load, [filters]);

  const rowsHtml = () => report?.rows?.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${htmlCell(row.billNo)}</td>
      <td>${htmlCell(row.date)}</td>
      <td>${htmlCell(row.customer)}</td>
      <td>${htmlCell(row.productName)}</td>
      <td>${htmlCell(row.quantity)}</td>
      <td>${htmlCell(row.grandTotal)}</td>
      <td>${htmlCell(row.paidAmount)}</td>
      <td>${htmlCell(row.balance)}</td>
    </tr>
  `).join('') || '';

  const summaryHtml = () => `
    <table>
      <tbody>
        <tr><td>Total Quantity</td><td>${number(report?.totals?.quantity)}</td></tr>
        <tr><td>Total Grand Total</td><td>${money(report?.totals?.grandTotal)}</td></tr>
        <tr><td>Total Paid</td><td>${money(report?.totals?.paidAmount)}</td></tr>
        <tr><td>Total Balance</td><td>${money(report?.totals?.balance)}</td></tr>
      </tbody>
    </table>
  `;

  const exportExcel = () => {
    const html = `<h3>Stock Report</h3>${summaryHtml()}<table><thead><tr><th>S.No</th><th>Bill No</th><th>Date</th><th>Customer</th><th>Product</th><th>Quantity</th><th>Grand Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${rowsHtml()}</tbody></table>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-report-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Stock Report</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}</style></head><body><h1>Stock Report</h1><p>${htmlCell(report?.filters?.fromDate)} to ${htmlCell(report?.filters?.toDate)}</p>${summaryHtml()}<table><thead><tr><th>S.No</th><th>Bill No</th><th>Date</th><th>Customer</th><th>Product</th><th>Quantity</th><th>Grand Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${rowsHtml()}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div>
      <PageHeader title="Stock Report" subtitle="Stock movements and sales report" />

      <section className="panel">
        <h3>Report Filters</h3>
        <div className="form-grid">
          <label>From Date<input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} /></label>
          <label>To Date<input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} /></label>
          <button type="button" className="btn-ghost" onClick={() => setFilters({ fromDate: '', toDate: '' })}>Clear Filters</button>
        </div>
      </section>

      {message && <p className="form-error">{message}</p>}

      <section className="panel">
        <div className="panel-toolbar stockin-toolbar">
          <h3>Summary</h3>
          <div className="export-actions">
            <button type="button" className="btn-ghost" onClick={exportExcel}>Export Excel</button>
            <button type="button" className="btn-ghost" onClick={printReport}>Export PDF / Print</button>
          </div>
        </div>
        <div className="report-summary">
          <span>Total Quantity <strong>{number(report?.totals?.quantity)}</strong></span>
          <span>Grand Total <strong>{money(report?.totals?.grandTotal)}</strong></span>
          <span>Paid <strong>{money(report?.totals?.paidAmount)}</strong></span>
          <span>Balance <strong>{money(report?.totals?.balance)}</strong></span>
        </div>
      </section>

      <section className="panel">
        <h3>Report Line Items</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>S.No</th><th>Bill No</th><th>Date</th><th>Customer</th><th>Product</th><th>Quantity</th><th>Grand Total</th><th>Paid</th><th>Balance</th></tr></thead>
            <tbody>
              {report?.rows?.map((row, index) => (
                <tr key={`${row.billNo}-${row.productId}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{row.billNo}</td>
                  <td>{row.date}</td>
                  <td>{row.customer}</td>
                  <td>{row.productName}</td>
                  <td>{number(row.quantity)}</td>
                  <td>{money(row.grandTotal)}</td>
                  <td>{money(row.paidAmount)}</td>
                  <td>{money(row.balance)}</td>
                </tr>
              ))}
              {!report?.rows?.length && <tr><td colSpan="9">No sales records found.</td></tr>}
            </tbody>
            <tfoot>
              <tr><td colSpan="5"><strong>Totals</strong></td><td><strong>{number(report?.totals?.quantity)}</strong></td><td><strong>{money(report?.totals?.grandTotal)}</strong></td><td><strong>{money(report?.totals?.paidAmount)}</strong></td><td><strong>{money(report?.totals?.balance)}</strong></td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="panel">
        <h3>Monthly Sales</h3>
        <table className="data-table">
          <thead><tr><th>Month</th><th>Total Sales</th></tr></thead>
          <tbody>{report?.monthlySales?.map((row) => <tr key={row.month}><td>{row.month}</td><td>{money(row.total)}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Top Product Sales</h3>
        <table className="data-table">
          <thead><tr><th>Product</th><th>Quantity</th><th>Value</th></tr></thead>
          <tbody>{report?.topProducts?.map((row) => <tr key={row.productId}><td>{row.productName}</td><td>{number(row.quantity)}</td><td>{money(row.grandTotal)}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Estimated Raw Material Used</h3>
        <table className="data-table">
          <thead><tr><th>Raw Material</th><th>Quantity Used</th></tr></thead>
          <tbody>{report?.estimatedRawMaterials?.map((row) => <tr key={row.rawMaterialId}><td>{row.name}</td><td>{number(row.quantityUsed)} {row.unit}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
