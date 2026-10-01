import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

// Inline "?" info tip: a real button that opens a small dismissible popover.
// Never hover-only — keyboard and touch get the same content. Escape closes
// and focus returns to the trigger.

interface InfoTipProps {
  label: string;
  text: string;
}

export function InfoTip({ label, text }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`About: ${label}`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-rule text-ink-mute hover:text-brand hover:border-brand text-xs font-bold ml-1"
      >
        ?
      </button>
      {open && (
        <span
          ref={popRef}
          role="note"
          className="absolute z-40 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg border border-rule-strong bg-surface-3 px-3 py-2 text-xs text-ink-dim shadow-overlay normal-case tracking-normal"
        >
          <Info className="inline w-3 h-3 mr-1 -mt-0.5 text-brand" aria-hidden="true" />
          <span className="font-semibold text-ink">{label}: </span>
          {text}
        </span>
      )}
    </span>
  );
}
