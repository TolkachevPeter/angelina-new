import { validateEnv } from './env.validation';
import configuration from './configuration';

describe('validateEnv', () => {
  it('accepts an empty environment (all optional, defaults apply)', () => {
    expect(() => validateEnv({})).not.toThrow();
  });

  it('accepts a well-formed environment', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '4280',
        SITE_URL: 'https://angelinabelokon.com',
        THROTTLE_LIMIT: '5',
      }),
    ).not.toThrow();
  });

  it('rejects an out-of-range port', () => {
    expect(() => validateEnv({ PORT: '70000' })).toThrow(/Invalid environment/);
  });

  it('rejects a non-URL SITE_URL', () => {
    expect(() => validateEnv({ SITE_URL: 'not-a-url' })).toThrow(/Invalid environment/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(/Invalid environment/);
  });
});

describe('configuration()', () => {
  const OLD = process.env;
  afterEach(() => {
    process.env = OLD;
  });

  it('strips a trailing slash from SITE_URL and derives the OG image', () => {
    process.env = { ...OLD, SITE_URL: 'https://example.com/' };
    const cfg = configuration();
    expect(cfg.site.url).toBe('https://example.com');
    expect(cfg.site.ogImage).toBe('https://example.com/og.png');
  });

  it('derives the short locale from the full locale', () => {
    process.env = { ...OLD, SITE_LOCALE: 'en_US' };
    expect(configuration().site.localeShort).toBe('en');
  });

  it('provides safe defaults when nothing is set', () => {
    process.env = { ...OLD };
    delete process.env.SITE_URL;
    delete process.env.CONTACT_EMAIL;
    const cfg = configuration();
    expect(cfg.port).toBe(4280);
    expect(cfg.site.url).toMatch(/^https:\/\//);
    expect(cfg.site.sameAs.length).toBeGreaterThan(0);
  });
});
