import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { StockInRegister } from '../../components/StockInRegister';
import { PageHeader } from '../../components/Layout';

export default function AdminStockInView() {
  const [products, setProducts] = useState([]);
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', productId: '', source: '' });

  const load = () => {
    api('/products').then(setProducts);

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/stock-in${query}`).then(setRecords);
  };

  useEffect(load, [filters]);

  return (
    <div>
      <PageHeader title="Stock In Audit Trail" subtitle="Complete inventory movement history" />
      <StockInRegister
        title="View All Stock In"
        records={records}
        products={products}
        filters={filters}
        onFilterChange={setFilters}
        includeEnteredBy
      />
    </div>
  );
}
