# Angelina Belokon — personal brand site

Production NestJS + TypeScript site for an art director & creative consultant, built for **excellent SEO**: the landing page is rendered **server-side** as fully crawlable, semantic HTML with structured data — no client-side hydration is needed to see content or meta tags.

- **Framework:** NestJS 10 (Express) + TypeScript (strict)
- **Port:** 4280
- **Runtime:** Node ≥ 20

## What makes it SEO-strong

- **Server-rendered, crawlable HTML.** `GET /` returns the complete page (headings, copy, work, services, FAQ) in the first byte. The original design was a JS-only bundle that decoded its content at runtime and showed *nothing* to crawlers — that is replaced by a static, semantic template.
- **Full meta suite** injected server-side per deployment: `<title>`, description, canonical, robots, Open Graph + Twitter cards, `theme-color`, locale.
- **Structured data (JSON-LD):** `WebSite`, `Person`, `ProfessionalService` (with an offer catalogue) and `FAQPage` — eligible for rich results.
- **`robots.txt` and `sitemap.xml`** generated dynamically from `SITE_URL`.
- **Self-hosted fonts** (Golos Text + Prata, `woff2`, preloaded, `font-display: swap`) — no third-party requests, better LCP.
- **Real favicons, `apple-touch-icon`, `site.webmanifest`, and a 1200×630 OG image.**
- **Performance:** immutable long-cache static assets, gzip, the decorative 3D hero is lazy-loaded (after idle, only when in view, skipped on small screens / reduced-motion / low-memory devices) so it never blocks LCP.
- **Accessibility:** `<main>` landmark, skip link, `lang`, image `alt` text, focus-visible styles, `prefers-reduced-motion` support.

## Project layout

```
src/
  main.ts                     bootstrap (thin)
  bootstrap/configure.ts      all cross-cutting setup (helmet CSP, compression, static, pipes, filters)
  config/                     typed + validated env configuration
  common/                     global exception filter, request-logging interceptor
  pages/                      GET / — server-rendered landing (SEO injection + cache)
  seo/                        robots.txt, sitemap.xml, JSON-LD structured data
  leads/                      POST /api/contact — validated, rate-limited, honeypot
  health/                     liveness / readiness probes
views/index.html              landing template with %%TOKENS%% (not publicly served)
public/                       static assets: fonts, images, favicons, app.js, og.png
test/                         e2e tests
```

## Run

```bash
npm install
cp .env.example .env        # then set SITE_URL, CONTACT_EMAIL, SOCIAL_LINKS
npm run start:dev           # http://localhost:4280
```

Production:

```bash
npm ci && npm run build
NODE_ENV=production SITE_URL=https://your-domain.com npm run start:prod
```

Docker:

```bash
SITE_URL=https://your-domain.com docker compose up -d --build
```

## Configuration

All configuration is via environment variables, validated at boot (see `.env.example`). The SEO-critical ones:

| Variable        | Purpose                                                        |
| --------------- | ------------------------------------------------------------- |
| `SITE_URL`      | Canonical origin — canonical tag, OG URLs, JSON-LD, sitemap   |
| `CONTACT_EMAIL` | Contact address on the page and in structured data            |
| `SOCIAL_LINKS`  | Comma-separated `sameAs` profile links                        |
| `CORS_ORIGIN`   | Enables CORS only if set                                      |
| `THROTTLE_*`    | Contact-form rate limit (default 5 requests / 60 s per IP)    |

## Routes

| Route                | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `GET /`              | Server-rendered landing page (cacheable at the edge)    |
| `GET /robots.txt`    | Dynamic robots, points to the sitemap                   |
| `GET /sitemap.xml`   | Dynamic XML sitemap                                     |
| `GET /api/health`    | Health status; `…/live` and `…/ready` probes           |
| `POST /api/contact`  | `{ name, email, brand?, details?, language? }` → lead   |

`POST /api/contact` is validated with class-validator (400 on bad input), rate-limited, and protected by a hidden `website` honeypot field. Leads are appended to `LEADS_PATH` with serialized writes. Swap the JSON store for a database by replacing `LeadsService` only.

## Security

`helmet` with a strict Content-Security-Policy (`script-src 'self'`, no inline scripts; inline styles allowed for the design), HSTS in production, `nosniff`, `frame-ancestors 'none'`, `X-Powered-By` removed, per-request `X-Request-Id`. Runs as a non-root container user with a Docker `HEALTHCHECK`.

## Tests

```bash
npm test          # unit tests (config, SEO, leads)
npm run test:e2e  # end-to-end: routes, SEO tags, JSON-LD, validation, throttling, 404s
```

## Updating the landing content

The template lives at `views/index.html` (served through `PagesService`, not as a static file). Edit copy/markup there; `%%TOKENS%%` are replaced at boot with values from config. To refresh work images, drop real files into `public/assets/img/` replacing the placeholder SVGs (keep the same filenames and aspect ratios, and update the `alt` text in the template).
