import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

export default function StaffProductsView() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api('/products').then(setProducts);
  }, []);

  return (
    <div>
      <PageHeader
        title="Approved Products"
        subtitle="Read-only catalog — contact admin to create or approve new products"
      />
      <section className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th>GST</th>
              <th>SKU</th>
              <th>Unit</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>₹{p.sellingPrice}</td>
                <td>{p.gstPercent}%</td>
                <td>{p.sku}</td>
                <td>{p.unitType}</td>
                <td>{p.stockQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
