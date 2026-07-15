import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { statSync } from 'fs';
import { join } from 'path';
import { AppConfig } from '../config/configuration';

type Site = AppConfig['site'];

/**
 * Owns everything a crawler consumes: JSON-LD structured data, robots.txt and
 * the XML sitemap. All values derive from the typed site config so a single
 * SITE_URL change propagates to canonical URLs, structured data and the
 * sitemap at once.
 */
@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);
  /** Computed once: a stable content date, not "now" on every request. */
  private readonly lastmod = this.resolveLastmod();

  constructor(private readonly config: ConfigService) {}

  private get site(): Site {
    return this.config.getOrThrow<Site>('site');
  }

  /** Absolute, canonical origin (no trailing slash). */
  get origin(): string {
    return this.site.url;
  }

  /**
   * A stable last-modified date for the sitemap: SITE_LASTMOD if set, otherwise
   * the modification time of the landing template. Resolved once at boot so the
   * value only changes when the content actually changes (on redeploy).
   */
  private resolveLastmod(): string {
    const override = process.env.SITE_LASTMOD;
    if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
    try {
      const mtime = statSync(join(process.cwd(), 'views', 'index.html')).mtime;
      return mtime.toISOString().slice(0, 10);
    } catch {
      this.logger.warn('Could not stat landing template for sitemap lastmod.');
      return '2026-01-01';
    }
  }

  /** JSON-LD @graph, safe to inline inside a <script type="application/ld+json">. */
  structuredData(): string {
    const s = this.site;
    const graph = [
      {
        '@type': 'WebSite',
        '@id': `${s.url}/#website`,
        url: `${s.url}/`,
        name: s.name,
        description: s.description,
        inLanguage: s.localeShort,
        publisher: { '@id': `${s.url}/#person` },
      },
      {
        '@type': 'Person',
        '@id': `${s.url}/#person`,
        name: s.name,
        url: `${s.url}/`,
        image: `${s.url}/og.png`,
        jobTitle: s.jobTitle,
        description: s.description,
        email: `mailto:${s.contactEmail}`,
        knowsLanguage: s.knowsLanguages,
        sameAs: s.sameAs,
        worksFor: {
          '@type': 'Organization',
          name: s.foundingOrg.name,
          url: s.foundingOrg.url,
        },
        knowsAbout: [
          'Art Direction',
          'Creative Direction',
          'Fashion Styling',
          'Brand Identity',
          'Campaign Production',
          'Visual Merchandising',
        ],
      },
      {
        '@type': 'ProfessionalService',
        '@id': `${s.url}/#service`,
        name: `${s.name} — Art Direction & Creative Consulting`,
        url: `${s.url}/`,
        image: `${s.url}/og.png`,
        description: s.description,
        founder: { '@id': `${s.url}/#person` },
        areaServed: s.areaServed,
        availableLanguage: s.knowsLanguages,
        email: `mailto:${s.contactEmail}`,
        sameAs: s.sameAs,
        priceRange: '$$$',
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Services',
          itemListElement: [
            this.offer(
              'Brand Visual Audit',
              'A working session plus a written report on what your visuals say about your price point and the exact fixes, prioritized.',
            ),
            this.offer(
              'Creative Direction',
              'Concept to final frame: campaign, lookbook or e-commerce shoot — moodboards, casting, styling, on-set direction and post supervision.',
            ),
            this.offer(
              'Creative Consulting',
              'A creative director on call: monthly art direction, content review, shoot supervision and guidance for your in-house team.',
            ),
          ],
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${s.url}/#faq`,
        mainEntity: [
          this.faq(
            'What does a Brand Visual Audit include?',
            'A focused working session and a written report: what your visuals communicate about your price point, where you lose the customer, and a prioritized list of fixes.',
          ),
          this.faq(
            'Do you work remotely or on set?',
            `${s.name} works worldwide — both remotely and on set — with brands across fashion and lifestyle.`,
          ),
          this.faq(
            'Which languages do you work in?',
            `Projects are run in ${s.knowsLanguages.join(' and ')}.`,
          ),
          this.faq(
            'Can you handle a full rebrand?',
            `Full visual identities and rebrands are delivered together with ${s.foundingOrg.name}, the brand studio ${s.name} co-founded.`,
          ),
        ],
      },
    ];

    const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    // Prevent a literal </script> in any string from closing the inline block.
    return json.replace(/</g, '\\u003c');
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

  sitemap(lastmod: string = this.lastmod): string {
    const url = `${this.site.url}/`;
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url>\n' +
      `    <loc>${url}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      '    <changefreq>monthly</changefreq>\n' +
      '    <priority>1.0</priority>\n' +
      '  </url>\n' +
      '</urlset>\n'
    );
  }

  private offer(name: string, description: string): Record<string, unknown> {
    return {
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name, description },
    };
  }

  private faq(question: string, answer: string): Record<string, unknown> {
    return {
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    };
  }
}
