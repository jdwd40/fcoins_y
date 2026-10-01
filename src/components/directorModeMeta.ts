import { Activity, AlertTriangle, Gauge, Minus } from 'lucide-react';
import type { PersistentDirectorMode } from '../services/persistentService.ts';
import type { BadgeTone } from './ui/Badge.tsx';

// Director mode presentation metadata, shared by the DirectorModeChip
// component. Lives in a plain .ts module so the chip file only exports
// components (react-refresh/only-export-components stays clean).

export const DIRECTOR_MODE_META: Record<
  PersistentDirectorMode,
  { icon: typeof Gauge; label: string; tone: BadgeTone }
> = {
  NORMAL: { icon: Minus, label: 'Normal', tone: 'neutral' },
  BOOM: { icon: Activity, label: 'Boom', tone: 'director' },
  BUST: { icon: AlertTriangle, label: 'Bust', tone: 'director' },
  RESCUE: { icon: Gauge, label: 'Rescue', tone: 'director' }
};
