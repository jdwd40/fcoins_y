// After-Hours Exchange: event/modifier percentage formatting.
//
// Live coin events carry a raw modifierPct with up to 4 decimal places
// (e.g. -0.1981, +4.0808) — precise telemetry, but noisy for players.
// This pure helper renders every event/modifier percentage the same way:
// direction glyph + sign, one decimal place, and magnitudes below 0.1%
// collapse to "<0.1%" instead of a long decimal tail.

export type ModifierKind = 'positive' | 'negative';

/** e.g. formatModifierPct(4.0808, 'positive') → '▲ +4.1%';
 *  formatModifierPct(-0.1981, 'negative') → '▼ −<0.1%'. */
export function formatModifierPct(modifierPct: number, kind: ModifierKind): string {
  const magnitude = Math.abs(Number.isFinite(modifierPct) ? modifierPct : 0);
  const figure = magnitude > 0 && magnitude < 0.1 ? '<0.1' : magnitude.toFixed(1);
  const glyph = kind === 'positive' ? '▲' : '▼';
  const sign = kind === 'positive' ? '+' : '−';
  return `${glyph} ${sign}${figure}%`;
}
