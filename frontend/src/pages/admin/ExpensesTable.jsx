import { useEffect, useState } from 'react';
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

export default function ExpensesTable() {
  const [expenses, setExpenses] = useState([]);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', category: '' });

  const load = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/expenses${query}`).then(setExpenses);
  };

  useEffect(load, [filters]);

  return (
    <div>
      <PageHeader title="Expenses Table" subtitle="Complete expense register for admin review" />

      <section className="panel">
        <div className="panel-toolbar stockin-toolbar">
          <h3>All Expenses</h3>
        </div>
        <div className="form-grid filter-grid">
          <label>From Date<input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} /></label>
          <label>To Date<input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} /></label>
          <label>Category<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <button type="button" className="btn-ghost" onClick={() => setFilters({ fromDate: '', toDate: '', category: '' })}>Clear Filters</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Payment</th><th>Paid To</th><th>Bill Ref</th><th>Note</th><th>Attachment</th></tr></thead>
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
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan="8">No expenses found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
