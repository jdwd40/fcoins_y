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
  getAuthToken: () => string | null;
  getUserIdFromToken: (token: string) => number | null;
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
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('Loaded user from localStorage:', parsedUser);
        
        // Ensure user.id is a number
        if (parsedUser && parsedUser.id) {
          // Convert id to number if it's a string
          if (typeof parsedUser.id === 'string') {
            parsedUser.id = parseInt(parsedUser.id, 10);
          }
          
          // Validate that id is a valid number
          if (isNaN(parsedUser.id)) {
            console.error('Invalid user ID in localStorage:', parsedUser.id);
            // Don't set the user if the ID is invalid
            return;
          }
        }
        
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
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
        console.error('handleAuthResponse: Missing token in response');
        throw new Error('Missing authentication token');
      }
      
      // Try to get user ID from token
      const tokenUserId = getUserIdFromToken(response.token);
      console.log('User ID extracted from token:', tokenUserId);
      
      // Ensure we have a valid user object
      if (!response.user) {
        console.error('handleAuthResponse: Missing user object in response');
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
        console.warn('handleAuthResponse: Invalid or missing user ID, setting default ID');
        userWithFunds.id = 1;
      }
      
      console.log('Storing user in localStorage:', userWithFunds);
      
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(userWithFunds));
      setUser(userWithFunds);
      setError(null);
    } catch (error) {
      console.error('Error in handleAuthResponse:', error);
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
      
      console.log('Attempting login with credentials:', { email: credentials.email, password: '********' });
      
      const response = await fetch('https://jdwd40.com/api-2/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      // Log the raw response
      console.log('Login response status:', response.status, response.statusText);
      
      // Get the response text first to log it
      const responseText = await response.text();
      console.log('Raw login response:', responseText);
      
      // Try to parse the response as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Parsed login response data:', data);
      } catch (error) {
        console.error('Error parsing login response as JSON:', error);
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
        console.error('Login response missing token:', data);
        throw new Error('Login response missing authentication token');
      }
      
      // Create a default user object if user data is missing
      if (!data.user) {
        console.warn('Login response missing user data, creating default user');
        data.user = {
          id: 1, // Default user ID
          email: credentials.email,
          funds: 1000.00
        };
      }
      
      // Ensure user has an ID
      if (!data.user.id) {
        console.warn('User data missing ID, setting default ID');
        data.user.id = 1; // Default user ID
      }
      
      handleAuthResponse(data);
      return true; // Login successful
    } catch (err) {
      console.error('Login error:', err);
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
      
      console.log('Attempting registration with credentials:', { 
        email: credentials.email, 
        password: '********',
        username: credentials.username
      });
      
      const response = await fetch('https://jdwd40.com/api-2/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      // Log the raw response
      console.log('Register response status:', response.status, response.statusText);
      
      // Get the response text first to log it
      const responseText = await response.text();
      console.log('Raw register response:', responseText);
      
      // Try to parse the response as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Parsed register response data:', data);
      } catch (error) {
        console.error('Error parsing register response as JSON:', error);
        throw new Error('Server returned invalid JSON response');
      }

      if (!response.ok) {
        let errorMessage = 'Registration failed';
        
        if (data && data.msg) {
          errorMessage = data.msg;
        }
        
        throw new Error(errorMessage);
      }

      // Check if the response has the expected structure
      if (!data || !data.token) {
        console.error('Register response missing token:', data);
        throw new Error('Register response missing authentication token');
      }
      
      // Create a default user object if user data is missing
      if (!data.user) {
        console.warn('Register response missing user data, creating default user');
        data.user = {
          id: 1, // Default user ID
          email: credentials.email,
          username: credentials.username,
          funds: 1000.00
        };
      }
      
      // Ensure user has an ID
      if (!data.user.id) {
        console.warn('User data missing ID, setting default ID');
        data.user.id = 1; // Default user ID
      }
      
      handleAuthResponse(data);
      return true; // Registration successful
    } catch (err) {
      console.error('Registration error:', err);
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

  const getAuthToken = () => {
    const token = localStorage.getItem('token');
    console.log('Auth token retrieved:', token ? `${token.substring(0, 10)}...` : 'No token found');
    
    // Check if token is in the correct format (JWT tokens have 3 parts separated by dots)
    if (token) {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('Token does not appear to be in valid JWT format');
      } else {
        console.log('Token appears to be in valid JWT format');
      }
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
        console.error('Invalid JWT token format');
        return null;
      }
      
      // Decode the base64 payload
      const payload = JSON.parse(atob(parts[1]));
      console.log('Decoded JWT payload:', payload);
      
      // Extract user ID from payload
      // The field name depends on how the JWT is structured on the server
      // Common fields are 'sub', 'id', 'userId', etc.
      const userId = payload.sub || payload.id || payload.userId || payload.user_id;
      
      if (!userId) {
        console.error('No user ID found in JWT payload');
        return null;
      }
      
      return typeof userId === 'string' ? parseInt(userId, 10) : userId;
    } catch (error) {
      console.error('Error decoding JWT token:', error);
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
      getUserIdFromToken
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