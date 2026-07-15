/**
 * Central, typed application configuration.
 *
 * Every externally-configurable value (domain, contact details, social links,
 * limits) is resolved here from the environment with production-safe defaults,
 * so the rest of the app depends on strongly-typed values rather than
 * scattered `process.env` reads. The values that feed SEO output — `site.url`,
 * `site.contactEmail`, `site.sameAs` — MUST be set for a real deployment.
 */

import { resolveTheme } from '../theme/theme';

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  trustProxy: boolean;
  corsOrigins: string[];
  leadsPath: string;
  theme: string;
  throttle: { ttlSeconds: number; limit: number };
  site: {
    url: string;
    name: string;
    title: string;
    description: string;
    locale: string;
    localeShort: string;
    contactEmail: string;
    ogImage: string;
    twitter: string;
    sameAs: string[];
    jobTitle: string;
    areaServed: string;
    knowsLanguages: string[];
    foundingOrg: { name: string; url: string };
  };
}

export default (): AppConfig => {
  const env = (process.env.NODE_ENV as AppConfig['env']) || 'development';
  const url = stripTrailingSlash(process.env.SITE_URL || 'https://angelinabelokon.com');
  const contactEmail = process.env.CONTACT_EMAIL || 'hello@angelinabelokon.com';

  const sameAs = list(process.env.SOCIAL_LINKS).length
    ? list(process.env.SOCIAL_LINKS)
    : ['https://instagram.com/ang.belokon', 'https://ounce.agency'];

  return {
    env,
    port: Number(process.env.PORT) || 4280,
    // Default OFF: only trust X-Forwarded-For when a real proxy is in front,
    // otherwise clients could spoof it to bypass IP-based rate limiting.
    trustProxy: (process.env.TRUST_PROXY ?? 'false') === 'true',
    corsOrigins: list(process.env.CORS_ORIGIN),
    leadsPath: process.env.LEADS_PATH || `${process.cwd()}/data/leads.json`,
    theme: resolveTheme(process.env.SITE_THEME),
    throttle: {
      ttlSeconds: Number(process.env.THROTTLE_TTL) || 60,
      limit: Number(process.env.THROTTLE_LIMIT) || 5,
    },
    site: {
      url,
      name: process.env.SITE_NAME || 'Angelina Belokon',
      title:
        process.env.SITE_TITLE ||
        'Angelina Belokon — Art Director & Creative Consultant for Fashion Brands',
      description:
        process.env.SITE_DESCRIPTION ||
        "Art direction, styling and creative consulting for fashion & lifestyle brands. Ex Harper's Bazaar fashion editor. Campaigns, lookbooks, rebrands — remote and on set, worldwide.",
      locale: process.env.SITE_LOCALE || 'en_US',
      localeShort: (process.env.SITE_LOCALE || 'en_US').split(/[-_]/)[0],
      contactEmail,
      ogImage: `${url}/og.png`,
      twitter: process.env.TWITTER_HANDLE || '',
      sameAs,
      jobTitle: 'Art Director & Creative Consultant',
      areaServed: 'Worldwide',
      knowsLanguages: ['English', 'Russian'],
      foundingOrg: { name: 'Ounce Agency', url: 'https://ounce.agency' },
    },
  };
};
