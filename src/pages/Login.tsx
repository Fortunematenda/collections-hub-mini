import { useState } from 'react';
import { Alert, Button, Card, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { LockKeyhole, Mail } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Unable to sign in.');
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <div className="brand-mark">CH</div>
          <div>
            <div className="brand-title">Collections Hub</div>
            <div className="brand-sub">Admin sign in</div>
          </div>
        </div>

        <Card className="login-card" radius="lg" p="xl" component="form" onSubmit={onSubmit}>
          <Text fw={750} size="lg" mb={4}>
            Welcome back
          </Text>
          <Text size="sm" c="dimmed" mb="lg">
            Sign in with your admin account to manage collections portfolios.
          </Text>

          <Stack gap="md">
            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}
            <TextInput
              label="Email"
              type="email"
              required
              placeholder="Email address"
              autoComplete="username"
              leftSection={<Mail size={14} />}
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
              label="Password"
              required
              placeholder="Password"
              autoComplete="current-password"
              leftSection={<LockKeyhole size={14} />}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            <Button type="submit" fullWidth loading={submitting || loading}>
              Sign in
            </Button>
          </Stack>
        </Card>
      </div>
    </div>
  );
}
