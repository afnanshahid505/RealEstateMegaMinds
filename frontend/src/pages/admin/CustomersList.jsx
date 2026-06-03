import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

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

export default function CustomersList() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const load = () => {
    const search = customerSearch ? `?search=${encodeURIComponent(customerSearch)}` : '';
    api(`/customers${search}`).then(setCustomers);
    api('/invoices').then(setInvoices);
  };

  useEffect(load, [customerSearch]);

  const openInvoice = async (id) => {
    const invoice = await api(`/invoices/${id}`);
    setSelectedInvoice(invoice);
  };

  const printInvoice = () => {
    if (!selectedInvoice) return;
    const rows = selectedInvoice.items?.map((item) => `
      <tr>
        <td>${item.description}</td>
        <td>${item.hsnCode || ''}</td>
        <td>${item.quantity}</td>
        <td>${money(item.rate)}</td>
        <td>${money(item.discount)}</td>
        <td>${money(item.taxableAmount)}</td>
        <td>${money(Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount))}</td>
        <td>${money(item.lineTotal)}</td>
      </tr>
    `).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>${selectedInvoice.invoiceNumber}</title>
      <style>body{font-family:Arial;padding:24px;color:#111}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.right{text-align:right}</style>
      </head><body>
        <h1>Tax Invoice ${selectedInvoice.invoiceNumber}</h1>
        <p>Date: ${formatDate(selectedInvoice.invoiceDate)} | Customer: ${selectedInvoice.customer?.companyName}</p>
        <p>Billing Address: ${selectedInvoice.customer?.address || ''}</p>
        <table><thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
        <h3 class="right">Grand Total: ${money(selectedInvoice.grandTotal)}</h3>
        <p class="right">Advance Paid: ${money(selectedInvoice.advancePaid)} | Balance Due: ${money(selectedInvoice.balanceDue)}</p>
        <p><strong>Amount in Words:</strong> ${selectedInvoice.amountInWords}</p>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div>
      <PageHeader title="Customers" subtitle="View customers and generate invoices" />
      <button type="button" className="btn-primary" onClick={() => navigate('/admin/customers/invoice')} style={{ marginBottom: '1rem' }}>
        Add Customer
      </button>

      <section className="panel">
        <div className="panel-toolbar stockin-toolbar">
          <h3>View All Customers</h3>
          <div className="export-actions">
            <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search name, phone, GSTIN" />
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>GSTIN / PAN</th>
                <th>Type</th>
                <th>Credit Limit</th>
                <th>Total Invoiced</th>
                <th>Total Paid</th>
                <th>Outstanding</th>
                <th>Invoices</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const totalPaid = invoices
                  .filter((invoice) => invoice.customerId === customer.id)
                  .reduce((sum, invoice) => sum + asNumber(invoice.advancePaid), 0);
                return (
                  <tr key={customer.id}>
                    <td><strong>{customer.companyName}</strong><br /><small>{customer.address}</small></td>
                    <td>{customer.phone}<br /><small>{customer.email || ''}</small></td>
                    <td>{customer.gstin || customer.panNumber || '-'}</td>
                    <td>{customer.customerType}</td>
                    <td>{money(customer.creditLimit)}</td>
                    <td>{money(customer.totalPurchases)}</td>
                    <td>{money(totalPaid)}</td>
                    <td className={asNumber(customer.outstandingBalance) > 0 ? 'text-warn' : ''}>{money(customer.outstandingBalance)}</td>
                    <td>
                      <button type="button" className="btn-sm btn-ghost" onClick={() => setSelectedCustomer(customer)}>
                        {customer._count?.invoices || 0} invoice(s)
                      </button>
                    </td>
                    <td>
                      <button type="button" className="btn-sm btn-primary" onClick={() => navigate(`/admin/customers/invoice?customerId=${customer.id}`)}>
                        Generate Invoice
                      </button>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && <tr><td colSpan="10">No customers found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCustomer && (
        <section className="panel">
          <div className="panel-toolbar">
            <h3>Invoice History - {selectedCustomer.companyName}</h3>
            <button type="button" className="btn-ghost" onClick={() => setSelectedCustomer(null)}>Close</button>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Invoice</th><th>Date</th><th>Grand Total</th><th>Paid</th><th>Balance</th><th>Action</th></tr>
            </thead>
            <tbody>
              {selectedCustomer.invoices?.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoiceNumber}</td>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td>{money(invoice.grandTotal)}</td>
                  <td>{money(invoice.advancePaid)}</td>
                  <td>{money(invoice.balanceDue)}</td>
                  <td><button type="button" className="btn-sm btn-primary" onClick={() => openInvoice(invoice.id)}>Open</button></td>
                </tr>
              ))}
              {!selectedCustomer.invoices?.length && <tr><td colSpan="6">No invoices found.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {selectedInvoice && (
        <section className="panel">
          <div className="panel-toolbar">
            <h3>Invoice {selectedInvoice.invoiceNumber}</h3>
            <div>
              <button type="button" className="btn-ghost" onClick={printInvoice}>Print / PDF</button>
              <button type="button" className="btn-ghost" onClick={() => setSelectedInvoice(null)}>Close</button>
            </div>
          </div>
          <p className="form-note">
            {selectedInvoice.customer?.companyName} | {formatDate(selectedInvoice.invoiceDate)} | {selectedInvoice.amountInWords}
          </p>
          <table className="data-table">
            <thead>
              <tr><th>Product</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Taxable</th><th>GST</th><th>Total</th></tr>
            </thead>
            <tbody>
              {selectedInvoice.items?.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.hsnCode}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.rate)}</td>
                  <td>{money(item.discount)}</td>
                  <td>{money(item.taxableAmount)}</td>
                  <td>{money(asNumber(item.cgstAmount) + asNumber(item.sgstAmount) + asNumber(item.igstAmount))}</td>
                  <td>{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="invoice-summary">
            <span>Subtotal <strong>{money(selectedInvoice.subtotal)}</strong></span>
            <span>Total Discount <strong>{money(selectedInvoice.totalDiscount)}</strong></span>
            <span>CGST <strong>{money(selectedInvoice.cgstTotal)}</strong></span>
            <span>SGST <strong>{money(selectedInvoice.sgstTotal)}</strong></span>
            <span>IGST <strong>{money(selectedInvoice.igstTotal)}</strong></span>
            <span>Grand Total <strong>{money(selectedInvoice.grandTotal)}</strong></span>
            <span>Advance Paid <strong>{money(selectedInvoice.advancePaid)}</strong></span>
            <span>Balance Due <strong>{money(selectedInvoice.balanceDue)}</strong></span>
          </div>
        </section>
      )}
    </div>
  );
}
