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
      <div className="flex min-h-screen items-center justify-center p-2 sm:p-6">
        <div
          className="fixed inset-0 bg-ink/70 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-5xl bg-card border border-rule animate-reveal-fast max-h-[92vh] overflow-y-auto">
          {/* Ornamental corner marks */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-gold pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gold pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-gold pointer-events-none"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-gold pointer-events-none"></div>

          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 text-ink-mute hover:text-gold transition-colors z-50"
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
