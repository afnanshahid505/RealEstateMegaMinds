import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return asNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function htmlCell(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function materialSummary(materials) {
  if (!materials?.length) return '-';
  return materials.map((m) => `${m.name}: ${formatNumber(m.quantity)} ${m.unit || ''}`).join(', ');
}

function summaryRows(report) {
  return [
    ['Period Total Bricks', formatNumber(report?.totals?.totalBricks)],
    ['Total Cement Bags', formatNumber(report?.totals?.totalBags)],
    ['Overall Bags / 1000', formatNumber(report?.totals?.overallBagsPer1000)],
    ['Overall Bricks / Bag', formatNumber(report?.totals?.overallBricksPerBag)],
    ['Previous Bricks', formatNumber(report?.previousTotals?.totalBricks)],
    ['Trend Bricks', formatNumber(report?.comparison?.bricksChange)],
    ['Trend Bags', formatNumber(report?.comparison?.bagsChange)],
    ['Efficiency Change', formatNumber(report?.comparison?.efficiencyChange)],
  ];
}

export default function ProductionReport() {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', productId: '' });
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');

  const load = () => {
    api('/products?status=APPROVED').then(setProducts);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/reports/production${query}`).then(setReport).catch((err) => setMessage(err.message));
  };

  useEffect(load, [filters]);

  const exportExcel = () => {
    const summary = summaryRows(report).map(([label, value]) => `
      <tr><td>${htmlCell(label)}</td><td>${htmlCell(value)}</td></tr>
    `).join('');
    const rows = report?.rows?.map((row) => `
      <tr>
        <td>${htmlCell(row.date)}</td>
        <td>${htmlCell(row.productName)}</td>
        <td>${htmlCell(row.totalBricks)}</td>
        <td>${htmlCell(row.cementBags)}</td>
        <td>${htmlCell(row.avgBagsPer1000)}</td>
        <td>${htmlCell(row.avgBricksPerBag)}</td>
        <td>${htmlCell(materialSummary(row.otherMaterials))}</td>
      </tr>
    `).join('');
    const html = `
      <h3>Production Report</h3>
      <p>${htmlCell(report?.filters?.fromDate)} to ${htmlCell(report?.filters?.toDate)}</p>
      <table><thead><tr><th>Summary</th><th>Value</th></tr></thead><tbody>${summary}</tbody></table>
      <table>
        <thead><tr><th>Date</th><th>Brick Type</th><th>Total Bricks</th><th>Cement Bags</th><th>Bags / 1000</th><th>Bricks / Bag</th><th>Other Materials</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2"><strong>Summary Row</strong></td><td><strong>${formatNumber(report?.totals?.totalBricks)}</strong></td><td><strong>${formatNumber(report?.totals?.totalBags)}</strong></td><td><strong>${formatNumber(report?.totals?.overallBagsPer1000)}</strong></td><td><strong>${formatNumber(report?.totals?.overallBricksPerBag)}</strong></td><td></td></tr></tfoot>
      </table>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `production-report-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const summary = summaryRows(report).map(([label, value]) => `
      <tr><td>${htmlCell(label)}</td><td>${htmlCell(value)}</td></tr>
    `).join('');
    const rows = report?.rows?.map((row) => `
      <tr><td>${htmlCell(row.date)}</td><td>${htmlCell(row.productName)}</td><td>${formatNumber(row.totalBricks)}</td><td>${formatNumber(row.cementBags)}</td><td>${formatNumber(row.avgBagsPer1000)}</td><td>${formatNumber(row.avgBricksPerBag)}</td><td>${htmlCell(materialSummary(row.otherMaterials))}</td></tr>
    `).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Production Report</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.summary-table{max-width:520px}</style></head><body><h1>Production Report</h1><p>${htmlCell(report?.filters?.fromDate)} to ${htmlCell(report?.filters?.toDate)}</p><h3>Summary</h3><table class="summary-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${summary}</tbody></table><h3>Report Line Items</h3><table><thead><tr><th>Date</th><th>Brick Type</th><th>Total Bricks</th><th>Cement Bags</th><th>Bags / 1000</th><th>Bricks / Bag</th><th>Other Materials</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2"><strong>Summary Row</strong></td><td><strong>${formatNumber(report?.totals?.totalBricks)}</strong></td><td><strong>${formatNumber(report?.totals?.totalBags)}</strong></td><td><strong>${formatNumber(report?.totals?.overallBagsPer1000)}</strong></td><td><strong>${formatNumber(report?.totals?.overallBricksPerBag)}</strong></td><td></td></tr></tfoot></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div>
      <PageHeader title="Production Report" subtitle="Production efficiency and material utilization over time" />

      <section className="panel">
        <h3>Report Filters</h3>
        <div className="form-grid">
          <label>From Date<input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} /></label>
          <label>To Date<input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} /></label>
          <label>Product / Brick Type<select value={filters.productId} onChange={(e) => setFilters({ ...filters, productId: e.target.value })}><option value="">All products</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <button type="button" className="btn-ghost" onClick={() => setFilters({ fromDate: '', toDate: '', productId: '' })}>Clear Filters</button>
        </div>
      </section>

      {message && <p className="form-error">{message}</p>}

      <section className="panel">
        <div className="panel-toolbar stockin-toolbar">
          <h3>Summary</h3>
          <div className="export-actions">
            <button type="button" className="btn-ghost" onClick={exportExcel}>Export Excel</button>
            <button type="button" className="btn-ghost" onClick={exportPdf}>Export PDF</button>
          </div>
        </div>
        <div className="report-summary">
          <span>Period Total Bricks <strong>{formatNumber(report?.totals?.totalBricks)}</strong></span>
          <span>Total Cement Bags <strong>{formatNumber(report?.totals?.totalBags)}</strong></span>
          <span>Overall Bags / 1000 <strong>{formatNumber(report?.totals?.overallBagsPer1000)}</strong></span>
          <span>Overall Bricks / Bag <strong>{formatNumber(report?.totals?.overallBricksPerBag)}</strong></span>
          <span>Previous Bricks <strong>{formatNumber(report?.previousTotals?.totalBricks)}</strong></span>
          <span>Trend Bricks <strong>{formatNumber(report?.comparison?.bricksChange)}</strong></span>
          <span>Trend Bags <strong>{formatNumber(report?.comparison?.bagsChange)}</strong></span>
          <span>Efficiency Change <strong>{formatNumber(report?.comparison?.efficiencyChange)}</strong></span>
        </div>
      </section>

      <section className="panel">
        <h3>Report Line Items</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Brick Type</th>
                <th>Total Bricks Produced</th>
                <th>Cement Bags Used</th>
                <th>Avg Bags / 1000 Bricks</th>
                <th>Avg Bricks / Bag</th>
                <th>Other Materials Used</th>
              </tr>
            </thead>
            <tbody>
              {report?.rows?.map((row) => (
                <tr key={`${row.date}-${row.productId}`}>
                  <td>{row.date}</td>
                  <td>{row.productName}</td>
                  <td>{formatNumber(row.totalBricks)}</td>
                  <td>{formatNumber(row.cementBags)}</td>
                  <td>{formatNumber(row.avgBagsPer1000)}</td>
                  <td>{formatNumber(row.avgBricksPerBag)}</td>
                  <td>{materialSummary(row.otherMaterials)}</td>
                </tr>
              ))}
              {!report?.rows?.length && <tr><td colSpan="7">No production records found.</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="2"><strong>Summary Row</strong></td>
                <td><strong>{formatNumber(report?.totals?.totalBricks)}</strong></td>
                <td><strong>{formatNumber(report?.totals?.totalBags)}</strong></td>
                <td><strong>{formatNumber(report?.totals?.overallBagsPer1000)}</strong></td>
                <td><strong>{formatNumber(report?.totals?.overallBricksPerBag)}</strong></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
