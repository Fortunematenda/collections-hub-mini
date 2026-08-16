import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Anchor, Button, Checkbox, Group, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { Check, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { consumeSessionExpired, forgotPasswordRequest, resetPasswordRequest } from '../api/auth';
import { BrandMark } from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from '../lib/notify';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from || '/';
  const resetToken = params.get('reset') || '';
  const expiredWarned = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const canSubmit = EMAIL_OK.test(email.trim()) && password.length > 0 && !submitting && !loading;

  useEffect(() => {
    if (expiredWarned.current) return;
    if (consumeSessionExpired() || (location.state as { expired?: boolean } | null)?.expired) {
      expiredWarned.current = true;
      notifyWarning('Your session ended. Please sign in again.', { title: 'Session expired' });
    }
  }, [location.state]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      document.documentElement.style.setProperty('--vv-offset', `${Math.max(0, window.innerHeight - viewport.height)}px`);
    };
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    sync();
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      document.documentElement.style.removeProperty('--vv-offset');
    };
  }, []);

  if (!loading && isAuthenticated && !resetToken) {
    return <Navigate to={from} replace />;
  }

  function onCaps(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState('CapsLock'));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    const result = await login(email.trim(), password, remember);
    setSubmitting(false);
    if (!result.ok) {
      const message = result.error || 'The email or password is incorrect.';
      setError(message);
      notifyError(message, { title: 'Sign in failed' });
      return;
    }
    navigate(from === '/login' ? '/' : from, { replace: true });
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    setForgotBusy(true);
    const result = await forgotPasswordRequest(forgotEmail.trim() || email.trim());
    setForgotBusy(false);
    setForgotOpen(false);
    notifyInfo(result.message, { title: 'Check your email' });
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setError(newPassword !== confirmPassword ? 'Passwords do not match.' : 'Use at least 8 characters.');
      return;
    }
    setSubmitting(true);
    const result = await resetPasswordRequest(resetToken, newPassword);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Unable to reset password.');
      notifyError(result.error || 'Unable to reset password.');
      return;
    }
    notifySuccess('Password updated. Sign in with your new password.');
    setParams({}, { replace: true });
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  }

  const form = resetToken ? (
    <form className="login-card" onSubmit={onReset}>
      <div className="login-card-copy">
        <h2>Set a new password</h2>
        <p>Choose a password with at least 8 characters.</p>
      </div>
      <Stack gap="lg" mt="lg">
        <PasswordInput
          label="New password"
          required
          placeholder="New password"
          autoComplete="new-password"
          leftSection={<LockKeyhole size={15} />}
          value={newPassword}
          error={error || undefined}
          onChange={(e) => {
            setNewPassword(e.currentTarget.value);
            if (error) setError('');
          }}
          classNames={{ input: 'login-field' }}
        />
        <PasswordInput
          label="Confirm password"
          required
          placeholder="Confirm password"
          autoComplete="new-password"
          leftSection={<LockKeyhole size={15} />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.currentTarget.value)}
          classNames={{ input: 'login-field' }}
        />
        <Button type="submit" fullWidth className="login-submit" loading={submitting} disabled={newPassword.length < 8}>
          Update password
        </Button>
      </Stack>
    </form>
  ) : (
    <form className="login-card" onSubmit={onSubmit} autoComplete="off">
      <div className="login-card-copy">
        <h2>Welcome back</h2>
        <p>Sign in to manage collections, customer communication and account recovery.</p>
        <span className="login-access">Secure workspace access</span>
      </div>
      <Stack gap="lg" mt="md">
        <TextInput
          label="Work email"
          type="email"
          required
          placeholder="you@company.com"
          autoComplete="username"
          name="work-email"
          leftSection={<Mail size={15} />}
          value={email}
          onChange={(e) => {
            setEmail(e.currentTarget.value);
            if (error) setError('');
          }}
          classNames={{ input: 'login-field' }}
        />
        <div>
          <PasswordInput
            label="Password"
            required
            placeholder="Password"
            autoComplete="current-password"
            leftSection={<LockKeyhole size={15} />}
            value={password}
            error={error || undefined}
            onKeyDown={onCaps}
            onKeyUp={onCaps}
            onChange={(e) => {
              setPassword(e.currentTarget.value);
              if (error) setError('');
            }}
            classNames={{ input: 'login-field' }}
            visibilityToggleButtonProps={{ 'aria-label': 'Show or hide password' }}
          />
          {capsLock && (
            <Text size="xs" c="orange" mt={6}>
              Caps Lock is on
            </Text>
          )}
        </div>
        <Group justify="space-between" align="center">
          <Checkbox
            size="sm"
            label="Remember me"
            checked={remember}
            onChange={(e) => setRemember(e.currentTarget.checked)}
          />
          <Anchor
            component="button"
            type="button"
            size="sm"
            onClick={() => {
              setForgotEmail(email);
              setForgotOpen(true);
            }}
          >
            Forgot password?
          </Anchor>
        </Group>
        <Button type="submit" fullWidth className="login-submit" loading={submitting || loading} disabled={!canSubmit}>
          Sign in securely
        </Button>
      </Stack>
      <div className="login-trust">
        <ShieldCheck size={14} />
        Secure access · Company data is isolated by portfolio
      </div>
      <p className="login-help">Having trouble signing in? Contact your administrator.</p>
    </form>
  );

  return (
    <div className="login-page">
      <div className="login-scene" aria-hidden="true">
        <svg className="login-waves" viewBox="0 0 1440 420" preserveAspectRatio="none">
          <path fill="rgba(79,110,247,.16)" d="M0,260 C180,210 320,320 520,280 C760,230 900,140 1120,190 C1280,225 1380,250 1440,240 L1440,420 L0,420 Z" />
          <path fill="rgba(79,110,247,.22)" d="M0,300 C220,250 380,360 620,310 C880,250 1040,200 1240,250 C1340,275 1400,290 1440,285 L1440,420 L0,420 Z" />
          <path fill="rgba(8,20,38,.55)" d="M0,350 C260,310 420,380 700,345 C980,308 1180,300 1440,335 L1440,420 L0,420 Z" />
        </svg>
        <div className="login-float">
          <span>CH</span>
          <span>CH</span>
          <span>R</span>
          <span>CH</span>
          <span>R</span>
          <span>CH</span>
        </div>
      </div>

      <section className="login-promo">
        <div className="login-promo-brand">
          <BrandMark size={52} />
          <strong>Collections Hub</strong>
        </div>
        <h1>Smarter payment follow-ups across every company.</h1>
        <ul>
          <li>
            <Check size={15} /> Multi-company collections
          </li>
          <li>
            <Check size={15} /> WhatsApp and email automation
          </li>
          <li>
            <Check size={15} /> Promises and recovery tracking
          </li>
          <li>
            <Check size={15} /> Splynx, Sage and Xero ready
          </li>
        </ul>
        <p className="login-promo-quote">Recover revenue without replacing your existing systems.</p>
      </section>

      <div className="login-panel">
        <div className="login-mobile-brand">
          <BrandMark size={52} />
          <div className="brand-title">Collections Hub</div>
        </div>
        {form}
      </div>

      <Modal opened={forgotOpen} onClose={() => setForgotOpen(false)} title="Reset password" radius={16} centered>
        <form onSubmit={onForgot}>
          <Text size="sm" c="dimmed" mb="md">
            Enter your work email. If it is on this workspace, we will send reset instructions.
          </Text>
          <TextInput
            type="email"
            required
            placeholder="you@company.com"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.currentTarget.value)}
            classNames={{ input: 'login-field' }}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" type="button" onClick={() => setForgotOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={forgotBusy} disabled={!EMAIL_OK.test(forgotEmail.trim())}>
              Send instructions
            </Button>
          </Group>
        </form>
      </Modal>
    </div>
  );
}
