import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { StockInRegister } from '../../components/StockInRegister';
import { PageHeader } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const SOURCES = ['PURCHASE', 'TRANSFER', 'ADJUSTMENT'];
const today = () => new Date().toISOString().slice(0, 10);

export default function StaffStockIn() {
  const { user } = useAuth();
  const isStaff = user?.role === 'STAFF';
  const [products, setProducts] = useState([]);
  const [recorders, setRecorders] = useState([]);
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', productId: '', source: '' });
  const [form, setForm] = useState({
    date: today(),
    productId: '',
    quantity: '',
    source: 'PURCHASE',
    referenceNumber: '',
    note: '',
    enteredById: '',
  });
  const [message, setMessage] = useState('');

  const load = () => {
    api('/products').then(setProducts);
    api('/users/recorders').then((users) => {
      setRecorders(users);
      setForm((current) => current.enteredById ? current : { ...current, enteredById: user?.id || users[0]?.id || '' });
    });

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/stock-in${query}`).then(setRecords);
  };

  useEffect(load, [filters]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api('/stock-in', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          date: isStaff ? today() : form.date,
          quantity: parseFloat(form.quantity),
        }),
      });
      setMessage('Stock In recorded - finished goods inventory updated.');
      setForm((f) => ({ ...f, quantity: '', referenceNumber: '', note: '' }));
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Stock In"
        subtitle="Audit trail for inventory additions (production creates entries automatically)"
      />

      <section className="panel">
        <h3>Manual Stock In</h3>
        <p className="form-note">Production source is auto-created when production is saved.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Date
            <input
              type="date"
              value={isStaff ? today() : form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              disabled={isStaff}
              required
            />
          </label>
          <label>
            Product
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          </label>
          <label>
            Source
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Reference Number
            <input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} required />
          </label>
          <label>
            Recorded By
            <select value={form.enteredById} onChange={(e) => setForm({ ...form, enteredById: e.target.value })} required>
              {recorders.map((recorder) => (
                <option key={recorder.id} value={recorder.id}>{recorder.name} ({recorder.role})</option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Note
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <button type="submit" className="btn-primary">Record Stock In</button>
        </form>
        {message && <p className="form-note">{message}</p>}
      </section>

      <StockInRegister
        title="View All Stock In"
        records={records}
        products={products}
        filters={filters}
        onFilterChange={setFilters}
        includeEnteredBy={user?.role === 'ADMIN'}
      />
    </div>
  );
}
