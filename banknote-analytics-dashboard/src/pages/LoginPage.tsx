import { FormEvent, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { resetPassword } from '@/lib/api';

type Mode = 'login' | 'forgot' | 'done';

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await resetPassword({
        username: username.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      setPassword('');
      setConfirmPassword('');
      setMode('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      {mode === 'login' && (
        <form className="login-card" onSubmit={onLogin}>
          <h1>Product Analytics</h1>
          <p>Sign in with your dashboard account.</p>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="login-link" onClick={() => { setError(''); setMode('forgot'); }}>
            Forgot password?
          </button>
        </form>
      )}

      {mode === 'forgot' && (
        <form className="login-card" onSubmit={onForgot}>
          <h1>Reset password</h1>
          <p>Enter the username and the email on that account. If they match, you can set a new password.</p>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            Email on the account
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Change password'}
          </button>
          <button type="button" className="login-link" onClick={() => { setError(''); setMode('login'); }}>
            Back to sign in
          </button>
        </form>
      )}

      {mode === 'done' && (
        <div className="login-card">
          <h1>Password updated</h1>
          <p>You can sign in with your new password now.</p>
          <button type="button" onClick={() => { setPassword(''); setMode('login'); }}>
            Sign in
          </button>
        </div>
      )}
    </div>
  );
}
