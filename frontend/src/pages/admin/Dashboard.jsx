import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, StatCard } from '../../components/Layout';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNumber(n) {
  return new Intl.NumberFormat('en-IN').format(n);
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard/stats')
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!stats) return <p className="loading">Loading dashboard…</p>;

  return (
    <div>
      <PageHeader
        title="Control Room Dashboard"
        subtitle="Business health at a glance "
      />
      <div className="stats-grid">
        <StatCard label="Today's Sales" value={formatCurrency(stats.todaySales)} variant="sales" />
        <StatCard
          label="Total Stock Available"
          value={formatNumber(stats.totalStock)}
          hint="Finished goods (all products)"
          variant="stock"
        />
        <StatCard
          label="Pending Customer Payments"
          value={formatCurrency(stats.pendingPayments)}
          variant="pending"
        />
        <StatCard
          label="Production Today"
          value={formatNumber(stats.productionToday.quantity)}
          hint={`${stats.productionToday.batches} batch(es)`}
          variant="production"
        />
        <StatCard label="Expenses Today" value={formatCurrency(stats.expensesToday)} variant="expense" />
        <StatCard
          label="Profit Summary (Month)"
          value={formatCurrency(stats.profitSummary.monthProfit)}
          hint={`Revenue ${formatCurrency(stats.profitSummary.monthRevenue)} · Expenses ${formatCurrency(stats.profitSummary.monthExpenses)}`}
          variant="profit"
        />
      </div>

      {(stats.lowStockAlerts?.length > 0 || stats.pendingProductApprovals > 0) && (
        <section className="panel alerts-panel">
          <h3>Alerts</h3>
          <ul>
            {stats.pendingProductApprovals > 0 && (
              <li className="alert-warn">
                {stats.pendingProductApprovals} product(s) awaiting approval
              </li>
            )}
            {stats.lowStockAlerts?.map((m) => (
              <li key={m.id} className="alert-danger">
                Low stock: {m.name} — {m.quantity} {m.unit} (reorder at {m.reorderLevel})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
