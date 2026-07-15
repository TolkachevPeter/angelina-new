/**
 * Colour themes — editorial "magazine paper" tones from crisp white to warm
 * beige. Only the paper/wash/hairline surface colours change between themes;
 * the ink and the accent stay constant (black-on-paper editorial look).
 *
 * The palette lives in CSS (`:root[data-theme="…"]` in the template head). This
 * module is the source of truth for the theme list, the default, and the tiny
 * no-flash init script whose hash is whitelisted in the CSP.
 */

export interface Theme {
  code: string;
  label: string;
  swatch: string; // representative paper colour for the switcher dot
}

export const THEMES: Theme[] = [
  { code: 'paper', label: 'Paper', swatch: '#FFFFFF' },
  { code: 'ivory', label: 'Ivory', swatch: '#FAF6EE' },
  { code: 'pearl', label: 'Pearl', swatch: '#F6F5F1' },
  { code: 'powder', label: 'Powder', swatch: '#FAF4EF' },
  { code: 'sand', label: 'Sand', swatch: '#F1E7D6' },
];

export const THEME_CODES = THEMES.map((t) => t.code);

/** Default when the visitor has no saved preference. Overridable via SITE_THEME. */
export const DEFAULT_THEME = 'ivory';

export function resolveTheme(value: string | undefined): string {
  return value && THEME_CODES.includes(value) ? value : DEFAULT_THEME;
}

export const THEME_STORAGE_KEY = 'belokon-theme';

/**
 * Runs in <head> before first paint so a returning visitor's saved theme is
 * applied with no flash of the default. Kept to a single expression; its exact
 * text is hashed into the CSP (see bootstrap/configure.ts), so any edit here
 * must keep the two in sync automatically (they read the same constant).
 */
export const THEME_INIT_SCRIPT =
  `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');` +
  `if(t&&/^[a-z]+$/.test(t))document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
