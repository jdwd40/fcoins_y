import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X } from 'lucide-react';

// Toast system: an aria-live region stack. Success/info = role="status"
// (polite), error = role="alert" (assertive). Bottom-centre above the phone
// tab bar; top-right on desktop. Every toast has a labelled dismiss button.

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION_MS = 4000;
const MAX_TOASTS = 3;

const TOAST_LABEL: Record<ToastType, string> = {
  success: 'Done',
  error: 'Problem',
  info: 'Note'
};

const TOAST_TONE: Record<ToastType, string> = {
  success: 'border-l-[3px] border-l-[var(--up)]',
  error: 'border-l-[3px] border-l-[var(--down)]',
  info: 'border-l-[3px] border-l-[var(--brand)]'
};

const TOAST_LABEL_CLASS: Record<ToastType, string> = {
  success: 'text-up',
  error: 'text-down',
  info: 'text-brand'
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, type }]);
    setTimeout(() => dismiss(id), TOAST_DURATION_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed z-[100] inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] flex flex-col items-center gap-2 px-4 pointer-events-none sm:inset-x-auto sm:bottom-auto sm:top-4 sm:right-4 sm:items-end"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto w-full max-w-sm bg-surface-3 border border-rule rounded-xl shadow-overlay px-4 py-3 flex items-start gap-3 ${TOAST_TONE[toast.type]}`}
          >
            <div className="flex-1 min-w-0">
              <div className={`label ${TOAST_LABEL_CLASS[toast.type]} mb-0.5`}>{TOAST_LABEL[toast.type]}</div>
              <p className="text-sm text-ink leading-snug break-words">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 p-1.5 rounded-lg text-ink-mute hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
