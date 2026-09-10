// Wave 4: player-facing copy for the adaptive Director runtime surface.
// Modes and summaryCodes are exhaustive allowlists from the frozen
// GET /persistent/runtime contract — never invent labels for unknown values.

import type {
  PersistentDecisionSummaryCode,
  PersistentDirectorMode
} from '../services/persistentService.ts';

export const DIRECTOR_MODE_EXPLANATION: Record<PersistentDirectorMode, string> = {
  NORMAL: 'Market running normally.',
  BOOM: 'The Director is driving a broad upswing.',
  BUST: 'The Director is applying broad downward pressure.',
  RESCUE: 'The Director is supporting distressed coins.'
};

export const DECISION_SUMMARY_COPY: Record<PersistentDecisionSummaryCode, string> = {
  GENESIS_NORMAL: 'The market opened in a stable state.',
  NORMAL_SWING: 'The Director returned the market to normal.',
  REFRACTORY_NORMAL: 'The Director is allowing the market to settle.',
  STAGNATION_SWING: 'The Director intervened to break stagnation.',
  RESCUE_DISTRESS: 'The Director launched a market rescue.',
  OVERHEAT_CORRECTION: 'The Director cooled an overheated market.',
  ROLE_ROTATION: 'The Director reassigned special coin roles.',
  OTHER_SAFE: 'The Director adjusted market conditions.'
};

export function directorModeExplanation(mode: PersistentDirectorMode): string {
  return DIRECTOR_MODE_EXPLANATION[mode];
}

export function decisionSummaryCopy(code: PersistentDecisionSummaryCode): string {
  return DECISION_SUMMARY_COPY[code];
}

/** Compact mode label for chips / badges (not colour-only). */
export function directorModeLabel(mode: PersistentDirectorMode): string {
  return mode;
}
