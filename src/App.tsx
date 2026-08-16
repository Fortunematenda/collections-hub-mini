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
import UsersPage from './pages/Users';
import Integrations from './pages/Integrations';
import Automations from './pages/Automations';

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
              <Route element={<ProtectedRoute permission="recovery.manage" />}>
                <Route path="recovery" element={<Recovery />} />
              </Route>
              <Route element={<ProtectedRoute permission="imports.manage" />}>
                <Route path="imports" element={<Imports />} />
              </Route>
              <Route element={<ProtectedRoute permission="templates.manage" />}>
                <Route path="templates" element={<Templates />} />
              </Route>
              <Route path="communications" element={<Communications />} />
              <Route element={<ProtectedRoute permission="settings.manage" />}>
                <Route path="integrations" element={<Integrations />} />
              </Route>
              <Route element={<ProtectedRoute permission="collections.manage" />}>
                <Route path="automations" element={<Automations />} />
              </Route>
              <Route element={<ProtectedRoute permission="users.manage" />}>
                <Route path="users" element={<UsersPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="roles.manage" />}>
                <Route path="roles" element={<RolesPermissions />} />
              </Route>
              <Route element={<ProtectedRoute permission="settings.manage" />}>
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
