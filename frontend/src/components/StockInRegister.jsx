import { useMemo } from 'react';

const STOCK_IN_SOURCES = ['PRODUCTION', 'PURCHASE', 'TRANSFER', 'ADJUSTMENT'];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '';
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function csvValue(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function buildExportRows(records, includeEnteredBy) {
  return records.map((record) => ({
    date: formatDate(record.date),
    product: record.product?.name || '',
    quantity: asNumber(record.quantity),
    source: record.source,
    reference: record.referenceNumber,
    runningTotal: asNumber(record.runningTotal),
    enteredBy: includeEnteredBy ? record.enteredBy?.name || '-' : undefined,
  }));
}

function htmlCell(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function StockInRegister({
  records,
  products,
  filters,
  onFilterChange,
  includeEnteredBy = false,
  title = 'Stock In Register',
}) {
  const rowsWithTotals = useMemo(() => {
    const totals = new Map();
    return [...records]
      .sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt))
      .map((record) => {
        const productKey = record.productId || record.product?.id || record.product?.name || 'unknown';
        const runningTotal = (totals.get(productKey) || 0) + asNumber(record.quantity);
        totals.set(productKey, runningTotal);
        return { ...record, runningTotal };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));
  }, [records]);

  const productTotals = useMemo(() => {
    const totals = new Map();
    rowsWithTotals.forEach((record) => {
      const productName = record.product?.name || 'Unknown product';
      totals.set(productName, (totals.get(productName) || 0) + asNumber(record.quantity));
    });
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rowsWithTotals]);

  const exportRows = buildExportRows(rowsWithTotals, includeEnteredBy);

  const handleExportCsv = () => {
    const headers = ['Date', 'Product', 'Quantity', 'Source', 'Reference', 'Running Total'];
    if (includeEnteredBy) headers.push('Entered By');

    const lines = [
      headers.map(csvValue).join(','),
      ...exportRows.map((row) => {
        const values = [row.date, row.product, row.quantity, row.source, row.reference, row.runningTotal];
        if (includeEnteredBy) values.push(row.enteredBy);
        return values.map(csvValue).join(',');
      }),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-in-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const headers = ['Date', 'Product', 'Quantity', 'Source', 'Reference', 'Running Total'];
    if (includeEnteredBy) headers.push('Entered By');

    const tableRows = exportRows.map((row) => {
      const values = [row.date, row.product, `+${row.quantity}`, row.source, row.reference, row.runningTotal];
      if (includeEnteredBy) values.push(row.enteredBy);
      return `<tr>${values.map((value) => `<td>${htmlCell(value)}</td>`).join('')}</tr>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Stock In Register</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            p { margin-top: 0; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Stock In Register</h1>
          <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
          <table>
            <thead><tr>${headers.map((header) => `<th>${htmlCell(header)}</th>`).join('')}</tr></thead>
            <tbody>${tableRows || `<tr><td colspan="${headers.length}">No stock in records found.</td></tr>`}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <section className="panel">
      <div className="panel-toolbar stockin-toolbar">
        <h3>{title}</h3>
        <div className="export-actions">
          <button type="button" className="btn-ghost" onClick={handleExportCsv}>Export CSV</button>
          <button type="button" className="btn-ghost" onClick={handleExportPdf}>Export PDF</button>
        </div>
      </div>

      <div className="form-grid filter-grid">
        <label>
          From Date
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => onFilterChange({ ...filters, fromDate: e.target.value })}
          />
        </label>
        <label>
          To Date
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => onFilterChange({ ...filters, toDate: e.target.value })}
          />
        </label>
        <label>
          Product
          <select
            value={filters.productId}
            onChange={(e) => onFilterChange({ ...filters, productId: e.target.value })}
          >
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </label>
        <label>
          Source Type
          <select
            value={filters.source}
            onChange={(e) => onFilterChange({ ...filters, source: e.target.value })}
          >
            <option value="">All sources</option>
            {STOCK_IN_SOURCES.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => onFilterChange({ fromDate: '', toDate: '', productId: '', source: '' })}
        >
          Clear Filters
        </button>
      </div>

      {productTotals.length > 0 && (
        <div className="running-total-grid">
          {productTotals.map(([productName, total]) => (
            <div className="running-total" key={productName}>
              <span>{productName}</span>
              <strong>+{total}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Source</th>
              <th>Reference</th>
              <th>Running Total</th>
              {includeEnteredBy && <th>Entered By</th>}
            </tr>
          </thead>
          <tbody>
            {rowsWithTotals.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.date)}</td>
                <td>{record.product?.name}</td>
                <td className="text-success">+{record.quantity}</td>
                <td><span className="badge">{record.source}</span></td>
                <td>{record.referenceNumber}</td>
                <td className="text-success">+{record.runningTotal}</td>
                {includeEnteredBy && <td>{record.enteredBy?.name || '-'}</td>}
              </tr>
            ))}
            {rowsWithTotals.length === 0 && (
              <tr>
                <td colSpan={includeEnteredBy ? 7 : 6}>No stock in records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
