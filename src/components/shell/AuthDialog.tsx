import { useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Dialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';
import type { AuthTab } from './shellServices.ts';

// Auth dialog: Sign in / Create account tabs. Real labels, autocomplete
// hints, show/hide password, role="alert" errors, loading state. Switching
// tabs clears the error. Auth behaviour itself lives untouched in
// AuthContext.

interface AuthDialogProps {
  open: boolean;
  tab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
  onClose: () => void;
}

export function AuthDialog({ open, tab, onTabChange, onClose }: AuthDialogProps) {
  const { login, register, error, loading, clearError } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({ email: '', password: '', username: '' });
  const [showPassword, setShowPassword] = useState(false);

  const isLogin = tab === 'signin';

  const switchTab = (next: AuthTab) => {
    if (next === tab) return;
    onTabChange(next);
    clearError();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (isLogin) {
        const success = await login({ email: formData.email, password: formData.password });
        if (success) {
          showToast('Welcome back to the market', 'success');
          onClose();
        }
      } else {
        const success = await register(formData);
        if (success) {
          showToast('Your account is ready — welcome to the market', 'success');
          onClose();
        }
      }
    } catch {
      // handled by context
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={isLogin ? 'Sign in' : 'Create account'}>
      <div role="tablist" aria-label="Authentication" className="flex rounded-[10px] border border-rule bg-surface-2 p-1 gap-1 mb-5">
        <button
          type="button"
          role="tab"
          aria-selected={isLogin}
          onClick={() => switchTab('signin')}
          className={`flex-1 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
            isLogin ? 'bg-surface-3 text-ink shadow-sm' : 'text-ink-mute hover:text-ink'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isLogin}
          onClick={() => switchTab('register')}
          className={`flex-1 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
            !isLogin ? 'bg-surface-3 text-ink shadow-sm' : 'text-ink-mute hover:text-ink'
          }`}
        >
          Create account
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-down/50 bg-down/10 px-3 py-2" role="alert">
          <p className="text-sm text-down">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label htmlFor="auth-username" className="label block mb-1.5">Username</label>
            <input
              id="auth-username"
              type="text"
              name="username"
              autoComplete="username"
              value={formData.username}
              onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
              className="input-ink"
              placeholder="e.g. night_owl"
              required={!isLogin}
            />
          </div>
        )}

        <div>
          <label htmlFor="auth-email" className="label block mb-1.5">Email address</label>
          <input
            id="auth-email"
            type="email"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className="input-ink"
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label htmlFor="auth-password" className="label block mb-1.5">
            Password
            {!isLogin && <span className="normal-case font-normal text-ink-mute"> — at least 6 characters</span>}
          </label>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              className="input-ink pr-12"
              required
              minLength={isLogin ? undefined : 6}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-ink-mute hover:text-ink"
            >
              {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <Button type="submit" variant="primary" block disabled={loading}>
          {loading ? 'One moment…' : isLogin ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <p className="text-xs text-ink-mute text-center mt-4">
        Virtual GBP only — no real money, ever.
      </p>
    </Dialog>
  );
}
