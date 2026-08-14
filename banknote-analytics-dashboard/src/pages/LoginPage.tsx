import { FormEvent, useState } from 'react';
import { BarChart3, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { resetPassword } from '@/lib/api';
import { useToast } from '@/lib/toast';

type Mode = 'login' | 'forgot' | 'done';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(username.trim(), password);
      toast.success('Signed in', `Welcome back${username.trim() ? `, ${username.trim()}` : ''}`);
    } catch (err) {
      toast.error('Sign in failed', err instanceof Error ? err.message : 'Check your username and password');
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match', 'Enter the same new password in both fields');
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
      toast.success('Password updated', 'You can sign in with the new password');
    } catch (err) {
      toast.error('Could not reset password', err instanceof Error ? err.message : 'Username and email must match the account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-bg" aria-hidden />
      {mode === 'login' && (
        <form className="login-card" onSubmit={onLogin}>
          <div className="login-brand">
            <span className="login-mark"><BarChart3 size={22} /></span>
            <div>
              <h1>Product Analytics</h1>
              <p>Banknote & Coinzy</p>
            </div>
          </div>
          <p className="login-lead">Sign in to view dashboards, funnels, and access controls.</p>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
            />
          </label>
          <label>
            Password
            <span className="login-password">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          <button type="submit" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="login-link"
            onClick={() => setMode('forgot')}
          >
            Forgot password?
          </button>
        </form>
      )}

      {mode === 'forgot' && (
        <form className="login-card" onSubmit={onForgot}>
          <div className="login-brand">
            <span className="login-mark"><KeyRound size={22} /></span>
            <div>
              <h1>Reset password</h1>
              <p>Verify account email</p>
            </div>
          </div>
          <p className="login-lead">Username and email must match the account. Then set a new password.</p>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
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
              placeholder="you@company.com"
              required
            />
          </label>
          <label>
            New password
            <span className="login-password">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="At least 8 characters"
                required
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
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
          <button type="submit" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null}
            {busy ? 'Updating…' : 'Change password'}
          </button>
          <button type="button" className="login-link" onClick={() => setMode('login')}>
            Back to sign in
          </button>
        </form>
      )}

      {mode === 'done' && (
        <div className="login-card login-done">
          <span className="login-mark success"><CheckCircle2 size={22} /></span>
          <h1>Password updated</h1>
          <p className="login-lead">You can sign in with your new password now.</p>
          <button type="button" onClick={() => { setPassword(''); setMode('login'); }}>
            Sign in
          </button>
        </div>
      )}
    </div>
  );
}
