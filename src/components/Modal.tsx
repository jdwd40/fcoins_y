import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end sm:items-center justify-center p-0 sm:p-6">
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-5xl bg-card border border-rule rounded-t-2xl sm:rounded-2xl shadow-2xl animate-reveal-fast max-h-[94vh] sm:max-h-[92vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-lg bg-paper-alt border border-rule text-ink-mute hover:text-gold hover:border-gold transition-colors z-50"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="p-4 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
