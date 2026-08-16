import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ permission, anyOf }: { permission?: string; anyOf?: string[] }) {
  const { isAuthenticated, loading, hasPermission, hasAnyPermission, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center mih="100vh">
        <Loader color="indigo" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname, expired: sessionStorage.getItem('ch_session_expired') === '1' }} />;
  }

  const allowed =
    user?.role === 'admin' ||
    (!permission && !anyOf?.length) ||
    (permission ? hasPermission(permission) : false) ||
    (anyOf?.length ? hasAnyPermission(...anyOf) : false);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
