import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

const EMPTY_FORM = { name: '', post: '', email: '', password: '' };

export default function StaffAccounts() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState('');

  const load = () => {
    api('/users/staff').then(setStaff);
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api('/users/staff', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm(EMPTY_FORM);
      setMessage('Staff account created.');
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="Staff Accounts" subtitle="Create staff login accounts for factory operations" />

      <section className="panel">
        <h3>Create Staff Account</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Post
            <input value={form.post} onChange={(e) => setForm({ ...form, post: e.target.value })} required placeholder="Store Manager" />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength="6" />
          </label>
          <button type="submit" className="btn-primary">Create Staff</button>
        </form>
        {message && <p className="form-note">{message}</p>}
      </section>

      <section className="panel">
        <h3>Staff List</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Post</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.post || '-'}</td>
                <td>{user.phone || '-'}</td>
                <td>{user.email}</td>
                <td>{new Date(user.createdAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
            {staff.length === 0 && <tr><td colSpan="5">No staff accounts found.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
