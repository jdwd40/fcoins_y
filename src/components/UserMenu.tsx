import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, History } from 'lucide-react';
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
      <div className="flex items-center gap-4">
        {isDark !== undefined && onThemeToggle && (
          <ThemeToggle isDark={isDark} onToggle={onThemeToggle} />
        )}
        <button
          onClick={onAuthClick}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <UserIcon className="w-4 h-4" />
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        {user?.username || 'User'}
        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
          £{(user?.funds || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
        </span>
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/profile')}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          aria-label="View profile"
        >
          <UserIcon className="w-5 h-5" />
        </button>
        {isDark !== undefined && onThemeToggle && (
          <ThemeToggle isDark={isDark} onToggle={onThemeToggle} />
        )}
        <button
          onClick={logout}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}