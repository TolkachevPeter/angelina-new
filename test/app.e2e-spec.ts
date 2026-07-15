import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { tmpdir } from 'os';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure';

const SITE_URL = 'https://test.angelinabelokon.com';

describe('Belokon site (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.SITE_URL = SITE_URL;
    process.env.CONTACT_EMAIL = 'hello@test.example';
    process.env.LEADS_PATH = join(tmpdir(), `leads-e2e-${Date.now()}.json`);
    process.env.THROTTLE_LIMIT = '1000'; // avoid tripping the limiter in functional tests

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET / (server-rendered landing)', () => {
    it('returns crawlable HTML with resolved SEO tags', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('<title>Angelina Belokon');
      expect(res.text).toContain(`<link rel="canonical" href="${SITE_URL}/"`);
      expect(res.text).toContain(`<meta property="og:image" content="${SITE_URL}/og.png"`);
      expect(res.text).toContain('<h1');
      expect(res.text).toContain('I make brands look expensive');
      // No unresolved template tokens leaked to the client.
      expect(res.text).not.toMatch(/%%[A-Z_]+%%/);
    });

    it('embeds valid JSON-LD structured data', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);
      const m = res.text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(m).toBeTruthy();
      const data = JSON.parse(m![1]);
      expect(data['@context']).toBe('https://schema.org');
      expect(Array.isArray(data['@graph'])).toBe(true);
    });

    it('sends hardened security headers', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-request-id']).toBeTruthy();
    });
  });

  describe('SEO endpoints', () => {
    it('GET /robots.txt', async () => {
      const res = await request(app.getHttpServer()).get('/robots.txt').expect(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toContain('Disallow: /api/');
      expect(res.text).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    });

    it('GET /sitemap.xml', async () => {
      const res = await request(app.getHttpServer()).get('/sitemap.xml').expect(200);
      expect(res.headers['content-type']).toMatch(/xml/);
      expect(res.text).toContain(`<loc>${SITE_URL}/</loc>`);
    });
  });

  describe('Health', () => {
    it('GET /api/health', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe('up');
    });

    it('GET /api/health/ready', () =>
      request(app.getHttpServer()).get('/api/health/ready').expect(200));
  });

  describe('POST /api/contact', () => {
    it('accepts a valid lead', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/contact')
        .send({ name: 'Jane', email: 'jane@example.com', details: 'Hi' })
        .expect(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.leadId).toBeTruthy();
    });

    it('rejects an invalid email', () =>
      request(app.getHttpServer())
        .post('/api/contact')
        .send({ name: 'x', email: 'not-an-email' })
        .expect(400));

    it('rejects a filled honeypot (spam bot)', () =>
      request(app.getHttpServer())
        .post('/api/contact')
        .send({ name: 'x', email: 'x@example.com', website: 'http://spam.example' })
        .expect(400));
  });

  describe('Not found (no SPA fallback)', () => {
    it('GET /index.html -> 404', () =>
      request(app.getHttpServer()).get('/index.html').expect(404));

    it('GET /does-not-exist -> 404', () =>
      request(app.getHttpServer()).get('/does-not-exist').expect(404));
  });

  describe('Static assets', () => {
    it('serves fonts with long-lived immutable caching', async () => {
      const res = await request(app.getHttpServer())
        .get('/fonts/c18aa534-0097-4925-b33b-ae198cd6a5f0.woff2')
        .expect(200);
      expect(res.headers['cache-control']).toContain('immutable');
    });

    it('serves the OG image', () =>
      request(app.getHttpServer()).get('/og.png').expect(200).expect('Content-Type', /image\/png/));
  });

  describe('Internationalization (EN / RU / FR)', () => {
    it('serves Russian at /ru with translated content and lang', async () => {
      const res = await request(app.getHttpServer()).get('/ru').expect(200);
      expect(res.headers['content-language']).toBe('ru');
      expect(res.text).toContain('<html lang="ru"');
      expect(res.text).toContain(`<link rel="canonical" href="${SITE_URL}/ru"`);
      expect(res.text).toContain('Работы'); // translated nav
      expect(res.text).not.toMatch(/\{\{[a-zA-Z0-9._]+\}\}/); // no leftover content tokens
    });

    it('serves French at /fr with translated content and lang', async () => {
      const res = await request(app.getHttpServer()).get('/fr').expect(200);
      expect(res.headers['content-language']).toBe('fr');
      expect(res.text).toContain('<html lang="fr"');
      expect(res.text).toContain(`<link rel="canonical" href="${SITE_URL}/fr"`);
      expect(res.text).not.toMatch(/\{\{[a-zA-Z0-9._]+\}\}/);
    });

    it('emits hreflang alternates (en/ru/fr + x-default) on every locale', async () => {
      for (const path of ['/', '/ru', '/fr']) {
        const res = await request(app.getHttpServer()).get(path).expect(200);
        expect(res.text).toContain(`hreflang="en" href="${SITE_URL}/"`);
        expect(res.text).toContain(`hreflang="ru" href="${SITE_URL}/ru"`);
        expect(res.text).toContain(`hreflang="fr" href="${SITE_URL}/fr"`);
        expect(res.text).toContain('hreflang="x-default"');
      }
    });

    it('localizes JSON-LD inLanguage and the sitemap lists all locales', async () => {
      const ru = await request(app.getHttpServer()).get('/ru').expect(200);
      expect(ru.text).toContain('"inLanguage":"ru"');
      const sitemap = await request(app.getHttpServer()).get('/sitemap.xml').expect(200);
      expect(sitemap.text).toContain(`<loc>${SITE_URL}/ru</loc>`);
      expect(sitemap.text).toContain(`<loc>${SITE_URL}/fr</loc>`);
      expect(sitemap.text).toContain('hreflang="x-default"');
    });
  });

  describe('Colour themes', () => {
    it('renders a default paper theme, swatches, and a CSP-hashed init script', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);
      expect(res.text).toMatch(/<html lang="en" data-theme="[a-z]+"/);
      expect(res.text).toContain('data-theme-swatch="ivory"');
      expect(res.text).toContain('data-theme-swatch="sand"');
      expect(res.text).toContain("localStorage.getItem('belokon-theme')"); // no-flash init
      // The inline init script's hash is whitelisted (no 'unsafe-inline').
      expect(res.headers['content-security-policy']).toMatch(/script-src [^;]*'sha256-/);
    });

    it('applies the theme system on every language', async () => {
      for (const path of ['/ru', '/fr']) {
        const res = await request(app.getHttpServer()).get(path).expect(200);
        expect(res.text).toMatch(/data-theme="[a-z]+"/);
        expect(res.text).toContain('data-theme-swatch=');
      }
    });
  });
});

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = '3';
    process.env.THROTTLE_TTL = '60';
    process.env.LEADS_PATH = join(tmpdir(), `leads-throttle-${Date.now()}.json`);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.THROTTLE_LIMIT;
  });

  it('returns 429 once the contact limit is exceeded', async () => {
    const server = app.getHttpServer();
    const body = { name: 'T', email: 't@example.com' };
    for (let i = 0; i < 3; i++) {
      await request(server).post('/api/contact').send(body).expect(200);
    }
    await request(server).post('/api/contact').send(body).expect(429);
  });
});
