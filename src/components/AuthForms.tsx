import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { requestPasswordReset } from '../services/authService';
import { mapAuthError } from '../services/errorMapper';

interface AuthFormsProps {
  onClose: () => void;
}

export function AuthForms({ onClose }: AuthFormsProps) {
  const [isLogin, setIsLogin] = useState(true);
  const {
    login, register, completeProfile, needsProfile,
    error, loading, clearError, user,
  } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });
  const [mode, setMode] = useState<'auth' | 'complete_profile' | 'reset'>('auth');
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (needsProfile && !user) setMode('complete_profile');
  }, [needsProfile, user]);

  useEffect(() => {
    if (user) onClose();
  }, [user, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'reset') {
        setResetBusy(true);
        try {
          await requestPasswordReset(formData.email);
          showToast('If that email exists, a reset link is on its way.', 'info');
          setMode('auth');
          setIsLogin(true);
        } catch (err) {
          showToast(mapAuthError(err), 'error');
        } finally {
          setResetBusy(false);
        }
        return;
      }

      if (mode === 'complete_profile') {
        const result = await completeProfile(formData.username);
        if (result.ok && result.status === 'ready') {
          showToast('Your virtual exchange account is ready.', 'success');
          onClose();
        }
        return;
      }

      if (isLogin) {
        const result = await login(formData.email, formData.password);
        if (!result.ok) return;
        if (result.status === 'ready') {
          showToast('Welcome back to the exchange', 'success');
          onClose();
          return;
        }
        if (result.status === 'needs_profile') {
          setMode('complete_profile');
          showToast('Choose a username to finish setup.', 'info');
        }
      } else {
        const result = await register(formData.email, formData.password, formData.username);
        if (!result.ok) return;
        if (result.status === 'ready') {
          showToast('Your virtual exchange account is ready.', 'success');
          onClose();
          return;
        }
        if (result.status === 'confirm_email') {
          showToast(
            'Check your email to confirm your account, then sign in.',
            'info',
          );
          setIsLogin(true);
          return;
        }
        if (result.status === 'needs_profile') {
          setMode('complete_profile');
        }
      }
    } catch {
      // handled by context
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const title =
    mode === 'complete_profile'
      ? 'Finish setup'
      : mode === 'reset'
        ? 'Reset password'
        : isLogin
          ? 'Welcome\u00a0back'
          : 'Join\u00a0CoinX';
  const subtitle =
    mode === 'complete_profile'
      ? 'Pick a display username for the exchange'
      : mode === 'reset'
        ? 'We will email a recovery link'
        : isLogin
          ? 'Secure account access'
          : 'Create account';

  return (
    <div className="w-full max-w-md mx-auto py-4">
      <div className="text-center mb-8">
        <div className="label mb-3">{subtitle}</div>
        <h2 className="font-display text-5xl font-semibold text-ink leading-none"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 50" }}>
          {title}
        </h2>
        <div className="ornament mt-5">
          <span className="asset-mark !w-8 !h-8">CX</span>
        </div>
      </div>

      {error && mode !== 'reset' && (
        <div className="mb-6 border-l-2 border-oxblood px-4 py-3 bg-card">
          <div className="label text-oxblood mb-1">
            {mode === 'complete_profile'
              ? 'Setup incomplete'
              : isLogin
                ? 'Access Denied'
                : 'Registration Failed'}
          </div>
          <p className="font-mono text-xs text-ink-dim">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {(mode === 'complete_profile' || (mode === 'auth' && !isLogin)) && (
          <div>
            <label className="label block mb-2">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="input-ink"
              placeholder="e.g. j_dupont"
              required
              autoComplete="username"
            />
          </div>
        )}

        {(mode === 'auth' || mode === 'reset') && (
          <div>
            <label className="label block mb-2">Email address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input-ink"
              placeholder="you@elsewhere.co"
              required
              autoComplete="email"
            />
          </div>
        )}

        {mode === 'auth' && (
          <div>
            <label className="label block mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input-ink"
              placeholder="••••••••"
              required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>
        )}

        <button type="submit" disabled={loading || resetBusy} className="btn-gold w-full">
          {loading || resetBusy
            ? 'Working…'
            : mode === 'complete_profile'
              ? 'Finish setup'
              : mode === 'reset'
                ? 'Send reset link'
                : isLogin
                  ? 'Sign in'
                  : 'Create account'}
        </button>
      </form>

      {mode === 'auth' && (
        <div className="mt-8 pt-6 border-t border-rule text-center space-y-3">
          {isLogin && (
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                clearError();
              }}
              className="label hover:text-gold transition-colors block w-full"
            >
              Forgot password?
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              clearError();
            }}
            className="label hover:text-gold transition-colors"
          >
            {isLogin ? '→ Register a New Account' : '← Return to Sign In'}
          </button>
        </div>
      )}

      {mode === 'reset' && (
        <div className="mt-8 pt-6 border-t border-rule text-center">
          <button
            type="button"
            onClick={() => {
              setMode('auth');
              setIsLogin(true);
              clearError();
            }}
            className="label hover:text-gold transition-colors"
          >
            ← Return to Sign In
          </button>
        </div>
      )}
    </div>
  );
}
