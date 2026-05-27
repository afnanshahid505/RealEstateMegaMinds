import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/Layout';

export default function StaffProfile() {
  const [profile, setProfile] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');

  const load = () => {
    api('/users/me').then(({ user }) => setProfile(user));
  };

  useEffect(load, []);

  const changePassword = async (e) => {
    e.preventDefault();
    setMessage('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage('New password and confirmation do not match.');
      return;
    }

    try {
      await api('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Password changed successfully.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="My Profile" subtitle="View staff profile details and change password" />

      <section className="panel">
        <h3>Profile Details</h3>
        <table className="data-table">
          <tbody>
            <tr><th>Name</th><td>{profile?.name || '-'}</td></tr>
            <tr><th>Post</th><td>{profile?.post || '-'}</td></tr>
            <tr><th>Email</th><td>{profile?.email || '-'}</td></tr>
            <tr><th>Role</th><td>{profile?.role || '-'}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Change Password</h3>
        <form className="form-grid" onSubmit={changePassword}>
          <label>
            Current Password
            <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required />
          </label>
          <label>
            New Password
            <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required minLength="6" />
          </label>
          <label>
            Confirm New Password
            <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required minLength="6" />
          </label>
          <button type="submit" className="btn-primary">Change Password</button>
        </form>
        {message && <p className="form-note">{message}</p>}
      </section>
    </div>
  );
}
