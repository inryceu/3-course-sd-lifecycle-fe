/** The deadline is a calendar date: stored as UTC midnight, shown from the UTC date. */
export function toDateInput(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function toDeadlineIso(date: string): string | null {
  return date ? `${date}T00:00:00.000Z` : null;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Request failed';
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Black or white, whichever has the higher WCAG contrast on the given #rrggbb background. */
export function textOn(hex: string): '#000000' | '#ffffff' {
  const n = parseInt(hex.slice(1, 7), 16);
  if (Number.isNaN(n)) return '#000000';
  const lum =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  // contrast with white = 1.05 / (lum + 0.05); with black = (lum + 0.05) / 0.05
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.05 ? '#ffffff' : '#000000';
}
