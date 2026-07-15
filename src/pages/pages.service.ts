import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { AppConfig } from '../config/configuration';
import { CONTENT, DEFAULT_LANG, Lang, LANGS } from '../i18n/content';
import { SeoService } from '../seo/seo.service';
import { THEME_INIT_SCRIPT, THEMES } from '../theme/theme';

/**
 * Renders the landing page server-side, once per language, at boot. The static
 * template is read once; its `{{content.key}}` tokens are filled from the
 * language dictionary and its `%%SEO%%` tokens from per-language SEO values
 * (title, description, canonical, hreflang alternates, JSON-LD, switcher). Each
 * fully-formed document is cached in memory, so every locale is served as
 * complete, crawlable HTML on the first byte.
 */
@Injectable()
export class PagesService implements OnModuleInit {
  private readonly logger = new Logger(PagesService.name);
  private readonly templatePath = join(process.cwd(), 'views', 'index.html');
  private readonly rendered = new Map<Lang, string>();

  constructor(
    private readonly config: ConfigService,
    private readonly seo: SeoService,
  ) {}

  async onModuleInit(): Promise<void> {
    const template = await this.loadTemplate();
    for (const meta of LANGS) this.rendered.set(meta.code, this.renderLang(meta.code, template));
    this.logger.log(`Landing rendered for ${LANGS.map((l) => l.code).join(', ')}.`);
  }

  /** Cached HTML for a language (falls back to the default language). */
  html(lang: Lang): string {
    return this.rendered.get(lang) ?? this.rendered.get(DEFAULT_LANG) ?? '';
  }

  private async loadTemplate(): Promise<string> {
    try {
      return await readFile(this.templatePath, 'utf-8');
    } catch (err) {
      this.logger.error(`Unable to read landing template at ${this.templatePath}`, err as Error);
      throw err;
    }
  }

  private renderLang(lang: Lang, template: string): string {
    const site = this.config.getOrThrow<AppConfig['site']>('site');
    const meta = LANGS.find((l) => l.code === lang)!;
    const dict = CONTENT[lang];
    const canonical = this.seo.localeUrl(lang);
    const defaultTheme = this.config.getOrThrow<string>('theme');

    const handle = site.twitter
      ? site.twitter.startsWith('@')
        ? site.twitter
        : `@${site.twitter}`
      : '';
    const twitterMeta = handle
      ? `\n<meta name="twitter:site" content="${esc(handle)}">\n<meta name="twitter:creator" content="${esc(handle)}">`
      : '';

    const seoTokens: Record<string, string> = {
      '%%TITLE%%': esc(dict['seo.title']),
      '%%DESCRIPTION%%': esc(dict['seo.description']),
      '%%CANONICAL%%': esc(canonical),
      '%%OG_IMAGE%%': esc(site.ogImage),
      '%%LOCALE%%': esc(meta.locale),
      '%%LOCALE_SHORT%%': esc(meta.htmlLang),
      '%%CONTACT_EMAIL%%': esc(site.contactEmail),
      '%%JSONLD%%': this.seo.structuredData(lang),
      '%%TWITTER_META%%': twitterMeta,
      '%%HREFLANG%%': this.hreflangLinks(),
      '%%OG_LOCALE_ALT%%': this.ogLocaleAlternates(lang),
      '%%LANG_SWITCHER%%': this.langSwitcher(lang),
      '%%THEME%%': esc(defaultTheme),
      '%%THEME_INIT%%': `<script>${THEME_INIT_SCRIPT}</script>`,
      '%%THEME_SWITCHER%%': this.themeSwitcher(defaultTheme, dict['theme.label'] ?? 'Theme'),
    };

    // 1) Fill content tokens from the language dictionary.
    let html = template.replace(/\{\{([a-zA-Z0-9._]+)\}\}/g, (match, key: string) => {
      const value = dict[key];
      if (value === undefined) {
        this.logger.warn(`Missing i18n key "${key}" for lang "${lang}"`);
        return '';
      }
      return esc(value);
    });

    // 2) Fill SEO/meta tokens.
    html = html.replace(/%%[A-Z_]+%%/g, (match) => seoTokens[match] ?? match);

    const missing = html.match(/%%[A-Z_]+%%|\{\{[a-zA-Z0-9._]+\}\}/g);
    if (missing) this.logger.warn(`Unresolved tokens (${lang}): ${[...new Set(missing)].join(', ')}`);
    return html;
  }

  /** hreflang alternates for the <head> (absolute URLs + x-default). */
  private hreflangLinks(): string {
    const links = LANGS.map(
      (l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${esc(this.seo.localeUrl(l.code))}">`,
    );
    links.push(`<link rel="alternate" hreflang="x-default" href="${esc(this.seo.localeUrl('en'))}">`);
    return links.join('\n');
  }

  private ogLocaleAlternates(current: Lang): string {
    return LANGS.filter((l) => l.code !== current)
      .map((l) => `\n<meta property="og:locale:alternate" content="${esc(l.locale)}">`)
      .join('');
  }

  /** Inline EN · RU · FR switcher, marking the active language. */
  private langSwitcher(current: Lang): string {
    const items = LANGS.map((l) => {
      const active = l.code === current;
      const href = l.path || '/';
      const color = active ? '#131211' : '#6B6355';
      const weight = active ? '700' : '500';
      const aria = active ? ' aria-current="page"' : '';
      return (
        `<a href="${href}" hreflang="${l.hreflang}"${aria} ` +
        `style="color:${color}; font-weight:${weight}; text-decoration:none;" ` +
        `data-style-hover="color:var(--accent,#A9001E);">${l.label}</a>`
      );
    });
    const sep = '<span aria-hidden="true" style="color:#C8C3B8;">·</span>';
    return (
      `<nav aria-label="Language" style="display:inline-flex; align-items:center; gap:8px; ` +
      `font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase;">` +
      items.join(sep) +
      `</nav>`
    );
  }

  /** Paper-tone swatches. app.js wires clicks, persistence and the active state. */
  private themeSwitcher(active: string, label: string): string {
    const dots = THEMES.map((t) => {
      const pressed = t.code === active ? 'true' : 'false';
      return (
        `<button type="button" data-theme-swatch="${esc(t.code)}" aria-pressed="${pressed}" ` +
        `aria-label="${esc(t.label)}" title="${esc(t.label)}" ` +
        `style="width:15px; height:15px; border-radius:50%; padding:0; cursor:pointer; ` +
        `background:${esc(t.swatch)}; border:1px solid var(--hairline,#E6E2DB);"></button>`
      );
    }).join('');
    return (
      `<div role="group" aria-label="${esc(label)}" ` +
      `style="display:inline-flex; align-items:center; gap:7px;">${dots}</div>`
    );
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
