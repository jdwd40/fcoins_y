import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

// Accessible Dialog/Sheet primitive — the ONE overlay implementation for
// auth, the trade sheet, How to play and confirms.
//
// Contract:
//   - role="dialog" + aria-modal + aria-labelledby
//   - Escape and backdrop click close
//   - Tab is trapped inside while open
//   - focus moves into the dialog on open and returns to the opener on close
//     (guarded by isConnected so unmounted openers never throw)
//   - body scroll is locked while open
//   - bottom sheet on phones, centred panel from sm up

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Visible title content (rendered as the labelled heading). */
  title: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes for the panel (width etc.). */
  panelClassName?: string;
  /** Hide the built-in close button (custom chrome). */
  hideCloseButton?: boolean;
}

export function Dialog({ open, onClose, title, children, panelClassName = '', hideCloseButton = false }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const titleId = useId();

  // Focus management: in on open, back to the opener on close.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-6">
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`relative w-full max-w-lg bg-card border border-rule rounded-t-2xl sm:rounded-2xl shadow-overlay max-h-[92vh] overflow-y-auto outline-none ${panelClassName}`.trim()}
        >
          <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-rule">
            <h2 id={titleId} className="font-display text-xl sm:text-2xl font-bold text-ink leading-tight pr-8">
              {title}
            </h2>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 p-2 rounded-lg bg-surface-2 border border-rule text-ink-mute hover:text-ink hover:border-rule-strong transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="px-5 sm:px-6 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
