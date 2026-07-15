import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SeoService } from './seo.service';
import { CONTENT } from '../i18n/content';

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
      providers: [SeoService, { provide: ConfigService, useValue: { getOrThrow: () => site } }],
    }).compile();
    seo = moduleRef.get(SeoService);
  });

  describe('localeUrl', () => {
    it('maps each language to its canonical URL', () => {
      expect(seo.localeUrl('en')).toBe('https://example.com/');
      expect(seo.localeUrl('ru')).toBe('https://example.com/ru');
      expect(seo.localeUrl('fr')).toBe('https://example.com/fr');
    });
  });

  describe('structuredData', () => {
    it('produces valid, inline-safe JSON-LD with the expected @graph types', () => {
      const raw = seo.structuredData('en');
      expect(raw).not.toMatch(/</); // no literal "<" survives (inline-script safe)
      const data = JSON.parse(raw);
      expect(data['@context']).toBe('https://schema.org');
      const types = data['@graph'].map((n: { '@type': string }) => n['@type']);
      expect(types).toEqual(['WebSite', 'Person', 'ProfessionalService']);
    });

    it('localizes description and inLanguage per language', () => {
      const ru = JSON.parse(seo.structuredData('ru'));
      const website = ru['@graph'].find((n: { '@type': string }) => n['@type'] === 'WebSite');
      expect(website.inLanguage).toBe('ru');
      expect(website.description).toBe(CONTENT.ru['seo.description']);
    });

    it('lists exactly three localized service offers', () => {
      const fr = JSON.parse(seo.structuredData('fr'));
      const svc = fr['@graph'].find(
        (n: { '@type': string }) => n['@type'] === 'ProfessionalService',
      );
      const offers = svc.hasOfferCatalog.itemListElement;
      expect(offers).toHaveLength(3);
      expect(offers[0].itemOffered.name).toBe(CONTENT.fr['services.s1.title']);
    });
  });

  describe('robots', () => {
    it('allows crawling, disallows the API, points to the sitemap', () => {
      const robots = seo.robots();
      expect(robots).toContain('Disallow: /api/');
      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
    });
  });

  describe('sitemap', () => {
    it('lists every localized URL with hreflang alternates and x-default', () => {
      const xml = seo.sitemap();
      expect(xml).toContain('<loc>https://example.com/</loc>');
      expect(xml).toContain('<loc>https://example.com/ru</loc>');
      expect(xml).toContain('<loc>https://example.com/fr</loc>');
      expect(xml).toContain('hreflang="ru"');
      expect(xml).toContain('hreflang="x-default"');
      expect(xml).toContain('xmlns:xhtml');
    });
  });
});
