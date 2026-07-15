import { createHash } from 'crypto';
import { DEFAULT_THEME, resolveTheme, THEME_CODES, THEME_INIT_SCRIPT, THEMES } from './theme';

describe('theme', () => {
  it('offers several white-to-beige editorial tones', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(3);
    expect(THEME_CODES).toEqual(expect.arrayContaining(['paper', 'ivory', 'sand']));
    for (const t of THEMES) expect(t.swatch).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('resolveTheme accepts known codes and falls back to the default', () => {
    expect(resolveTheme('sand')).toBe('sand');
    expect(resolveTheme('nope')).toBe(DEFAULT_THEME);
    expect(resolveTheme(undefined)).toBe(DEFAULT_THEME);
    expect(THEME_CODES).toContain(DEFAULT_THEME);
  });

  it('the inline init script is a single self-contained expression (CSP-hashable)', () => {
    expect(THEME_INIT_SCRIPT).not.toContain('\n');
    expect(THEME_INIT_SCRIPT).toContain('localStorage');
    // A stable base64 sha256 can be derived for the CSP allow-list.
    const hash = createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64');
    expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
