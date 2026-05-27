import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

const CUSTOMER_TYPES = [
  { value: 'RETAIL', label: 'Retail' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'GOVERNMENT', label: 'Government' },
];

const PAYMENT_TYPES = ['CASH', 'CREDIT', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const EMPTY_CUSTOMER = {
  companyName: '',
  phone: '',
  email: '',
  gstin: '',
  panNumber: '',
  address: '',
  shippingAddress: '',
  customerType: 'CONTRACTOR',
  creditLimit: '',
  notes: '',
};

const EMPTY_ITEM = { productId: '', quantity: '', rate: '', discount: '' };

function extractState(address) {
  const text = String(address || '').toLowerCase();
  return INDIAN_STATES.find((state) => text.includes(state.toLowerCase())) || '';
}

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

function roundMoney(value) {
  return Math.round((asNumber(value) + Number.EPSILON) * 100) / 100;
}

function numberToWordsIndian(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const belowHundred = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`);
  const belowThousand = (n) => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return `${hundred ? `${ones[hundred]} Hundred` : ''}${hundred && rest ? ' ' : ''}${rest ? belowHundred(rest) : ''}`;
  };

  const rupees = Math.floor(asNumber(amount));
  if (!rupees) return 'Rupees Zero Only';
  const parts = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return `Rupees ${parts.join(' ')} Only`;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(EMPTY_CUSTOMER);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    paymentType: 'CASH',
    customerId: '',
    customerSearch: '',
    placeOfSupply: '',
    advancePaid: '',
    items: [{ ...EMPTY_ITEM }],
  });

  const load = () => {
    const search = customerSearch ? `?search=${encodeURIComponent(customerSearch)}` : '';
    api(`/customers${search}`).then(setCustomers);
    api('/products?status=APPROVED').then(setProducts);
    api('/invoices').then(setInvoices);
    api('/invoices/next-number').then((data) => {
      setInvoiceForm((current) => current.invoiceNumber ? current : { ...current, invoiceNumber: data.invoiceNumber });
    });
  };

  useEffect(load, [customerSearch]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const filteredInvoiceCustomers = useMemo(() => {
    const search = invoiceForm.customerSearch.trim().toLowerCase();
    if (!search) return customers;
    return customers.filter((customer) =>
      [customer.companyName, customer.phone, customer.gstin]
        .some((value) => value?.toLowerCase().includes(search))
    );
  }, [customers, invoiceForm.customerSearch]);

  const selectedInvoiceCustomer = useMemo(
    () => customers.find((customer) => customer.id === invoiceForm.customerId),
    [customers, invoiceForm.customerId]
  );

  const invoiceTotals = useMemo(() => {
    const billingState = extractState(selectedInvoiceCustomer?.address);
    const gstType = billingState && invoiceForm.placeOfSupply === billingState ? 'CGST_SGST' : 'IGST';
    const lines = invoiceForm.items.map((item) => {
      const product = productById.get(item.productId);
      const quantity = asNumber(item.quantity);
      const rate = asNumber(item.rate || product?.sellingPrice);
      const discount = asNumber(item.discount);
      const gstPercent = asNumber(product?.gstPercent);
      const gross = roundMoney(quantity * rate);
      const taxable = roundMoney(gross - discount);
      const gst = roundMoney((taxable * gstPercent) / 100);
      return {
        gross,
        discount,
        taxable,
        cgst: gstType === 'CGST_SGST' ? roundMoney(gst / 2) : 0,
        sgst: gstType === 'CGST_SGST' ? roundMoney(gst / 2) : 0,
        igst: gstType === 'IGST' ? gst : 0,
        total: roundMoney(taxable + gst),
      };
    });
    const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.gross, 0));
    const totalDiscount = roundMoney(lines.reduce((sum, line) => sum + line.discount, 0));
    const cgstTotal = roundMoney(lines.reduce((sum, line) => sum + line.cgst, 0));
    const sgstTotal = roundMoney(lines.reduce((sum, line) => sum + line.sgst, 0));
    const igstTotal = roundMoney(lines.reduce((sum, line) => sum + line.igst, 0));
    const totalGst = roundMoney(cgstTotal + sgstTotal + igstTotal);
    const grandTotal = roundMoney(subtotal + totalGst - totalDiscount);
    const balanceDue = roundMoney(grandTotal - asNumber(invoiceForm.advancePaid));
    return { subtotal, totalDiscount, cgstTotal, sgstTotal, igstTotal, totalGst, grandTotal, balanceDue, gstType };
  }, [invoiceForm.items, invoiceForm.placeOfSupply, invoiceForm.advancePaid, productById, selectedInvoiceCustomer]);

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api('/customers', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          creditLimit: asNumber(form.creditLimit),
        }),
      });
      setForm(EMPTY_CUSTOMER);
      setMessage('Customer onboarded.');
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const updateInvoiceItem = (index, patch) => {
    setInvoiceForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.productId) {
          const product = productById.get(patch.productId);
          next.rate = product?.sellingPrice || '';
        }
        return next;
      }),
    }));
  };

  const createInvoice = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const created = await api('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: invoiceForm.invoiceNumber,
          invoiceDate: invoiceForm.invoiceDate,
          dueDate: invoiceForm.dueDate || undefined,
          paymentType: invoiceForm.paymentType,
          customerId: invoiceForm.customerId,
          placeOfSupply: invoiceForm.placeOfSupply,
          advancePaid: asNumber(invoiceForm.advancePaid),
          items: invoiceForm.items
            .filter((item) => item.productId && item.quantity)
            .map((item) => ({
              productId: item.productId,
              quantity: asNumber(item.quantity),
              rate: asNumber(item.rate || productById.get(item.productId)?.sellingPrice),
              discount: asNumber(item.discount),
            })),
        }),
      });
      setSelectedInvoice(created);
      setInvoiceForm({
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: '',
        paymentType: 'CASH',
        customerId: '',
        customerSearch: '',
        placeOfSupply: '',
        advancePaid: '',
        items: [{ ...EMPTY_ITEM }],
      });
      setMessage(`Invoice ${created.invoiceNumber} generated.`);
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

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
      <PageHeader title="Customers & Invoices" subtitle="Customer onboarding, ledger, GST invoice generation" />

      <section className="panel">
        <h3>Onboard Customer</h3>
        <form className="form-grid" onSubmit={handleCustomerSubmit}>
          <label>
            Full Name / Company Name
            <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required placeholder="Sharma Constructions" />
          </label>
          <label>
            Phone Number
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="9876543210" maxLength="10" />
          </label>
          <label>
            Email Address
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="accounts@example.com" />
          </label>
          <label>
            GSTIN
            <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} maxLength="15" placeholder="29ABCDE1234F1Z5" />
          </label>
          <label>
            PAN Number
            <input value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} maxLength="10" placeholder="ABCDE1234F" />
          </label>
          <label>
            Customer Type
            <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
              {CUSTOMER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label>
            Credit Limit (INR)
            <input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} placeholder="500000" />
          </label>
          <label className="span-2">
            Billing Address
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required placeholder="Street, City, State, PIN" />
          </label>
          <label className="span-2">
            Shipping Address
            <textarea value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} placeholder="If different from billing address" />
          </label>
          <label className="span-2">
            Notes
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes" />
          </label>
          <button type="submit" className="btn-primary">Save Customer</button>
        </form>
        {message && <p className="form-note">{message}</p>}
      </section>

      <section className="panel">
        <h3>Create Invoice</h3>
        <form className="form-grid" onSubmit={createInvoice}>
          <label>
            Invoice ID
            <input value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} required />
          </label>
          <label>
            Invoice Date
            <input type="date" value={invoiceForm.invoiceDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })} required />
          </label>
          <label>
            Due Date
            <input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
          </label>
          <label>
            Payment Type
            <select value={invoiceForm.paymentType} onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentType: e.target.value })}>
              {PAYMENT_TYPES.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label>
            Search Customer
            <input value={invoiceForm.customerSearch} onChange={(e) => setInvoiceForm({ ...invoiceForm, customerSearch: e.target.value })} placeholder="Name, phone, GSTIN" />
          </label>
          <label>
            Select Customer
            <select
              value={invoiceForm.customerId}
              onChange={(e) => {
                const customer = customers.find((c) => c.id === e.target.value);
                setInvoiceForm({
                  ...invoiceForm,
                  customerId: e.target.value,
                  placeOfSupply: extractState(customer?.shippingAddress) || extractState(customer?.address) || invoiceForm.placeOfSupply,
                });
              }}
              required
            >
              <option value="">Select customer</option>
              {filteredInvoiceCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.companyName} - {customer.phone}</option>)}
            </select>
          </label>
          <label>
            Place of Supply
            <select value={invoiceForm.placeOfSupply} onChange={(e) => setInvoiceForm({ ...invoiceForm, placeOfSupply: e.target.value })} required>
              <option value="">Select shipping state</option>
              {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
          <label>
            Billing State
            <input value={extractState(selectedInvoiceCustomer?.address) || 'Add state in billing address'} readOnly />
          </label>
          <label>
            Amount Paid in Advance
            <input type="number" value={invoiceForm.advancePaid} onChange={(e) => setInvoiceForm({ ...invoiceForm, advancePaid: e.target.value })} />
          </label>

          <div className="span-2 invoice-lines">
            <div className="panel-toolbar compact-toolbar">
              <h3>Line Items</h3>
              <button type="button" className="btn-ghost" onClick={() => setInvoiceForm({ ...invoiceForm, items: [...invoiceForm.items, { ...EMPTY_ITEM }] })}>Add Item</button>
            </div>
            {invoiceForm.items.map((item, index) => {
              const product = productById.get(item.productId);
              return (
                <div className="form-grid nested-form-grid" key={index}>
                  <label>
                    Product
                    <select value={item.productId} onChange={(e) => updateInvoiceItem(index, { productId: e.target.value })} required>
                      <option value="">Select product</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stockQty} left)</option>)}
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input type="number" value={item.quantity} onChange={(e) => updateInvoiceItem(index, { quantity: e.target.value })} required />
                  </label>
                  <label>
                    Rate
                    <input type="number" value={item.rate} onChange={(e) => updateInvoiceItem(index, { rate: e.target.value })} required />
                  </label>
                  <label>
                    Discount
                    <input type="number" value={item.discount} onChange={(e) => updateInvoiceItem(index, { discount: e.target.value })} />
                  </label>
                  <label>
                    GST %
                    <input value={product?.gstPercent || ''} readOnly />
                  </label>
                  {invoiceForm.items.length > 1 && <button type="button" className="btn-ghost" onClick={() => setInvoiceForm({ ...invoiceForm, items: invoiceForm.items.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>}
                </div>
              );
            })}
          </div>

          <div className="span-2 invoice-summary">
            <span>Subtotal <strong>{money(invoiceTotals.subtotal)}</strong></span>
            <span>Total Discount <strong>{money(invoiceTotals.totalDiscount)}</strong></span>
            <span>CGST <strong>{money(invoiceTotals.cgstTotal)}</strong></span>
            <span>SGST <strong>{money(invoiceTotals.sgstTotal)}</strong></span>
            <span>IGST <strong>{money(invoiceTotals.igstTotal)}</strong></span>
            <span>Total GST <strong>{money(invoiceTotals.totalGst)}</strong></span>
            <span>Grand Total <strong>{money(invoiceTotals.grandTotal)}</strong></span>
            <span>Balance Due <strong>{money(invoiceTotals.balanceDue)}</strong></span>
            <span className="span-2">Amount in Words <strong>{numberToWordsIndian(invoiceTotals.grandTotal)}</strong></span>
          </div>

          <button type="submit" className="btn-primary">Generate Invoice</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-toolbar stockin-toolbar">
          <h3>View All Customers</h3>
          <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search name, phone, GSTIN" />
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
                  </tr>
                );
              })}
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
