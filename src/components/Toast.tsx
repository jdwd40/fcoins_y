import { useEffect } from 'react';
import { X } from 'lucide-react';

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
  duration = 3000,
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

  const accentVar = {
    success: 'var(--verdigris)',
    error: 'var(--oxblood)',
    info: 'var(--gold)',
  }[type];

  const label = {
    success: 'Filed',
    error: 'Rejected',
    info: 'Notice',
  }[type];

  const labelClass = {
    success: 'text-verdigris',
    error: 'text-oxblood',
    info: 'text-gold',
  }[type];

  return (
    <div className="fixed top-6 right-6 z-[100] animate-fade-in-down">
      <div
        className="bg-card border border-rule min-w-[320px] max-w-md flex items-start gap-3 p-4 shadow-card-dark"
        style={{ borderLeft: `2px solid ${accentVar}` }}
      >
        <div className="flex-1">
          <div className={`label ${labelClass} mb-1`}>{label}</div>
          <div className="font-display italic text-ink text-base leading-snug">{message}</div>
        </div>
        <button onClick={onClose} className="text-ink-mute hover:text-ink transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
