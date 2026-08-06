import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useNavigate } from 'react-router-dom';

interface UserMenuProps extends React.PropsWithChildren {
  onAuthClick: () => void;
  isDark?: boolean;
  onThemeToggle?: () => void;
}

export function UserMenu({ onAuthClick, isDark, onThemeToggle }: UserMenuProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        {isDark !== undefined && onThemeToggle && (
          <ThemeToggle isDark={isDark} onToggle={onThemeToggle} />
        )}
        <button onClick={onAuthClick} className="btn-gold">
          Sign&nbsp;In
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <button
        onClick={() => navigate('/profile')}
        className="hidden sm:flex flex-col items-end group"
      >
        <span className="label-ink group-hover:text-gold transition-colors">
          {user?.username || 'User'}
        </span>
        <span className="font-mono text-xs text-ink-dim tnum">
          £{(user?.cashBalance || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
        </span>
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/profile')}
          className="p-2 rounded-lg border border-rule bg-paper-alt hover:border-gold text-ink hover:text-gold transition-colors"
          aria-label="Profile"
        >
          <UserIcon className="w-4 h-4" />
        </button>
        {isDark !== undefined && onThemeToggle && (
          <ThemeToggle isDark={isDark} onToggle={onThemeToggle} />
        )}
        <button
          onClick={logout}
          className="p-2 rounded-lg border border-rule bg-paper-alt hover:border-oxblood text-ink hover:text-oxblood transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
