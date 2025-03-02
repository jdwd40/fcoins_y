import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, AuthResponse, LoginCredentials, RegisterCredentials } from '../types';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleAuthResponse = (response: AuthResponse) => {
    // Ensure user has the default funds amount if not set
    const userWithFunds = {
      ...response.user,
      funds: response.user.funds ?? 1000.00
    };
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(userWithFunds));
    setUser(userWithFunds);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('https://jdwd40.com/api-2/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Login failed';
        
        try {
          // Try to parse the error as JSON
          const errorJson = JSON.parse(errorText);
          if (errorJson && errorJson.msg) {
            errorMessage = errorJson.msg;
          }
        } catch {
          // If parsing fails, use the raw error text
          errorMessage = errorText;
        }
        
        throw new Error(errorMessage);
      }

      const data: AuthResponse = await response.json();
      handleAuthResponse(data);
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
      
      const response = await fetch('https://jdwd40.com/api-2/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Registration failed';
        
        try {
          // Try to parse the error as JSON
          const errorJson = JSON.parse(errorText);
          if (errorJson && errorJson.msg) {
            errorMessage = errorJson.msg;
          }
        } catch {
          // If parsing fails, use the raw error text
          errorMessage = errorText;
        }
        
        throw new Error(errorMessage);
      }

      const data: AuthResponse = await response.json();
      handleAuthResponse(data);
      return true; // Registration successful
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

  return (
    <AuthContext.Provider value={{ user, login, register, logout, clearError, loading, error }}>
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