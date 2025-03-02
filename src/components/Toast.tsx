import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ 
  message, 
  type, 
  isVisible, 
  onClose, 
  duration = 3000 
}: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const bgColor = {
    success: 'bg-green-100 border-green-500 text-green-700',
    error: 'bg-red-100 border-red-500 text-red-700',
    info: 'bg-blue-100 border-blue-500 text-blue-700'
  }[type];

  const Icon = {
    success: CheckCircle,
    error: AlertCircle,
    info: AlertCircle
  }[type];

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in-down">
      <div className={`p-4 rounded-md shadow-md border-l-4 ${bgColor} flex items-center max-w-md`}>
        <Icon className="w-5 h-5 mr-3" />
        <div className="flex-1">{message}</div>
        <button onClick={onClose} className="ml-3 text-gray-500 hover:text-gray-700">
          <XCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
