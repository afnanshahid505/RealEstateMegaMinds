import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

const UNIT_OPTIONS = ['PCS', 'K', 'LOT'];

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ name: '', hsn: '', status: '' });
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({ sellingPrice: '', gstPercent: '', description: '', isActive: true });
  const [form, setForm] = useState({
    name: '',
    description: '',
    sellingPrice: '',
    gstPercent: '',
    hsnCode: '',
    sku: '',
    unitType: 'PCS',
    isActive: true,
  });
  const [message, setMessage] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (filters.name) params.set('name', filters.name);
    if (filters.hsn) params.set('hsn', filters.hsn);
    if (filters.status) params.set('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/products${query}`).then(setProducts).catch((e) => setMessage(e.message));
  };

  useEffect(load, [filters]);

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
      setForm({ name: '', description: '', sellingPrice: '', gstPercent: '', hsnCode: '', sku: '', unitType: 'PCS', isActive: true });
      setMessage('Product created.');
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const editProduct = (product) => {
    setEditingId(product.id);
    setEditForm({
      sellingPrice: String(product.sellingPrice),
      gstPercent: String(product.gstPercent),
      description: product.description || '',
      isActive: product.isActive !== false,
    });
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setEditForm({ sellingPrice: '', gstPercent: '', description: '', isActive: true });
  };

  const saveProduct = async (id) => {
    setMessage('');
    try {
      await api(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sellingPrice: parseFloat(editForm.sellingPrice),
          gstPercent: parseFloat(editForm.gstPercent),
          description: editForm.description,
          isActive: editForm.isActive,
        }),
      });
      setMessage('Product updated.');
      cancelEdit();
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Delete product "${product.name}"?`)) return;
    setMessage('');
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' });
      setMessage('Product deleted.');
      if (editingId === product.id) cancelEdit();
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Create standardized product catalog"
      />

      <section className="panel">
        <h3>Create Product (Admin)</h3>
        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            Product Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="span-2">
            Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Selling Price (Rs)
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
          <label>
            Status
            <select value={form.isActive ? 'ACTIVE' : 'INACTIVE'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'ACTIVE' })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <button type="submit" className="btn-primary">Create Product</button>
        </form>
        {message && <p className="form-note">{message}</p>}
      </section>

      <section className="panel">
        <div className="panel-toolbar">
          <h3>Product Catalog</h3>
        </div>
        <div className="form-grid filter-grid">
          <label>Name<input value={filters.name} onChange={(e) => setFilters({ ...filters, name: e.target.value })} /></label>
          <label>HSN<input value={filters.hsn} onChange={(e) => setFilters({ ...filters, hsn: e.target.value })} /></label>
          <label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
          <button type="button" className="btn-ghost" onClick={() => setFilters({ name: '', hsn: '', status: '' })}>Clear Filters</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Price</th>
              <th>GST</th>
              <th>HSN</th>
              <th>SKU</th>
              <th>Unit</th>
              <th>Status</th>
              <th>Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  {editingId === p.id ? (
                    <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                  ) : (
                    p.description || '-'
                  )}
                </td>
                <td>
                  {editingId === p.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.sellingPrice}
                      onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })}
                    />
                  ) : (
                    <>Rs {p.sellingPrice}</>
                  )}
                </td>
                <td>
                  {editingId === p.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.gstPercent}
                      onChange={(e) => setEditForm({ ...editForm, gstPercent: e.target.value })}
                    />
                  ) : (
                    <>{p.gstPercent}%</>
                  )}
                </td>
                <td>{p.hsnCode}</td>
                <td>{p.sku}</td>
                <td>{p.unitType}</td>
                <td>
                  {editingId === p.id ? (
                    <select value={editForm.isActive ? 'ACTIVE' : 'INACTIVE'} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'ACTIVE' })}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  ) : (
                    <span className={`badge ${p.isActive === false ? 'badge-rejected' : 'badge-approved'}`}>{p.isActive === false ? 'Inactive' : 'Active'}</span>
                  )}
                </td>
                <td>{p.stockQty}</td>
                <td>
                  {editingId === p.id ? (
                    <>
                      <button type="button" className="btn-sm btn-primary" onClick={() => saveProduct(p.id)}>Save</button>
                      <button type="button" className="btn-sm btn-ghost" onClick={cancelEdit}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-sm btn-primary" onClick={() => editProduct(p)}>Edit</button>
                      <button type="button" className="btn-sm btn-ghost" onClick={() => deleteProduct(p)}>Delete</button>
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
