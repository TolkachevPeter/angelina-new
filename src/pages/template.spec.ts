import { readFileSync } from 'fs';
import { join } from 'path';
import { CONTENT, LANGS } from '../i18n/content';

/**
 * Guards on the landing template:
 *  - no unfinished [bracket] placeholder copy reaches the indexable HTML;
 *  - only known %%SEO%% tokens are used (PagesService resolves exactly these);
 *  - every {{content.key}} token exists in EVERY language dictionary;
 *  - a single <h1> and a logical landmark structure.
 */
describe('landing template', () => {
  const html = readFileSync(join(process.cwd(), 'views', 'index.html'), 'utf-8');
  const body = html.replace(/<style[\s\S]*?<\/style>/gi, '');

  it('contains no unfinished [bracket] placeholder copy', () => {
    expect(body.match(/\[[^\]\n]{2,60}\]/g) || []).toEqual([]);
  });

  it('uses only known %%SEO%% tokens', () => {
    const tokens = [...new Set(html.match(/%%[A-Z_]+%%/g) || [])];
    const allowed = new Set([
      '%%TITLE%%',
      '%%DESCRIPTION%%',
      '%%CANONICAL%%',
      '%%OG_IMAGE%%',
      '%%LOCALE%%',
      '%%LOCALE_SHORT%%',
      '%%CONTACT_EMAIL%%',
      '%%JSONLD%%',
      '%%TWITTER_META%%',
      '%%HREFLANG%%',
      '%%OG_LOCALE_ALT%%',
      '%%LANG_SWITCHER%%',
      '%%THEME%%',
      '%%THEME_INIT%%',
      '%%THEME_SWITCHER%%',
    ]);
    expect(tokens.filter((t) => !allowed.has(t))).toEqual([]);
  });

  it('every {{content.key}} token exists in all language dictionaries', () => {
    const keys = [...new Set([...html.matchAll(/\{\{([a-zA-Z0-9._]+)\}\}/g)].map((m) => m[1]))];
    expect(keys.length).toBeGreaterThan(50);
    for (const lang of LANGS) {
      const missing = keys.filter((k) => CONTENT[lang.code][k] === undefined);
      expect({ lang: lang.code, missing }).toEqual({ lang: lang.code, missing: [] });
    }
  });

  it('has exactly one <h1> and a logical landmark structure', () => {
    expect((html.match(/<h1[\s>]/g) || []).length).toBe(1);
    expect(html).toContain('<main id="main"');
    expect(html).toMatch(/<header[\s>]/);
    expect(html).toMatch(/<footer[\s>]/);
  });
});
