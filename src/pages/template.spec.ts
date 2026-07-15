import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guard: the landing template must never ship unfinished `[bracket]` placeholder
 * copy (fake prices, `[Month 2026]`, `[Name], Founder, [Brand]`, …) — that
 * content is server-rendered and indexable. CSS attribute selectors inside
 * <style> blocks (e.g. [data-reveal]) are legitimate, so those are stripped
 * before checking.
 */
describe('landing template content', () => {
  const html = readFileSync(join(process.cwd(), 'views', 'index.html'), 'utf-8');
  const body = html.replace(/<style[\s\S]*?<\/style>/gi, '');

  it('contains no unfinished [bracket] placeholder copy', () => {
    const matches = body.match(/\[[^\]\n]{2,60}\]/g) || [];
    expect(matches).toEqual([]);
  });

  it('still uses %%TOKENS%% only for server-side SEO injection', () => {
    const tokens = [...new Set(html.match(/%%[A-Z_]+%%/g) || [])];
    // These are the only tokens PagesService is expected to resolve.
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
    ]);
    const unexpected = tokens.filter((t) => !allowed.has(t));
    expect(unexpected).toEqual([]);
  });

  it('has exactly one <h1> and a logical landmark structure', () => {
    expect((html.match(/<h1[\s>]/g) || []).length).toBe(1);
    expect(html).toContain('<main id="main"');
    expect(html).toMatch(/<header[\s>]/);
    expect(html).toMatch(/<footer[\s>]/);
  });
});
