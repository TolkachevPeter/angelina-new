import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { AppConfig } from '../config/configuration';
import { SeoService } from '../seo/seo.service';

/**
 * Renders the single landing page server-side: the static HTML template is read
 * once at boot, its `%%TOKEN%%` placeholders are replaced with the deployment's
 * SEO values and the JSON-LD graph, and the fully-formed document is cached in
 * memory. Crawlers and users receive complete, meaningful HTML on the first
 * byte — no client-side hydration required to see content or meta tags.
 */
@Injectable()
export class PagesService implements OnModuleInit {
  private readonly logger = new Logger(PagesService.name);
  private readonly templatePath = join(process.cwd(), 'views', 'index.html');
  private rendered = '';

  constructor(
    private readonly config: ConfigService,
    private readonly seo: SeoService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.render();
  }

  get html(): string {
    return this.rendered;
  }

  private async render(): Promise<void> {
    const site = this.config.getOrThrow<AppConfig['site']>('site');
    const canonical = `${site.url}/`;

    // Twitter attribution is only emitted when a handle is configured.
    const handle = site.twitter ? (site.twitter.startsWith('@') ? site.twitter : `@${site.twitter}`) : '';
    const twitterMeta = handle
      ? `\n<meta name="twitter:site" content="${esc(handle)}">\n<meta name="twitter:creator" content="${esc(handle)}">`
      : '';

    const tokens: Record<string, string> = {
      '%%TWITTER_META%%': twitterMeta,
      '%%TITLE%%': esc(site.title),
      '%%DESCRIPTION%%': esc(site.description),
      '%%CANONICAL%%': esc(canonical),
      '%%OG_IMAGE%%': esc(site.ogImage),
      '%%LOCALE%%': esc(site.locale),
      '%%LOCALE_SHORT%%': esc(site.localeShort),
      '%%CONTACT_EMAIL%%': esc(site.contactEmail),
      '%%JSONLD%%': this.seo.structuredData(),
    };

    let template: string;
    try {
      template = await readFile(this.templatePath, 'utf-8');
    } catch (err) {
      this.logger.error(`Unable to read landing template at ${this.templatePath}`, err as Error);
      throw err;
    }

    this.rendered = template.replace(/%%[A-Z_]+%%/g, (match) => tokens[match] ?? match);

    const missing = this.rendered.match(/%%[A-Z_]+%%/g);
    if (missing) this.logger.warn(`Unresolved template tokens: ${[...new Set(missing)].join(', ')}`);
    this.logger.log(`Landing page rendered (${this.rendered.length} bytes) for ${canonical}`);
  }
}

/** HTML-escape for values placed in both text and attribute contexts. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
