import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import {
  HOW_TO_PLAY_STEPS,
  HOW_TO_PLAY_TAGLINE,
  HOW_TO_PLAY_TITLE
} from '../utils/gameLogic.ts';

// HOW TO PLAY: a compact, dismissible dialog hanging off the persistent
// Apocalypse header. It never blocks play — no forced tutorial, no onboarding
// state machine, no navigation away from the game. Copy lives in gameLogic
// (HOW_TO_PLAY_STEPS) so the accuracy rules are unit-testable without a DOM.
//
// Accessibility contract:
//   - native <button> trigger: keyboard-operable by default
//   - role="dialog" + aria-modal + aria-labelledby semantics
//   - Escape closes; clicking the backdrop closes
//   - focus moves into the dialog on open and returns to the trigger on close
//   - Tab/Shift+Tab cycle inside the dialog while it is open
//   - step numbers are decorative (aria-hidden); meaning is never colour-only
export function HowToPlay() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  // While open: move focus into the dialog, close on Escape, trap Tab.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), [href]')
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
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // When the dialog closes (any route: Escape, backdrop, close button),
  // hand focus back to the trigger so keyboard users never lose their place.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="how-to-play-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
        How to play
      </button>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end sm:items-center justify-center p-0 sm:p-6">
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
              onClick={close}
              aria-hidden="true"
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="how-to-play-title"
              tabIndex={-1}
              className="relative w-full max-w-lg bg-card border border-rule rounded-t-2xl sm:rounded-2xl shadow-2xl animate-reveal-fast max-h-[92vh] overflow-y-auto outline-none"
            >
              <button
                type="button"
                onClick={close}
                className="absolute right-4 top-4 p-2 rounded-lg bg-paper-alt border border-rule text-ink-mute hover:text-gold hover:border-gold transition-colors"
                aria-label="Close how to play"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="p-5 sm:p-7">
                <div className="label text-gold mb-1.5">First time at the end of the world?</div>
                <h2
                  id="how-to-play-title"
                  className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink pr-10"
                >
                  {HOW_TO_PLAY_TITLE}
                </h2>
                <p className="font-mono text-xs font-bold tracking-caps uppercase text-oxblood mt-1.5">
                  {HOW_TO_PLAY_TAGLINE}
                </p>

                <ol className="mt-6 space-y-4">
                  {HOW_TO_PLAY_STEPS.map((step, index) => (
                    <li key={step.id} className="flex gap-3.5">
                      <span className="how-to-play-step-num" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-mono text-xs font-bold tracking-caps uppercase text-ink">
                          {step.title}
                        </h3>
                        <p className="text-ink-dim text-sm leading-relaxed mt-1">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
