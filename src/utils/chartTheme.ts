// After-Hours Exchange: chart theme reader.
//
// Charts are theme-aware: colours come from the live CSS variables on
// document.documentElement so a theme toggle restyles every chart without
// duplicating palettes in JS.

export interface ChartTheme {
  up: string;
  down: string;
  flat: string;
  brand: string;
  golden: string;
  text: string;
  textMuted: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
}

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

export function readChartTheme(): ChartTheme {
  if (typeof document === 'undefined') {
    return {
      up: '#3ee6a5',
      down: '#ff5d73',
      flat: '#8b8da3',
      brand: '#4cc9ff',
      golden: '#ffcf4a',
      text: '#f3f4fa',
      textMuted: '#8b8da3',
      grid: 'rgba(255,255,255,0.06)',
      tooltipBg: '#12131c',
      tooltipBorder: 'rgba(255,255,255,0.14)'
    };
  }
  const styles = getComputedStyle(document.documentElement);
  return {
    up: readVar(styles, '--up', '#3ee6a5'),
    down: readVar(styles, '--down', '#ff5d73'),
    flat: readVar(styles, '--flat', '#8b8da3'),
    brand: readVar(styles, '--brand', '#4cc9ff'),
    golden: readVar(styles, '--golden', '#ffcf4a'),
    text: readVar(styles, '--text', '#f3f4fa'),
    textMuted: readVar(styles, '--text-3', '#8b8da3'),
    grid: readVar(styles, '--border', 'rgba(255,255,255,0.07)'),
    tooltipBg: readVar(styles, '--surface', '#12131c'),
    tooltipBorder: readVar(styles, '--border-strong', 'rgba(255,255,255,0.14)')
  };
}

/** Translucent fill derived from a hex line colour. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
