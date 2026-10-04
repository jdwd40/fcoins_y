import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, LoginCredentials, RegisterCredentials } from '../types';
import { loginUser, registerUser, restoreAuthSession } from '../services/authService.ts';
import { getUserIdFromToken, isTokenExpired } from '../utils/jwt.ts';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  loading: boolean;
  error: string | null;
  getAuthToken: () => string | null;
  getUserIdFromToken: (token: string) => number | null;
  isTokenExpired: (token: string) => boolean;
  refreshUser: () => void;
  handleSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    const session = restoreAuthSession(token, storedUser);
    if (session) {
      setUser(session.user);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setLoading(false);
  }, []);

  const clearError = () => {
    setError(null);
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);

      // loginUser validates and normalises the payload and persists the
      // session only on success — a malformed payload rejects here with a
      // user-visible error and nothing is stored.
      const session = await loginUser(credentials, localStorage);
      setUser(session.user);
      setError(null);
      return true; // Login successful
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return false; // Login failed
    } finally {
      setLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      setLoading(true);
      setError(null);

      const session = await registerUser(credentials, localStorage);
      setUser(session.user);
      setError(null);
      return true; // Registration and auto-login successful
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      return false; // Registration failed
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // Handle session expired - logout and show message
  const handleSessionExpired = () => {
    logout();
    setError('Your session has expired. Please log in again.');
  };

  // Refresh user data from localStorage
  const refreshUser = () => {
    const session = restoreAuthSession(localStorage.getItem('token'), localStorage.getItem('user'));
    if (session) setUser(session.user);
    else handleSessionExpired();
  };

  const getAuthToken = () => {
    const token = localStorage.getItem('token');

    if (!token) {
      return null;
    }

    if (!restoreAuthSession(token, localStorage.getItem('user'))) {
      handleSessionExpired();
      return null;
    }

    return token;
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      loading,
      error,
      clearError,
      getAuthToken,
      getUserIdFromToken,
      isTokenExpired,
      refreshUser,
      handleSessionExpired
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
