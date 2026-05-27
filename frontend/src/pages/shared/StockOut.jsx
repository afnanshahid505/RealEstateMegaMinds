import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

const MANUAL_REASONS = ['DAMAGE', 'SAMPLE', 'TRANSFER', 'ADJUSTMENT'];

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '';
}

export default function StockOutPage() {
  const [products, setProducts] = useState([]);
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', productId: '' });
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    productId: '',
    quantity: '',
    reason: 'DAMAGE',
    referenceNumber: '',
    note: '',
  });
  const [message, setMessage] = useState('');

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const selectedProduct = productById.get(form.productId);

  const load = () => {
    api('/products?status=APPROVED').then(setProducts);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/stock-out${query}`).then(setRecords);
  };

  useEffect(load, [filters]);

  const reasonTotals = useMemo(() => {
    const totals = new Map();
    records.forEach((record) => totals.set(record.reason, (totals.get(record.reason) || 0) + asNumber(record.quantity)));
    return [...totals.entries()];
  }, [records]);

  const rowsWithBalance = useMemo(() => {
    const currentStock = new Map(products.map((product) => [product.id, asNumber(product.stockQty)]));
    return [...records]
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt))
      .map((record) => {
        const productId = record.productId || record.product?.id;
        const balanceAfter = currentStock.get(productId) ?? asNumber(record.product?.stockQty);
        currentStock.set(productId, balanceAfter + asNumber(record.quantity));
        return { ...record, balanceAfter };
      });
  }, [records, products]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api('/stock-out', {
        method: 'POST',
        body: JSON.stringify({ ...form, quantity: asNumber(form.quantity) }),
      });
      setForm((current) => ({ ...current, quantity: '', referenceNumber: '', note: '' }));
      setMessage('Stock Out recorded.');
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="Stock Out" subtitle="Track dispatched inventory, manual adjustments, and invoice-linked stock movement" />

      <section className="panel">
        <h3>Create Stock Out Entry</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <label>Product<select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label>Available Stock<input value={selectedProduct ? selectedProduct.stockQty : '-'} readOnly /></label>
          <label>Quantity<input type="number" value={form.quantity} max={selectedProduct?.stockQty || undefined} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label>
          <label>Reason / Type<select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>{MANUAL_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label>
          <label>Reference<input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="Invoice / transfer ref" /></label>
          <label className="span-2">Note<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Vehicle, destination, reason..." /></label>
          <button type="submit" className="btn-primary">Record Stock Out</button>
        </form>
        {message && <p className="form-note">{message}</p>}
      </section>

      <section className="panel">
        <h3>Reason-wise Summary</h3>
        <div className="running-total-grid">
          {reasonTotals.map(([reason, total]) => (
            <div className="running-total" key={reason}><span>{reason}</span><strong>-{total}</strong></div>
          ))}
          {reasonTotals.length === 0 && <p className="form-note">No stock out records in this view.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-toolbar stockin-toolbar">
          <h3>View All Stock Out</h3>
        </div>
        <div className="form-grid filter-grid">
          <label>From Date<input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} /></label>
          <label>To Date<input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} /></label>
          <label>Product<select value={filters.productId} onChange={(e) => setFilters({ ...filters, productId: e.target.value })}><option value="">All products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <button type="button" className="btn-ghost" onClick={() => setFilters({ fromDate: '', toDate: '', productId: '' })}>Clear Filters</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Product</th><th>Qty Out</th><th>Reason</th><th>Reference</th><th>Running Balance</th><th>Note</th></tr></thead>
            <tbody>
              {rowsWithBalance.map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.date)}</td>
                  <td>{record.product?.name}</td>
                  <td className="text-warn">-{record.quantity}</td>
                  <td><span className="badge">{record.reason}</span></td>
                  <td>{record.referenceNumber || record.invoice?.invoiceNumber || '-'}</td>
                  <td>{record.balanceAfter}</td>
                  <td>{record.note || '-'}</td>
                </tr>
              ))}
              {rowsWithBalance.length === 0 && <tr><td colSpan="7">No stock out records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
