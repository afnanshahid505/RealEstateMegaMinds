import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

const UNIT_OPTIONS = ['PCS', 'K', 'LOT'];

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({
    name: '',
    sellingPrice: '',
    gstPercent: '',
    hsnCode: '',
    sku: '',
    unitType: 'PCS',
  });
  const [message, setMessage] = useState('');

  const load = () => {
    const q = filter ? `?status=${filter}` : '';
    api(`/products${q}`).then(setProducts).catch((e) => setMessage(e.message));
  };

  useEffect(load, [filter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api('/products', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          sellingPrice: parseFloat(form.sellingPrice),
          gstPercent: parseFloat(form.gstPercent),
        }),
      });
      setForm({ name: '', sellingPrice: '', gstPercent: '', hsnCode: '', sku: '', unitType: 'PCS' });
      setMessage('Product created — pending approval workflow complete after you approve.');
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const approve = async (id) => {
    await api(`/products/${id}/approve`, { method: 'PATCH' });
    load();
  };

  const reject = async (id) => {
    await api(`/products/${id}/reject`, { method: 'PATCH' });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Create standardized product catalog — approve before factory use"
      />

      <section className="panel">
        <h3>Create Product (Admin)</h3>
        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            Product Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Selling Price (₹)
            <input type="number" step="0.01" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required />
          </label>
          <label>
            GST %
            <input type="number" step="0.01" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} required />
          </label>
          <label>
            HSN Code
            <input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} required />
          </label>
          <label>
            SKU / Product Code
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          </label>
          <label>
            Unit Type
            <select value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value })}>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary">Create Product</button>
        </form>
        {message && <p className="form-note">{message}</p>}
      </section>

      <section className="panel">
        <div className="panel-toolbar">
          <h3>Product Catalog</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th>GST</th>
              <th>HSN</th>
              <th>SKU</th>
              <th>Unit</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>₹{p.sellingPrice}</td>
                <td>{p.gstPercent}%</td>
                <td>{p.hsnCode}</td>
                <td>{p.sku}</td>
                <td>{p.unitType}</td>
                <td>{p.stockQty}</td>
                <td><span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                <td>
                  {p.status === 'PENDING' && (
                    <>
                      <button type="button" className="btn-sm btn-primary" onClick={() => approve(p.id)}>Approve</button>
                      <button type="button" className="btn-sm btn-ghost" onClick={() => reject(p.id)}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
