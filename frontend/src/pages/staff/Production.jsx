import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

const EMPTY_EXTRA_USAGE = { rawMaterialId: '', quantityUsed: '' };

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '';
}

function formatUnit(unit) {
  return unit?.replaceAll('_', ' ') || '';
}

function materialLabel(material) {
  return `${material.name} (${material.quantity} ${formatUnit(material.unit)} left)`;
}

function findUsage(record, keyword) {
  return record.materialUsages?.find((usage) =>
    usage.rawMaterial?.name?.toLowerCase().includes(keyword)
  );
}

export default function StaffProduction() {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', productId: '', search: '' });
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    productId: '',
    quantityProduced: '',
    workerCount: '',
    batchReference: '',
    cementMaterialId: '',
    cementBagsUsed: '',
    extraUsages: [EMPTY_EXTRA_USAGE],
  });
  const [message, setMessage] = useState('');

  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials]
  );

  const cementMaterial = materialById.get(form.cementMaterialId);
  const sandMaterial = useMemo(
    () => materials.find((material) => material.name.toLowerCase().includes('sand')),
    [materials]
  );

  const loadMaterials = () => {
    api('/raw-materials').then((rawMaterials) => {
      setMaterials(rawMaterials);
      setForm((current) => {
        if (current.cementMaterialId) return current;
        const cement = rawMaterials.find((material) => material.name.toLowerCase().includes('cement'));
        return cement ? { ...current, cementMaterialId: cement.id } : current;
      });
    });
  };

  const load = () => {
    api('/products').then(setProducts);
    loadMaterials();

    const params = new URLSearchParams();
    if (filters.fromDate) params.set('fromDate', filters.fromDate);
    if (filters.toDate) params.set('toDate', filters.toDate);
    if (filters.productId) params.set('productId', filters.productId);

    const query = params.toString() ? `?${params.toString()}` : '';
    api(`/production${query}`).then(setRecords);
  };

  useEffect(load, [filters.fromDate, filters.toDate, filters.productId]);

  const visibleRecords = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) return records;

    return records.filter((record) => {
      const materialNames = record.materialUsages
        ?.map((usage) => usage.rawMaterial?.name)
        .join(' ')
        .toLowerCase();
      return [
        record.product?.name,
        record.batchReference,
        record.stockIn?.referenceNumber,
        materialNames,
      ].some((value) => value?.toLowerCase().includes(search));
    });
  }, [records, filters.search]);

  const remainingFor = (materialId, usedValue) => {
    const material = materialById.get(materialId);
    if (!material) return null;
    return asNumber(material.quantity) - asNumber(usedValue);
  };

  const sandUsage = form.extraUsages.find((usage) => {
    const material = materialById.get(usage.rawMaterialId);
    return material?.name.toLowerCase().includes('sand');
  });

  const updateExtraUsage = (index, patch) => {
    setForm((current) => ({
      ...current,
      extraUsages: current.extraUsages.map((usage, usageIndex) =>
        usageIndex === index ? { ...usage, ...patch } : usage
      ),
    }));
  };

  const addExtraUsage = () => {
    setForm((current) => ({
      ...current,
      extraUsages: [...current.extraUsages, EMPTY_EXTRA_USAGE],
    }));
  };

  const removeExtraUsage = (index) => {
    setForm((current) => ({
      ...current,
      extraUsages: current.extraUsages.filter((_, usageIndex) => usageIndex !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const usageMap = new Map();

      if (form.cementMaterialId && form.cementBagsUsed) {
        usageMap.set(form.cementMaterialId, asNumber(form.cementBagsUsed));
      }

      form.extraUsages.forEach((usage) => {
        if (!usage.rawMaterialId || !usage.quantityUsed) return;
        usageMap.set(
          usage.rawMaterialId,
          (usageMap.get(usage.rawMaterialId) || 0) + asNumber(usage.quantityUsed)
        );
      });

      const materialUsages = [...usageMap.entries()].map(([rawMaterialId, quantityUsed]) => ({
        rawMaterialId,
        quantityUsed,
      }));

      const result = await api('/production', {
        method: 'POST',
        body: JSON.stringify({
          date: form.date,
          productId: form.productId,
          quantityProduced: asNumber(form.quantityProduced),
          workerCount: parseInt(form.workerCount, 10),
          batchReference: form.batchReference,
          materialUsages,
        }),
      });

      setMessage(
        `Production saved. Raw materials deducted; +${result.stockIn?.quantity} bricks added to stock (Stock In #${result.stockIn?.referenceNumber}).`
      );
      setForm((current) => ({
        ...current,
        quantityProduced: '',
        cementBagsUsed: '',
        batchReference: '',
        extraUsages: [EMPTY_EXTRA_USAGE],
      }));
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Production"
        subtitle="Manufacturing entry - auto deducts raw materials & adds finished stock"
      />

      <section className="panel highlight-panel">
        <p>
          When you save production, the system automatically <strong>deducts raw materials</strong> from
          inventory and <strong>creates a Stock In</strong> record for finished bricks.
        </p>
      </section>

      <section className="panel">
        <h3>New Production Entry</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </label>
          <label>
            Product Type
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
              <option value="">Select approved product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Bricks Produced
            <input type="number" value={form.quantityProduced} onChange={(e) => setForm({ ...form, quantityProduced: e.target.value })} required placeholder="10000" />
          </label>
          <label>
            Cement Material
            <select value={form.cementMaterialId} onChange={(e) => setForm({ ...form, cementMaterialId: e.target.value })} required>
              <option value="">Select cement</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>{materialLabel(material)}</option>
              ))}
            </select>
          </label>
          <label>
            Cement Bags Used
            <input type="number" value={form.cementBagsUsed} onChange={(e) => setForm({ ...form, cementBagsUsed: e.target.value })} required placeholder="50" />
          </label>
          <label>
            Worker Count
            <input type="number" value={form.workerCount} onChange={(e) => setForm({ ...form, workerCount: e.target.value })} required />
          </label>
          <label>
            Batch Reference
            <input value={form.batchReference} onChange={(e) => setForm({ ...form, batchReference: e.target.value })} required placeholder="BATCH-2026-051" />
          </label>

          <div className="span-2 material-balance">
            <span>
              Cement remaining:{' '}
              <strong>{cementMaterial ? `${remainingFor(form.cementMaterialId, form.cementBagsUsed)} ${formatUnit(cementMaterial.unit)}` : '-'}</strong>
            </span>
            <span>
              Sand remaining:{' '}
              <strong>
                {sandMaterial
                  ? `${remainingFor(sandUsage?.rawMaterialId || sandMaterial.id, sandUsage?.quantityUsed || 0)} ${formatUnit(sandMaterial.unit)}`
                  : '-'}
              </strong>
            </span>
          </div>

          <div className="span-2 production-extra-materials">
            <div className="panel-toolbar compact-toolbar">
              <h3>Other Raw Materials Used</h3>
              <button type="button" className="btn-ghost" onClick={addExtraUsage}>Add Material</button>
            </div>
            {form.extraUsages.map((usage, index) => {
              const selectedMaterial = materialById.get(usage.rawMaterialId);
              return (
                <div className="form-grid nested-form-grid" key={index}>
                  <label>
                    Raw Material Name
                    <select value={usage.rawMaterialId} onChange={(e) => updateExtraUsage(index, { rawMaterialId: e.target.value })}>
                      <option value="">Select raw material</option>
                      {materials
                        .filter((material) => material.id !== form.cementMaterialId)
                        .map((material) => (
                          <option key={material.id} value={material.id}>{materialLabel(material)}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Quantity Used
                    <input type="number" value={usage.quantityUsed} onChange={(e) => updateExtraUsage(index, { quantityUsed: e.target.value })} placeholder="25" />
                  </label>
                  <label>
                    Remaining Quantity
                    <input value={selectedMaterial ? `${remainingFor(usage.rawMaterialId, usage.quantityUsed)} ${formatUnit(selectedMaterial.unit)}` : '-'} readOnly />
                  </label>
                  {form.extraUsages.length > 1 && (
                    <button type="button" className="btn-ghost" onClick={() => removeExtraUsage(index)}>Remove</button>
                  )}
                </div>
              );
            })}
          </div>

          <button type="submit" className="btn-primary">Save Production</button>
        </form>
        {message && <p className="form-note">{message}</p>}
      </section>

      <section className="panel">
        <div className="panel-toolbar production-history-toolbar">
          <h3>View Production Entries</h3>
        </div>
        <div className="form-grid filter-grid">
          <label>
            From Date
            <input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          </label>
          <label>
            To Date
            <input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
          </label>
          <label>
            Product Type
            <select value={filters.productId} onChange={(e) => setFilters({ ...filters, productId: e.target.value })}>
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>
          <label>
            Search
            <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Batch, product, material..." />
          </label>
          <button type="button" className="btn-ghost" onClick={() => setFilters({ fromDate: '', toDate: '', productId: '', search: '' })}>
            Clear Filters
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Bricks Produced</th>
                <th>Bags Used</th>
                <th>Efficiency</th>
                <th>Workers</th>
                <th>Batch</th>
                <th>Materials Used</th>
                <th>Stock In</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => {
                const cementUsage = findUsage(record, 'cement');
                const bagsUsed = asNumber(cementUsage?.quantityUsed);
                const efficiency = bagsUsed > 0 ? asNumber(record.quantityProduced) / bagsUsed : 0;

                return (
                  <tr key={record.id}>
                    <td>{formatDate(record.date)}</td>
                    <td>{record.product?.name}</td>
                    <td>{record.quantityProduced}</td>
                    <td>{cementUsage ? `${cementUsage.quantityUsed} ${formatUnit(cementUsage.rawMaterial?.unit)}` : '-'}</td>
                    <td>{efficiency ? `${efficiency.toFixed(2)} bricks/bag` : '-'}</td>
                    <td>{record.workerCount}</td>
                    <td>{record.batchReference}</td>
                    <td>
                      {record.materialUsages?.map((usage) => (
                        <span className="material-chip" key={usage.id}>
                          {usage.rawMaterial?.name}: {usage.quantityUsed} {formatUnit(usage.rawMaterial?.unit)}
                        </span>
                      ))}
                    </td>
                    <td>
                      {record.stockIn
                        ? <span className="badge">+{record.stockIn.quantity}</span>
                        : '-'}
                    </td>
                  </tr>
                );
              })}
              {visibleRecords.length === 0 && (
                <tr>
                  <td colSpan="9">No production entries found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
