import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface AuthFormsProps {
  onClose: () => void;
}

export function AuthForms({ onClose }: AuthFormsProps) {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register, error, loading, clearError } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let success = false;
      if (isLogin) {
        success = await login({ email: formData.email, password: formData.password });
        if (success) {
          showToast('Welcome back to the exchange', 'success');
          onClose();
        }
      } else {
        success = await register(formData);
        if (success) {
          showToast('Account opened. Books balanced.', 'success');
          onClose();
        }
      }
    } catch (err) {
      // handled by context
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="w-full max-w-md mx-auto py-4">
      <div className="text-center mb-8">
        <div className="label mb-3">{isLogin ? 'Ledger Access' : 'Open an Account'}</div>
        <h2 className="font-display text-5xl italic text-ink leading-none"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 50" }}>
          {isLogin ? 'Welcome\u00a0Back' : 'Join\u00a0the\u00a0Floor'}
        </h2>
        <div className="ornament mt-5">
          <span className="text-gold">❦</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 border-l-2 border-oxblood px-4 py-3 bg-card">
          <div className="label text-oxblood mb-1">
            {isLogin ? 'Access Denied' : 'Registration Failed'}
          </div>
          <p className="font-mono text-xs text-ink-dim">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {!isLogin && (
          <div>
            <label className="label block mb-2">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="input-ink"
              placeholder="e.g. j_dupont"
              required={!isLogin}
            />
          </div>
        )}

        <div>
          <label className="label block mb-2">Electronic Post</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="input-ink"
            placeholder="you@elsewhere.co"
            required
          />
        </div>

        <div>
          <label className="label block mb-2">Passphrase</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="input-ink"
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-gold w-full">
          {loading ? 'Consulting the ledger…' : isLogin ? 'Enter Exchange' : 'Open Account'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-rule text-center">
        <button
          onClick={() => {
            setIsLogin(!isLogin);
            clearError();
          }}
          className="label hover:text-gold transition-colors"
        >
          {isLogin ? '→ Register a New Account' : '← Return to Sign In'}
        </button>
      </div>
    </div>
  );
}
