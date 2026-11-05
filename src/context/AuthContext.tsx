import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, LoginCredentials, RegisterCredentials } from '../types';
import {
  clearSession,
  getUserIdFromToken,
  isTokenExpired,
  loginUser,
  readStoredSession,
  registerUser
} from '../services/authService.ts';

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
    setUser(readStoredSession(localStorage)?.user ?? null);
    setLoading(false);
  }, []);

  const clearError = () => {
    setError(null);
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);
      setUser(await loginUser(credentials));
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
      setUser(await registerUser(credentials));
      return true; // Registration and auto-login successful
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      return false; // Registration failed
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearSession(localStorage);
    setUser(null);
  };

  // Handle session expired - logout and show message
  const handleSessionExpired = () => {
    logout();
    setError('Your session has expired. Please log in again.');
  };

  // Refresh user data from localStorage
  const refreshUser = () => {
    setUser(readStoredSession(localStorage)?.user ?? null);
  };

  const getAuthToken = () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      return null;
    }
    
    // Check if token is in the correct format (JWT tokens have 3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    // Check if token is expired
    if (isTokenExpired(token)) {
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