import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, AuthResponse, LoginCredentials, RegisterCredentials } from '../types';
import { API_BASE_URL } from '../services/apiConfig.ts';

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
    
    if (token && storedUser) {
      // Check if token is expired before loading user
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.exp && Date.now() >= payload.exp * 1000) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setLoading(false);
            return;
          }
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }
      
      try {
        const parsedUser = JSON.parse(storedUser);
        
        // Ensure user.id is a number
        if (parsedUser && parsedUser.id) {
          // Convert id to number if it's a string
          if (typeof parsedUser.id === 'string') {
            parsedUser.id = parseInt(parsedUser.id, 10);
          }
          
          // Validate that id is a valid number
          if (isNaN(parsedUser.id)) {
            // Don't set the user if the ID is invalid
            setLoading(false);
            return;
          }
        }
        
        setUser(parsedUser);
      } catch {
        // Clear invalid user data
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const handleAuthResponse = (response: AuthResponse) => {
    try {
      // Ensure we have a valid token
      if (!response.token) {
        throw new Error('Missing authentication token');
      }
      
      // Try to get user ID from token
      const tokenUserId = getUserIdFromToken(response.token);
      
      // Ensure we have a valid user object
      if (!response.user) {
        response.user = { 
          id: tokenUserId || 1, 
          email: 'default@example.com', 
          funds: 1000.00 
        };
      }
      
      // Ensure user has the default funds amount if not set
      const userWithFunds = {
        ...response.user,
        funds: response.user.funds ?? 1000.00
      };
      
      // If we have a user ID from the token, use it
      if (tokenUserId) {
        userWithFunds.id = tokenUserId;
      } 
      // Otherwise ensure user.id is a number
      else if (typeof userWithFunds.id === 'string') {
        userWithFunds.id = parseInt(userWithFunds.id, 10);
      }
      
      // If user.id is missing or invalid, set a default
      if (!userWithFunds.id || isNaN(userWithFunds.id)) {
        userWithFunds.id = 1;
      }
      
      
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(userWithFunds));
      setUser(userWithFunds);
      setError(null);
    } catch {
      // Create a minimal valid user to prevent further errors
      const defaultUser = { id: 1, email: 'default@example.com', funds: 1000.00 };
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(defaultUser));
      setUser(defaultUser);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);
      
      
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      // Log the raw response
      
      // Get the response text first to log it
      const responseText = await response.text();
      
      // Try to parse the response as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Server returned invalid JSON response');
      }

      if (!response.ok) {
        let errorMessage = 'Login failed';
        
        if (data && data.msg) {
          errorMessage = data.msg;
        }
        
        throw new Error(errorMessage);
      }

      // Check if the response has the expected structure
      if (!data || !data.token) {
        throw new Error('Login response missing authentication token');
      }
      
      // Create a default user object if user data is missing
      if (!data.user) {
        data.user = {
          id: 1, // Default user ID
          email: credentials.email,
          funds: 1000.00
        };
      }
      
      // Ensure user has an ID
      if (!data.user.id) {
        data.user.id = 1; // Default user ID
      }
      
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
      
      
      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      // Log the raw response
      
      // Get the response text first to log it
      const responseText = await response.text();
      
      // Try to parse the response as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Server returned invalid JSON response');
      }

      if (!response.ok) {
        let errorMessage = 'Registration failed';
        
        if (data && data.msg) {
          errorMessage = data.msg;
        }
        
        throw new Error(errorMessage);
      }

      // Registration successful - now automatically log in the user
      // The registration API doesn't return a token, so we need to call login
      
      const loginResponse = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      });

      
      const loginResponseText = await loginResponse.text();
      
      let loginData;
      try {
        loginData = JSON.parse(loginResponseText);
      } catch {
        throw new Error('Auto-login failed: Server returned invalid JSON response');
      }

      if (!loginResponse.ok) {
        let errorMessage = 'Auto-login failed after registration';
        if (loginData && loginData.msg) {
          errorMessage = loginData.msg;
        }
        throw new Error(errorMessage);
      }

      // Check if the login response has the expected structure
      if (!loginData || !loginData.token) {
        throw new Error('Auto-login response missing authentication token');
      }
      
      // Create a default user object if user data is missing
      if (!loginData.user) {
        loginData.user = {
          id: 1,
          email: credentials.email,
          username: credentials.username,
          funds: 1000.00
        };
      }
      
      // Ensure user has an ID
      if (!loginData.user.id) {
        loginData.user.id = 1;
      }
      
      handleAuthResponse(loginData);
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

  // Check if a JWT token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      
      // If no expiration claim, assume token is valid
      if (!payload.exp) {
        return false;
      }
      
      // exp is in seconds, Date.now() is in milliseconds
      const isExpired = Date.now() >= payload.exp * 1000;
      
            return isExpired;
    } catch {
      return true; // Assume expired if we can't parse
    }
  };

  // Handle session expired - logout and show message
  const handleSessionExpired = () => {
    logout();
    setError('Your session has expired. Please log in again.');
  };

  // Refresh user data from localStorage
  const refreshUser = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch {
        // ignore — best-effort path
      }
    }
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

  // Function to decode JWT token and extract user ID
  const getUserIdFromToken = (token: string): number | null => {
    try {
      // JWT tokens are in the format: header.payload.signature
      // We need to decode the payload part (second part)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      // Decode the base64 payload
      const payload = JSON.parse(atob(parts[1]));
      
      // Extract user ID from payload
      // The field name depends on how the JWT is structured on the server
      // Common fields are 'sub', 'id', 'userId', etc.
      const userId = payload.sub || payload.id || payload.userId || payload.user_id;
      
      if (!userId) {
        return null;
      }
      
      return typeof userId === 'string' ? parseInt(userId, 10) : userId;
    } catch {
      return null;
    }
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