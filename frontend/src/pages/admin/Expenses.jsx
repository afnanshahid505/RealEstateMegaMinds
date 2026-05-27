import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

const CATEGORIES = ['RAW_MATERIAL', 'LABOUR', 'TRANSPORT', 'FUEL', 'MAINTENANCE', 'RENT', 'UTILITIES', 'SALARY', 'OTHER'];
const EMPTY_FORM = { expenseDate: new Date().toISOString().slice(0, 10), category: 'OTHER', amount: '', description: '', note: '' };

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

function htmlCell(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', category: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/expenses${query}`).then(setExpenses);
  };

  useEffect(load, [filters]);

  const categoryTotals = useMemo(() => {
    const totals = new Map();
    expenses.forEach((expense) => {
      totals.set(expense.category, (totals.get(expense.category) || 0) + asNumber(expense.amount));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const payload = { ...form, amount: asNumber(form.amount) };
      if (editingId) {
        await api(`/expenses/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setMessage('Expense updated.');
      } else {
        await api('/expenses', { method: 'POST', body: JSON.stringify(payload) });
        setMessage('Expense recorded.');
      }
      setForm(EMPTY_FORM);
      setEditingId('');
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
      description: expense.description || '',
      note: expense.note || '',
    });
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) return;
    await api(`/expenses/${expense.id}`, { method: 'DELETE' });
    load();
  };

  const exportExcel = () => {
    const rows = expenses.map((expense) => `
      <tr>
        <td>${htmlCell(formatDate(expense.expenseDate))}</td>
        <td>${htmlCell(expense.category)}</td>
        <td>${htmlCell(expense.description)}</td>
        <td>${htmlCell(expense.amount)}</td>
        <td>${htmlCell(expense.note || '')}</td>
      </tr>
    `).join('');
    const html = `<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`;
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
      <tr><td>${formatDate(expense.expenseDate)}</td><td>${expense.category}</td><td>${expense.description || ''}</td><td>${money(expense.amount)}</td><td>${expense.note || ''}</td></tr>
    `).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Expenses</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}</style></head><body><h1>Expense Register</h1><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
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
          <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></label>
          <label>Amount<input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
          <label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
          <label className="span-2">Note<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <button type="submit" className="btn-primary">{editingId ? 'Save Changes' : 'Record Expense'}</button>
          {editingId && <button type="button" className="btn-ghost" onClick={() => { setEditingId(''); setForm(EMPTY_FORM); }}>Cancel</button>}
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
            <button type="button" className="btn-ghost" onClick={exportExcel}>Export Excel</button>
            <button type="button" className="btn-ghost" onClick={exportPdf}>Export PDF</button>
          </div>
        </div>
        <div className="form-grid filter-grid">
          <label>From Date<input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} /></label>
          <label>To Date<input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} /></label>
          <label>Category<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></label>
          <button type="button" className="btn-ghost" onClick={() => setFilters({ fromDate: '', toDate: '', category: '' })}>Clear Filters</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Note</th><th>Actions</th></tr></thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expenseDate)}</td>
                  <td><span className="badge">{expense.category.replace('_', ' ')}</span></td>
                  <td>{expense.description}</td>
                  <td>{money(expense.amount)}</td>
                  <td>{expense.note || '-'}</td>
                  <td>
                    <button type="button" className="btn-sm btn-primary" onClick={() => editExpense(expense)}>Edit</button>
                    <button type="button" className="btn-sm btn-ghost" onClick={() => deleteExpense(expense)}>Delete</button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan="6">No expenses found.</td></tr>}
            </tbody>
            <tfoot>
              {categoryTotals.map(([category, total]) => (
                <tr key={category}><td colSpan="3"><strong>{category.replace('_', ' ')} Total</strong></td><td><strong>{money(total)}</strong></td><td colSpan="2" /></tr>
              ))}
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
