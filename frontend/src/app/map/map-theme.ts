import Color from '@arcgis/core/Color.js';

/**
 * Map symbols read their colors from the SCSS design tokens (CSS custom properties defined in
 * src/styles/_tokens.scss), so the renderer, legend, table badges and charts share exactly the same palette.
 */
export function token(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) throw new Error(`Design token ${name} is not defined`);
  return value;
}

/** Token color with an alpha (0–1), as an ArcGIS Color. */
export function tokenColor(name: string, alpha = 1): Color {
  const c = new Color(token(name));
  c.a = alpha;
  return c;
}
