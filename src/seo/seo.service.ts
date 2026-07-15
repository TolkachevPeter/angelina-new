import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { statSync } from 'fs';
import { join } from 'path';
import { AppConfig } from '../config/configuration';
import { CONTENT, Lang, LANGS } from '../i18n/content';

type Site = AppConfig['site'];

/**
 * Owns everything a crawler consumes: JSON-LD structured data, robots.txt and
 * the multilingual XML sitemap. Structured data and sitemap are language-aware
 * (EN / RU / FR) so each localized URL advertises the right copy and its
 * hreflang alternates.
 */
@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);
  private readonly lastmod = this.resolveLastmod();

  constructor(private readonly config: ConfigService) {}

  private get site(): Site {
    return this.config.getOrThrow<Site>('site');
  }

  get origin(): string {
    return this.site.url;
  }

  /** Absolute URL for a language's home page: en → base/, ru → base/ru, fr → base/fr. */
  localeUrl(lang: Lang): string {
    const meta = LANGS.find((l) => l.code === lang)!;
    return `${this.site.url}${meta.path || '/'}`;
  }

  private resolveLastmod(): string {
    const override = process.env.SITE_LASTMOD;
    if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
    try {
      return statSync(join(process.cwd(), 'views', 'index.html')).mtime.toISOString().slice(0, 10);
    } catch {
      this.logger.warn('Could not stat landing template for sitemap lastmod.');
      return '2026-01-01';
    }
  }

  /** Localized JSON-LD @graph, safe to inline in a <script type="application/ld+json">. */
  structuredData(lang: Lang): string {
    const s = this.site;
    const t = CONTENT[lang];
    const url = this.localeUrl(lang);

    const graph = [
      {
        '@type': 'WebSite',
        '@id': `${s.url}/#website`,
        url: `${s.url}/`,
        name: s.name,
        description: t['seo.description'],
        inLanguage: lang,
        publisher: { '@id': `${s.url}/#person` },
      },
      {
        '@type': 'Person',
        '@id': `${s.url}/#person`,
        name: s.name,
        url: `${s.url}/`,
        image: `${s.url}/og.png`,
        jobTitle: s.jobTitle,
        description: t['seo.description'],
        email: `mailto:${s.contactEmail}`,
        knowsLanguage: s.knowsLanguages,
        sameAs: s.sameAs,
        worksFor: { '@type': 'Organization', name: s.foundingOrg.name, url: s.foundingOrg.url },
        knowsAbout: [
          'Art Direction',
          'Creative Direction',
          'Fashion Styling',
          'Brand Identity',
          'Campaign Production',
        ],
      },
      {
        '@type': 'ProfessionalService',
        '@id': `${s.url}/#service`,
        name: `${s.name} — Art Direction & Creative Consulting`,
        url,
        image: `${s.url}/og.png`,
        description: t['seo.description'],
        founder: { '@id': `${s.url}/#person` },
        areaServed: s.areaServed,
        availableLanguage: s.knowsLanguages,
        email: `mailto:${s.contactEmail}`,
        sameAs: s.sameAs,
        priceRange: '$$$',
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: t['services.heading'],
          itemListElement: [
            this.offer(t['services.s1.title'], t['services.s1.desc']),
            this.offer(t['services.s2.title'], t['services.s2.desc']),
            this.offer(t['services.s3.title'], t['services.s3.desc']),
          ],
        },
      },
    ];

    return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
      /</g,
      '\\u003c',
    );
  }

  robots(): string {
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      '',
      `Sitemap: ${this.site.url}/sitemap.xml`,
      '',
    ].join('\n');
  }

  /** Multilingual sitemap: one <url> per language, each listing all hreflang alternates. */
  sitemap(): string {
    const alternates = LANGS.map(
      (l) => `      <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${this.localeUrl(l.code)}"/>`,
    )
      .concat(
        `      <xhtml:link rel="alternate" hreflang="x-default" href="${this.localeUrl('en')}"/>`,
      )
      .join('\n');

    const urls = LANGS.map(
      (l) =>
        '  <url>\n' +
        `    <loc>${this.localeUrl(l.code)}</loc>\n` +
        `${alternates}\n` +
        `    <lastmod>${this.lastmod}</lastmod>\n` +
        '    <changefreq>monthly</changefreq>\n' +
        `    <priority>${l.code === 'en' ? '1.0' : '0.9'}</priority>\n` +
        '  </url>',
    ).join('\n');

    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
      'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
      urls +
      '\n</urlset>\n'
    );
  }

  private offer(name: string, description: string): Record<string, unknown> {
    return { '@type': 'Offer', itemOffered: { '@type': 'Service', name, description } };
  }
}
