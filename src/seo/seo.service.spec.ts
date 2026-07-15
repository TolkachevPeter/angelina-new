import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SeoService } from './seo.service';

const site = {
  url: 'https://example.com',
  name: 'Angelina Belokon',
  title: 'Angelina Belokon — Art Director',
  description: 'Art direction & creative consulting.',
  locale: 'en_US',
  localeShort: 'en',
  contactEmail: 'hello@example.com',
  ogImage: 'https://example.com/og.png',
  twitter: '',
  sameAs: ['https://instagram.com/ang.belokon'],
  jobTitle: 'Art Director & Creative Consultant',
  areaServed: 'Worldwide',
  knowsLanguages: ['English', 'Russian'],
  foundingOrg: { name: 'Ounce Agency', url: 'https://ounce.agency' },
};

describe('SeoService', () => {
  let seo: SeoService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SeoService,
        { provide: ConfigService, useValue: { getOrThrow: () => site } },
      ],
    }).compile();
    seo = moduleRef.get(SeoService);
  });

  describe('structuredData', () => {
    it('produces valid, parseable JSON-LD with the expected @graph types', () => {
      const raw = seo.structuredData();
      // Inline-script-safe: no literal "<" should survive.
      expect(raw).not.toMatch(/</);
      const data = JSON.parse(raw);
      expect(data['@context']).toBe('https://schema.org');
      const types = data['@graph'].map((n: { '@type': string }) => n['@type']);
      expect(types).toEqual(
        expect.arrayContaining(['WebSite', 'Person', 'ProfessionalService', 'FAQPage']),
      );
    });

    it('embeds canonical URLs and the person identity', () => {
      const data = JSON.parse(seo.structuredData());
      const person = data['@graph'].find((n: { '@type': string }) => n['@type'] === 'Person');
      expect(person.name).toBe('Angelina Belokon');
      expect(person['@id']).toBe('https://example.com/#person');
      expect(person.sameAs).toContain('https://instagram.com/ang.belokon');
    });

    it('lists exactly three service offers and non-empty FAQ', () => {
      const data = JSON.parse(seo.structuredData());
      const svc = data['@graph'].find(
        (n: { '@type': string }) => n['@type'] === 'ProfessionalService',
      );
      expect(svc.hasOfferCatalog.itemListElement).toHaveLength(3);
      const faq = data['@graph'].find((n: { '@type': string }) => n['@type'] === 'FAQPage');
      expect(faq.mainEntity.length).toBeGreaterThan(0);
    });
  });

  describe('robots', () => {
    it('allows crawling, disallows the API, and points to the sitemap', () => {
      const robots = seo.robots();
      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Allow: /');
      expect(robots).toContain('Disallow: /api/');
      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
    });
  });

  describe('sitemap', () => {
    it('is valid XML listing the canonical home URL', () => {
      const xml = seo.sitemap('2026-01-01');
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<loc>https://example.com/</loc>');
      expect(xml).toContain('<lastmod>2026-01-01</lastmod>');
      expect(xml).toContain('urlset');
    });
  });
});
