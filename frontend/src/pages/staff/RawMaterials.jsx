import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

const CATEGORIES = [
  { value: 'BINDING', label: 'Binding' },
  { value: 'AGGREGATE', label: 'Aggregate' },
  { value: 'FUEL', label: 'Fuel' },
  { value: 'ADDITIVE', label: 'Additive' },
  { value: 'OTHER', label: 'Other' },
];

const UNITS = [
  { value: 'BAGS', label: 'Bags' },
  { value: 'KG', label: 'Kg' },
  { value: 'TONS', label: 'Tons' },
  { value: 'LITRES', label: 'Litres' },
  { value: 'CUBIC_METERS', label: 'Cubic Meters' },
];

const emptyOnboard = () => ({
  name: '',
  category: 'BINDING',
  unit: 'BAGS',
  quantity: '',
  unitPrice: '',
  supplierName: '',
  reorderLevel: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  invoiceRef: '',
  note: '',
});

const emptyPurchase = () => ({
  quantity: '',
  unitPrice: '',
  supplier: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  invoiceRef: '',
  note: '',
});

function formatUnit(unit) {
  return UNITS.find((u) => u.value === unit)?.label || unit;
}

function formatCategory(cat) {
  return CATEGORIES.find((c) => c.value === cat)?.label || cat;
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function StaffRawMaterials() {
  const [tab, setTab] = useState('view');
  const [materials, setMaterials] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [onboardForm, setOnboardForm] = useState(emptyOnboard);
  const [editForm, setEditForm] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => api('/raw-materials').then(setMaterials).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api(`/raw-materials/${selectedId}`)
      .then((d) => {
        setDetail(d);
        setEditForm({
          name: d.name,
          category: d.category,
          unit: d.unit,
          quantity: String(d.quantity),
          unitPrice: String(d.unitPrice),
          supplierName: d.supplierName || '',
          reorderLevel: String(d.reorderLevel),
          note: d.note || '',
        });
      })
      .catch((e) => setError(e.message));
  }, [selectedId]);

  const handleOnboard = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await api('/raw-materials', {
        method: 'POST',
        body: JSON.stringify({
          ...onboardForm,
          quantity: parseFloat(onboardForm.quantity),
          unitPrice: parseFloat(onboardForm.unitPrice),
          reorderLevel: onboardForm.reorderLevel ? parseFloat(onboardForm.reorderLevel) : 0,
          supplierName: onboardForm.supplierName || undefined,
          invoiceRef: onboardForm.invoiceRef || undefined,
          note: onboardForm.note || undefined,
        }),
      });
      setMessage('Material onboarded successfully.');
      setOnboardForm(emptyOnboard());
      load();
      setTab('view');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await api(`/raw-materials/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...editForm,
          quantity: parseFloat(editForm.quantity),
          unitPrice: parseFloat(editForm.unitPrice),
          reorderLevel: parseFloat(editForm.reorderLevel) || 0,
          supplierName: editForm.supplierName || null,
          note: editForm.note || null,
        }),
      });
      setMessage('Material updated.');
      load();
      setSelectedId(selectedId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePurchase = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await api(`/raw-materials/${selectedId}/purchases`, {
        method: 'POST',
        body: JSON.stringify({
          ...purchaseForm,
          quantity: parseFloat(purchaseForm.quantity),
          unitPrice: parseFloat(purchaseForm.unitPrice),
          supplier: purchaseForm.supplier || undefined,
          invoiceRef: purchaseForm.invoiceRef || undefined,
          note: purchaseForm.note || undefined,
        }),
      });
      setMessage('Purchase logged — stock increased.');
      setPurchaseForm(emptyPurchase());
      setSelectedId(selectedId);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const editMaterial = (id) => {
    setMessage('');
    setError('');
    setSelectedId(id);
    setTab('manage');
  };

  const deleteMaterial = async (material) => {
    if (!window.confirm(`Delete material "${material.name}"?`)) return;
    setMessage('');
    setError('');
    try {
      await api(`/raw-materials/${material.id}`, { method: 'DELETE' });
      setMessage('Material deleted.');
      if (selectedId === material.id) {
        setSelectedId('');
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const lowCount = materials.filter((m) => m.isLowStock).length;

  return (
    <div>
      <PageHeader
        title="Raw Materials"
        subtitle="Procurement & inventory for brick production"
      />

      <div className="tabs">
        <button type="button" className={tab === 'view' ? 'tab active' : 'tab'} onClick={() => setTab('view')}>
          View Materials
          {lowCount > 0 && <span className="tab-alert">{lowCount}</span>}
        </button>
        <button type="button" className={tab === 'add' ? 'tab active' : 'tab'} onClick={() => setTab('add')}>
          Add Material
        </button>
        <button type="button" className={tab === 'manage' ? 'tab active' : 'tab'} onClick={() => setTab('manage')}>
          Manage
        </button>
      </div>

      {(message || error) && (
        <p className={error ? 'form-error' : 'form-note'} style={{ marginBottom: '1rem' }}>
          {error || message}
        </p>
      )}

      {tab === 'view' && (
        <section className="panel">
          <h3>Inventory ({materials.length} materials)</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Unit Price</th>
                <th>Total Value</th>
                <th>Reorder</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className={m.isLowStock ? 'row-low-stock' : ''}>
                  <td>
                    <strong>{m.name}</strong>
                    {m.supplierName && <><br /><small> {m.supplierName}</small></>}
                  </td>
                  <td>{formatCategory(m.category)}</td>
                  <td>
                    {Number(m.quantity).toLocaleString('en-IN')} {formatUnit(m.unit)}
                  </td>
                  <td>{formatCurrency(Number(m.unitPrice))}</td>
                  <td>{formatCurrency(m.totalValue)}</td>
                  <td>
                    {Number(m.reorderLevel) > 0
                      ? `${m.reorderLevel} ${formatUnit(m.unit)}`
                      : '—'}
                  </td>
                  <td>
                    {m.isLowStock ? (
                      <span className="badge badge-pending">Low stock</span>
                    ) : (
                      <span className="badge badge-approved">OK</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="btn-sm btn-primary" onClick={() => editMaterial(m.id)}>Edit</button>
                    <button type="button" className="btn-sm btn-ghost" onClick={() => deleteMaterial(m)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'add' && (
        <section className="panel">
          <h3>5.1 Onboard / Add Material</h3>
          <form className="form-grid" onSubmit={handleOnboard}>
            <label>
              Material Name *
              <input
                value={onboardForm.name}
                onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                required
                placeholder="Cement, Fly Ash, Sand…"
              />
            </label>
            <label>
              Category *
              <select
                value={onboardForm.category}
                onChange={(e) => setOnboardForm({ ...onboardForm, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label>
              Unit of Measure *
              <select
                value={onboardForm.unit}
                onChange={(e) => setOnboardForm({ ...onboardForm, unit: e.target.value })}
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </label>
            <label>
              Current Stock (Qty) *
              <input
                type="number"
                step="0.01"
                min="0"
                value={onboardForm.quantity}
                onChange={(e) => setOnboardForm({ ...onboardForm, quantity: e.target.value })}
                required
              />
            </label>
            <label>
              Unit Price (INR) *
              <input
                type="number"
                step="0.01"
                min="0"
                value={onboardForm.unitPrice}
                onChange={(e) => setOnboardForm({ ...onboardForm, unitPrice: e.target.value })}
                required
              />
            </label>
            <label>
              Supplier Name
              <input
                value={onboardForm.supplierName}
                onChange={(e) => setOnboardForm({ ...onboardForm, supplierName: e.target.value })}
              />
            </label>
            <label>
              Reorder Level
              <input
                type="number"
                step="0.01"
                min="0"
                value={onboardForm.reorderLevel}
                onChange={(e) => setOnboardForm({ ...onboardForm, reorderLevel: e.target.value })}
              />
            </label>
            <label>
              Date of Purchase
              <input
                type="date"
                value={onboardForm.purchaseDate}
                onChange={(e) => setOnboardForm({ ...onboardForm, purchaseDate: e.target.value })}
              />
            </label>
            <label>
              Invoice / Bill Reference
              <input
                value={onboardForm.invoiceRef}
                onChange={(e) => setOnboardForm({ ...onboardForm, invoiceRef: e.target.value })}
              />
            </label>
            <label className="span-2">
              Note
              <textarea
                rows={2}
                value={onboardForm.note}
                onChange={(e) => setOnboardForm({ ...onboardForm, note: e.target.value })}
                placeholder="Storage location, quality grade…"
              />
            </label>
            <button type="submit" className="btn-primary">Add Material</button>
          </form>
        </section>
      )}

      {tab === 'manage' && (
        <>
          <section className="panel">
            <h3>5.3 Manage Raw Material</h3>
            <label>
              Select material
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setMessage('');
                  setError('');
                }}
              >
                <option value="">— Choose —</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({Number(m.quantity)} {formatUnit(m.unit)})
                    {m.isLowStock ? ' ⚠ Low' : ''}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {selectedId && editForm && (
            <>
              <section className="panel">
                <h3>Edit Material Details</h3>
                <form className="form-grid" onSubmit={handleEdit}>
                  <label>
                    Material Name
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Unit of Measure
                    <select
                      value={editForm.unit}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    >
                      {UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Current Stock (manual adjust)
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.quantity}
                      onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Unit Price (INR)
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.unitPrice}
                      onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Primary Supplier
                    <input
                      value={editForm.supplierName}
                      onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                    />
                  </label>
                  <label>
                    Reorder Level
                    <input
                      type="number"
                      value={editForm.reorderLevel}
                      onChange={(e) => setEditForm({ ...editForm, reorderLevel: e.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    Note
                    <textarea
                      rows={2}
                      value={editForm.note}
                      onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                    />
                  </label>
                  <button type="submit" className="btn-primary">Save Changes</button>
                </form>
                <p className="form-note" style={{ marginTop: '0.75rem' }}>
                  Consumption is deducted automatically when this material is used in Production.
                </p>
              </section>

              <section className="panel">
                <h3>Log Additional Purchase</h3>
                <form className="form-grid" onSubmit={handlePurchase}>
                  <label>
                    Quantity *
                    <input
                      type="number"
                      step="0.01"
                      value={purchaseForm.quantity}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Unit Price (INR) *
                    <input
                      type="number"
                      step="0.01"
                      value={purchaseForm.unitPrice}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, unitPrice: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Supplier
                    <input
                      value={purchaseForm.supplier}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })}
                    />
                  </label>
                  <label>
                    Purchase Date *
                    <input
                      type="date"
                      value={purchaseForm.purchaseDate}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Invoice Reference
                    <input
                      value={purchaseForm.invoiceRef}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, invoiceRef: e.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    Note
                    <textarea
                      rows={2}
                      value={purchaseForm.note}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, note: e.target.value })}
                    />
                  </label>
                  <button type="submit" className="btn-primary">Add to Stock</button>
                </form>
              </section>

              {detail?.movements && (
                <section className="panel">
                  <h3>Movement History — Purchases vs Consumption</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Reference</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.movements.map((mv) => (
                        <tr key={`${mv.type}-${mv.id}`}>
                          <td>{new Date(mv.date).toLocaleDateString('en-IN')}</td>
                          <td>
                            <span className={`badge ${mv.type === 'PURCHASE' ? 'badge-approved' : 'badge-pending'}`}>
                              {mv.type}
                            </span>
                          </td>
                          <td className={mv.quantity < 0 ? 'text-warn' : 'text-success'}>
                            {mv.quantity > 0 ? '+' : ''}{mv.quantity}
                          </td>
                          <td>{mv.unitPrice != null ? formatCurrency(mv.unitPrice) : '—'}</td>
                          <td>{mv.reference}</td>
                          <td>
                            {mv.type === 'CONSUMPTION' && mv.productName && (
                              <>Batch {mv.productionBatch} · {mv.productName}</>
                            )}
                            {mv.type === 'PURCHASE' && (mv.supplier !== '—' ? mv.supplier : mv.note || '—')}
                          </td>
                        </tr>
                      ))}
                      {detail.movements.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ color: 'var(--muted)' }}>No movements yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
