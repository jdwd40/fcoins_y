import { Dialog } from '../ui/Dialog.tsx';
import { HOW_TO_PLAY_STEPS, HOW_TO_PLAY_TAGLINE, HOW_TO_PLAY_TITLE } from '../../utils/gameLogic.ts';

// How to play: the persistent-market guide rendered from the single source
// of truth in gameLogic (HOW_TO_PLAY_STEPS), inside the shared Dialog.

interface HowToPlayDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HowToPlayDialog({ open, onClose }: HowToPlayDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="How to play" panelClassName="max-w-xl">
      <p className="label text-brand mb-1">New to the market?</p>
      <p className="font-mono text-xs font-bold tracking-caps uppercase text-down mb-5">
        {HOW_TO_PLAY_TAGLINE}
      </p>
      <h3 className="sr-only">{HOW_TO_PLAY_TITLE}</h3>
      <ol className="space-y-4">
        {HOW_TO_PLAY_STEPS.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <span
              aria-hidden="true"
              className="grid place-items-center w-6 h-6 flex-none rounded-full bg-accent-soft border border-brand/40 text-brand font-mono text-xs font-bold"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <h4 className="font-mono text-xs font-bold tracking-caps uppercase text-ink">{step.title}</h4>
              <p className="text-ink-dim text-sm leading-relaxed mt-1">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
