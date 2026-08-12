import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import Accounts from './pages/Accounts';
import Communications from './pages/Communications';
import Companies from './pages/Companies';
import CompanyDetails from './pages/CompanyDetails';
import CustomerDetails from './pages/CustomerDetails';
import Dashboard from './pages/Dashboard';
import Followups from './pages/Followups';
import Imports from './pages/Imports';
import Login from './pages/Login';
import Promises from './pages/Promises';
import Recovery from './pages/Recovery';
import Settings from './pages/Settings';
import Templates from './pages/Templates';
import RolesPermissions from './pages/RolesPermissions';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <AppProvider>
                  <AppLayout />
                </AppProvider>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="companies" element={<Companies />} />
              <Route path="companies/:companyId" element={<CompanyDetails />} />
              <Route path="customers/:customerId" element={<CustomerDetails />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="followups" element={<Followups />} />
              <Route path="promises" element={<Promises />} />
              <Route path="recovery" element={<Recovery />} />
              <Route path="imports" element={<Imports />} />
              <Route path="templates" element={<Templates />} />
              <Route path="communications" element={<Communications />} />
              <Route path="roles" element={<RolesPermissions />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
