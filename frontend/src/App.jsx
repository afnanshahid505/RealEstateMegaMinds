import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import CustomersList from './pages/admin/CustomersList';
import AdminCustomers from './pages/admin/Customers';
import AdminExpenses from './pages/admin/Expenses';
import ExpensesTable from './pages/admin/ExpensesTable';
import AccountReport from './pages/admin/AccountReport';
import StaffAccounts from './pages/admin/StaffAccounts';
import StaffRawMaterials from './pages/staff/RawMaterials';
import StaffProduction from './pages/staff/Production';
import StaffStockIn from './pages/staff/StockIn';
import StaffProductsView from './pages/staff/ProductsView';
import StaffProfile from './pages/staff/Profile';
import StockOutPage from './pages/shared/StockOut';
import ProductionReport from './pages/shared/ProductionReport';
import StockReport from './pages/admin/StockReport';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="loading">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/staff'} replace />;
  }
  return children;
}

const adminNav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/raw-materials', label: 'Raw Materials' },
  { to: '/admin/production', label: 'Production' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/staff-accounts', label: 'Staff Accounts' },
  { to: '/admin/stock-in', label: 'Stock In' },
  { to: '/admin/stock-out', label: 'Stock Out' },
  { to: '/admin/expenses', label: 'Expenses' },
  { to: '/admin/production-report', label: 'Production Report' },
  { to: '/admin/stock-report', label: 'Stock Report' },
  { to: '/admin/account-report', label: 'Account Report' },
];

const staffNav = [
  { to: '/staff', label: 'Raw Materials', end: true },
  { to: '/staff/production', label: 'Production' },
  { to: '/staff/stock-in', label: 'Stock In' },
  { to: '/staff/stock-out', label: 'Stock Out' },
  { to: '/staff/products', label: 'Products' },
  { to: '/staff/profile', label: 'Profile' },
];

function AdminShell() {
  return (
    <Layout navItems={adminNav} title="Admin Control Room" badge="ADMIN" />
  );
}

function StaffShell() {
  return (
    <Layout navItems={staffNav} title="Staff Operations" badge="STAFF" />
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <p className="loading center">Loading…</p>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : '/staff'} /> : <Login />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="raw-materials" element={<StaffRawMaterials />} />
        <Route path="production" element={<StaffProduction />} />
        <Route path="customers" element={<CustomersList />} />
        <Route path="customers/invoice" element={<AdminCustomers />} />
        <Route path="staff-accounts" element={<StaffAccounts />} />
        <Route path="stock-in" element={<StaffStockIn />} />
        <Route path="stock-out" element={<StockOutPage />} />
        <Route path="expenses" element={<AdminExpenses />} />
        <Route path="expenses/table" element={<ExpensesTable />} />
        <Route path="production-report" element={<ProductionReport />} />
        <Route path="stock-report" element={<StockReport />} />
        <Route path="account-report" element={<AccountReport />} />
      </Route>
      <Route
        path="/staff"
        element={
          <ProtectedRoute role="STAFF">
            <StaffShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<StaffRawMaterials />} />
        <Route path="production" element={<StaffProduction />} />
        <Route path="stock-in" element={<StaffStockIn />} />
        <Route path="stock-out" element={<StockOutPage />} />
        <Route path="products" element={<StaffProductsView />} />
        <Route path="profile" element={<StaffProfile />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? (user.role === 'ADMIN' ? '/admin' : '/staff') : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
