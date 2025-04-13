import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function DebugUserInfo() {
  const { user } = useAuth();
  const [localStorageUser, setLocalStorageUser] = useState<any>(null);
  
  useEffect(() => {
    // Get user from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setLocalStorageUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
  }, []);
  
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Debug User Information</h2>
      
      <div className="mb-4">
        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">Context User:</h3>
        <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs overflow-auto max-h-40">
          {user ? JSON.stringify(user, null, 2) : 'No user in context'}
        </pre>
      </div>
      
      <div className="mb-4">
        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">LocalStorage User:</h3>
        <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs overflow-auto max-h-40">
          {localStorageUser ? JSON.stringify(localStorageUser, null, 2) : 'No user in localStorage'}
        </pre>
      </div>
      
      <div className="flex space-x-2">
        <button 
          onClick={() => {
            // Fix user ID in localStorage
            if (localStorageUser) {
              const fixedUser = {
                ...localStorageUser,
                id: 1 // Set ID to 1 for testing
              };
              localStorage.setItem('user', JSON.stringify(fixedUser));
              setLocalStorageUser(fixedUser);
              alert('User ID fixed in localStorage. Please refresh the page.');
            }
          }}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Fix User ID
        </button>
        
        <button 
          onClick={() => {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            setLocalStorageUser(null);
            alert('User data cleared. Please log in again.');
            window.location.reload();
          }}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Clear User Data
        </button>
      </div>
    </div>
  );
}
