import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

const CATEGORIES = [
  { value: 'LABOUR', label: 'Labour' },
  { value: 'FUEL', label: 'Fuel' },
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RENT', label: 'Rent' },
  { value: 'RAW_MATERIAL_PURCHASE', label: 'Raw Material Purchase' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
];

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
];

const EMPTY_FORM = {
  expenseDate: new Date().toISOString().slice(0, 10),
  category: 'LABOUR',
  amount: '',
  paymentMode: 'CASH',
  paidTo: '',
  billRef: '',
  description: '',
};

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return `Rs ${asNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '';
}

function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || String(value || '').replaceAll('_', ' ');
}

function htmlCell(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildExpenseFormData(form, attachment) {
  const data = new FormData();
  Object.entries(form).forEach(([key, value]) => {
    if (key === 'amount') return;
    data.append(key, value);
  });
  data.append('amount', asNumber(form.amount));
  if (attachment) data.append('attachment', attachment);
  return data;
}

export default function AdminExpenses() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', category: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [attachment, setAttachment] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const load = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/expenses${query}`).then(setExpenses).catch((err) => setMessage(err.message));
  };

  useEffect(load, [filters]);

  const categoryTotals = useMemo(() => {
    const totals = new Map();
    expenses.forEach((expense) => {
      const label = labelFor(CATEGORIES, expense.category);
      totals.set(label, (totals.get(label) || 0) + asNumber(expense.amount));
    });
    return [...totals.entries()];
  }, [expenses]);

  const monthlyTrend = useMemo(() => {
    const totals = new Map();
    expenses.forEach((expense) => {
      const date = new Date(expense.expenseDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      totals.set(key, (totals.get(key) || 0) + asNumber(expense.amount));
    });
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [expenses]);

  const maxTrend = Math.max(...monthlyTrend.map(([, total]) => total), 1);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setAttachment(null);
    setEditingId('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const payload = buildExpenseFormData(form, attachment);
      if (editingId) {
        await api(`/expenses/${editingId}`, { method: 'PATCH', body: payload });
        setMessage('Expense updated.');
      } else {
        await api('/expenses', { method: 'POST', body: payload });
        setMessage('Expense recorded.');
      }
      resetForm();
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const editExpense = (expense) => {
    setEditingId(expense.id);
    setForm({
      expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
      category: expense.category,
      amount: expense.amount,
      paymentMode: expense.paymentMode || 'CASH',
      paidTo: expense.paidTo || '',
      billRef: expense.billRef || '',
      description: expense.description || expense.note || '',
    });
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Delete expense "${expense.description || expense.category}"?`)) return;
    await api(`/expenses/${expense.id}`, { method: 'DELETE' });
    load();
  };

  const exportExcel = () => {
    const rows = expenses.map((expense) => `
      <tr>
        <td>${htmlCell(formatDate(expense.expenseDate))}</td>
        <td>${htmlCell(labelFor(CATEGORIES, expense.category))}</td>
        <td>${htmlCell(expense.amount)}</td>
        <td>${htmlCell(labelFor(PAYMENT_MODES, expense.paymentMode))}</td>
        <td>${htmlCell(expense.paidTo || '')}</td>
        <td>${htmlCell(expense.billRef || '')}</td>
        <td>${htmlCell(expense.description || expense.note || '')}</td>
        <td>${htmlCell(expense.attachmentOriginalName || '')}</td>
      </tr>
    `).join('');
    const html = `<table><thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Payment Mode</th><th>Paid To</th><th>Bill Ref</th><th>Note</th><th>Attachment</th></tr></thead><tbody>${rows}</tbody></table>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rows = expenses.map((expense) => `
      <tr><td>${formatDate(expense.expenseDate)}</td><td>${labelFor(CATEGORIES, expense.category)}</td><td>${money(expense.amount)}</td><td>${labelFor(PAYMENT_MODES, expense.paymentMode)}</td><td>${expense.paidTo || ''}</td><td>${expense.billRef || ''}</td><td>${expense.description || expense.note || ''}</td><td>${expense.attachmentOriginalName || ''}</td></tr>
    `).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Expenses</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}</style></head><body><h1>Expense Register</h1><table><thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Payment Mode</th><th>Paid To</th><th>Bill Ref</th><th>Note</th><th>Attachment</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Track factory expenses, trends, and category totals" />

      <section className="panel">
        <h3>{editingId ? 'Edit Expense' : 'Add Expense'}</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>Date<input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} required /></label>
          <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <label>Amount (INR)<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
          <label>Payment Mode<select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>{PAYMENT_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
          <label>Paid To<input value={form.paidTo} onChange={(e) => setForm({ ...form, paidTo: e.target.value })} placeholder="Vendor or person" /></label>
          <label>Bill / Receipt Reference<input value={form.billRef} onChange={(e) => setForm({ ...form, billRef: e.target.value })} /></label>
          <label>Attachment<input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.pdf" onChange={(e) => setAttachment(e.target.files?.[0] || null)} /></label>
          <label className="span-2">Note / Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <button type="submit" className="btn-primary">{editingId ? 'Save Changes' : 'Record Expense'}</button>
          {editingId && <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>}
        </form>
        {message && <p className="form-note">{message}</p>}
      </section>

      <section className="panel">
        <div className="panel-toolbar stockin-toolbar">
          <h3>Monthly Expense Trend</h3>
        </div>
        <div className="trend-chart">
          {monthlyTrend.map(([month, total]) => (
            <div className="trend-bar" key={month}>
              <span>{money(total)}</span>
              <div style={{ height: `${Math.max((total / maxTrend) * 140, 8)}px` }} />
              <small>{month}</small>
            </div>
          ))}
          {monthlyTrend.length === 0 && <p className="form-note">No expenses to chart.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-toolbar stockin-toolbar">
          <h3>View All Expenses</h3>
          <div className="export-actions">
            <button type="button" className="btn-ghost" onClick={() => navigate('/admin/expenses/table')}>Table View</button>
            <button type="button" className="btn-ghost" onClick={exportExcel}>Export Excel</button>
            <button type="button" className="btn-ghost" onClick={exportPdf}>Export PDF</button>
          </div>
        </div>
        <div className="form-grid filter-grid">
          <label>From Date<input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} /></label>
          <label>To Date<input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} /></label>
          <label>Category<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <button type="button" className="btn-ghost" onClick={() => setFilters({ fromDate: '', toDate: '', category: '' })}>Clear Filters</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Payment</th><th>Paid To</th><th>Bill Ref</th><th>Note</th><th>Attachment</th><th>Actions</th></tr></thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expenseDate)}</td>
                  <td><span className="badge">{labelFor(CATEGORIES, expense.category)}</span></td>
                  <td>{money(expense.amount)}</td>
                  <td>{labelFor(PAYMENT_MODES, expense.paymentMode)}</td>
                  <td>{expense.paidTo || '-'}</td>
                  <td>{expense.billRef || '-'}</td>
                  <td>{expense.description || expense.note || '-'}</td>
                  <td>
                    {expense.attachmentUrl ? (
                      <a className="btn-sm btn-ghost" href={expense.attachmentUrl} target="_blank" rel="noreferrer">View</a>
                    ) : '-'}
                  </td>
                  <td>
                    <button type="button" className="btn-sm btn-primary" onClick={() => editExpense(expense)}>Edit</button>
                    <button type="button" className="btn-sm btn-ghost" onClick={() => deleteExpense(expense)}>Delete</button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan="9">No expenses found.</td></tr>}
            </tbody>
            <tfoot>
              {categoryTotals.map(([category, total]) => (
                <tr key={category}><td colSpan="2"><strong>{category} Total</strong></td><td><strong>{money(total)}</strong></td><td colSpan="6" /></tr>
              ))}
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
