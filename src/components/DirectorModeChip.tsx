import { Badge } from './ui/Badge.tsx';
import { DIRECTOR_MODE_META } from './directorModeMeta.ts';
import type { PersistentDirectorMode } from '../services/persistentService.ts';

// Director mode presentation: icon + word + violet accent (the Director is
// the game's visible game-master). Never colour-only. The visible text
// carries the mode and time left; the sr-only suffix spells the time out.

export function DirectorModeChip({ mode, timeLeft }: { mode: PersistentDirectorMode; timeLeft?: string }) {
  const meta = DIRECTOR_MODE_META[mode];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      Director: {meta.label}
      {timeLeft && (
        <>
          <span className="font-mono tnum text-ink-mute" aria-hidden="true">· {timeLeft}</span>
          <span className="sr-only">, {timeLeft} left in this window</span>
        </>
      )}
    </Badge>
  );
}
