import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ManifestPage, PageData, FullPage } from './types';
import editorialPostsRaw from './editorialPosts.json';
import { replaceLegacyBrand } from '../lib/brand';
import { siteConfig } from './siteConfig';

const PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const DEFAULT_DATA_ROOT = resolve(PROJECT_ROOT, 'site_pipeline/output');
const DATA_ROOT = import.meta.env.CONTENT_OUTPUT_DIR
  ? resolve(process.cwd(), import.meta.env.CONTENT_OUTPUT_DIR)
  : DEFAULT_DATA_ROOT;
const ENABLE_EDITORIAL_POSTS = import.meta.env.ENABLE_EDITORIAL_POSTS
  ? import.meta.env.ENABLE_EDITORIAL_POSTS === 'true'
  : !import.meta.env.CONTENT_OUTPUT_DIR;

interface EditorialPost {
  id: string;
  path: string;
  section: string;
  title: string;
  description: string;
  h1: string;
  date_published: string;
  date_modified: string;
  content_html: string;
  severity: string;
  issue_codes: string[];
}

const editorialPosts = editorialPostsRaw as EditorialPost[];

// Rewrite internal donor links to root-relative paths so they work
// on any domain (localhost, staging, production).
const LEGACY_HOST = ['moss', 'eo.ru'].join('');
const LEGACY_SLUG = ['moss', 'eo'].join('');
const LEGACY_SOCIAL_HANDLE = ['moss', 'eoru'].join('');
const LEGACY_SITE_URL = `https://${LEGACY_HOST}`;
const LEGACY_DOMAIN_RE = LEGACY_HOST.replace(/\./g, '\\.');
const configuredSourceDomain = siteConfig.legacyContent.sourceDomain.replace(/\/$/, '');
const configuredSourceHost = configuredSourceDomain.replace(/^https?:\/\//, '').replace(/^www\./, '');
const OLD_DOMAINS = Array.from(new Set([
  `https://${LEGACY_HOST}`,
  `http://${LEGACY_HOST}`,
  `https://www.${LEGACY_HOST}`,
  configuredSourceDomain,
  `https://${configuredSourceHost}`,
  `http://${configuredSourceHost}`,
  `https://www.${configuredSourceHost}`,
]));
const SITE_URL = siteConfig.siteUrl.replace(/\/$/, '');

function rewriteLegacyPath(path: string = ''): string {
  return path
    .replace(
      `/o-kompanii/rekvizity-kompanii-${LEGACY_SLUG}/`,
      '/o-kompanii/rekvizity-kompanii/',
    )
    .replace(
      `/stoimost-uslug/cenoobrazovanie-v-${LEGACY_SLUG}-ekspert/`,
      '/stoimost-uslug/cenoobrazovanie-v-seo/',
    );
}

function rewriteLegacyUrl(value: string = ''): string {
  let result = value;
  for (const domain of OLD_DOMAINS) {
    result = result.replaceAll(domain + '/', `${SITE_URL}/`);
    result = result.replaceAll(domain, SITE_URL);
  }
  result = result.replaceAll(`${SITE_URL}//`, `${SITE_URL}/`);
  return rewriteLegacyPath(result);
}

function rewriteInternalLinks(html: string): string {
  let result = html;
  for (const domain of OLD_DOMAINS) {
    result = result.replaceAll(domain + '/', '/');
    result = result.replaceAll(domain, '/');
  }
  return rewriteLegacyPath(result);
}

function rewriteLegacyMediaUrl(url: string = ''): string {
  const sourceDomain = siteConfig.legacyContent.sourceDomain.replace(/\/$/, '');
  let rootRelative = url;
  for (const domain of OLD_DOMAINS) {
    rootRelative = rootRelative.replace(new RegExp(`^${domain.replace(/\./g, '\\.')}`, 'i'), '');
  }
  rootRelative = rootRelative.replace(new RegExp(`^${siteConfig.siteUrl.replace(/\/$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
  if (!rootRelative.startsWith('/content/') && !rootRelative.startsWith('/wp-content/')) {
    return url;
  }

  if (siteConfig.legacyContent.mediaMode === 'source') {
    return `${sourceDomain}${rootRelative}`;
  }
  if (siteConfig.legacyContent.mediaMode === 'local') {
    return rootRelative;
  }
  return siteConfig.legacyContent.mediaPlaceholder;
}

function rewriteLegacySrcset(value: string): string {
  return value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      if (!parts[0]) return candidate;
      parts[0] = rewriteLegacyMediaUrl(parts[0]);
      return parts.join(' ');
    })
    .join(', ');
}

function normalizeLegacyMedia(html: string): string {
  return html
    .replace(/\s(src)=["']["']/gi, (_match, attr: string) => (
      ` ${attr}="${siteConfig.legacyContent.mediaPlaceholder}"`
    ))
    .replace(/\s(src)=["']([^"']+)["']/gi, (_match, attr: string, value: string) => (
      ` ${attr}="${rewriteLegacyMediaUrl(value)}"`
    ))
    .replace(/\s(srcset)=["']([^"']+)["']/gi, (_match, attr: string, value: string) => (
      ` ${attr}="${rewriteLegacySrcset(value)}"`
    ))
    .replace(/\sdata-src=["']([^"']+)["']/gi, (_match, value: string) => (
      ` src="${rewriteLegacyMediaUrl(value)}"`
    ))
    .replace(/\sdata-srcset=["'][^"']+["']/gi, '');
}

function stripLegacyContactStaff(html: string): string {
  return html
    .replace(/<section\b[^>]*class=["'][^"']*section-contacts__stuff[^"']*["'][\s\S]*?<\/section>/gi, '')
    .replace(/<div\b[^>]*class=["'][^"']*contacts-soc[^"']*["'][\s\S]*?<\/div>/gi, '');
}

function stripLegacySocialLinks(html: string): string {
  const sources = [
    `vk\\.com/${LEGACY_SOCIAL_HANDLE}`,
    `(?:www\\.)?facebook\\.com/${LEGACY_SOCIAL_HANDLE}`,
    `dzen\\.ru/${LEGACY_SLUG}`,
    `t\\.me/${LEGACY_SLUG}`,
  ].join('|');
  const linkRe = new RegExp(`<a\\b[^>]*href=["']https?:\\/\\/(?:${sources})["'][\\s\\S]*?<\\/a>`, 'gi');
  return html.replace(linkRe, '');
}

function normalizeLegacyContacts(value: string = ''): string {
  return value
    .replace(/8\s*\(?495\)?\s*111[-\s]?55[-\s]?99(?:\s*доб\.?\s*\d+)?/g, siteConfig.company.phone)
    .replace(/\+7\s*\(?495\)?\s*111[-\s]?55[-\s]?99(?:\s*доб\.?\s*\d+)?/g, siteConfig.company.phone)
    .replace(/8\s*\(?800\)?\s*350[-\s]?99[-\s]?87/g, siteConfig.company.phone)
    .replace(/\+7\s*\(?800\)?\s*350[-\s]?99[-\s]?87/g, siteConfig.company.phone)
    .replace(/\+7\s*\(916\)\s*219[-\s]?65[-\s]?78/g, siteConfig.company.phone)
    .replace(/8\s*\(?916\)?\s*219[-\s]?65[-\s]?78/g, siteConfig.company.phone)
    .replace(/\+7\s*\(915\)\s*274[-\s]?74[-\s]?06/g, siteConfig.company.phone)
    .replace(/8\s*\(919\)\s*728[-\s]?91[-\s]?96/g, siteConfig.company.phone)
    .replace(new RegExp(`\\b\\d{1,2}@${LEGACY_DOMAIN_RE}\\b`, 'gi'), siteConfig.company.email)
    .replace(new RegExp(`\\binfo@${LEGACY_DOMAIN_RE}\\b`, 'gi'), siteConfig.company.email)
    .replace(/https:\/\/t\.me\/[A-Za-z0-9_]+/g, '')
    .replace(new RegExp(`\\b${['moss', 'eo'].join('')}\\d+\\s*-\\s*Skype\\b`, 'gi'), '')
    .replace(/\bИНН:\s*7714908129/g, `ИНН: ${siteConfig.company.inn}`)
    .replace(/\bКПП:\s*502701001/g, `КПП: ${siteConfig.company.kpp}`)
    .replace(/\bОГРН:\s*1137746509933/g, `ОГРН: ${siteConfig.company.ogrn}`)
    .replace(/\bБИК:\s*44525593/g, `БИК: ${siteConfig.company.bik}`)
    .replace(/\b7714908129\b/g, siteConfig.company.inn)
    .replace(/\b502701001\b/g, siteConfig.company.kpp)
    .replace(/\b1137746509933\b/g, siteConfig.company.ogrn)
    .replace(/\b44525593\b/g, siteConfig.company.bik)
    .replace(/ОАО «АЛЬФА-БАНК»/g, siteConfig.company.bank)
    .replace(/ОАО АЛЬФА-БАНК/g, siteConfig.company.bank)
    .replace(/40702810301100003591/g, siteConfig.company.account)
    .replace(/30101810200000000593/g, siteConfig.company.correspondentAccount)
    .replace(/г\.\s*Москва\s*,?\s*Ленинградский проспект,\s*57А/g, siteConfig.company.address)
    .replace(/Ленинградский проспект,\s*57А/g, siteConfig.company.address)
    .replace(/Понедельник\s*-\s*Пятница\s*с\s*09:30\s*до\s*18:30\s*\(по Москве\)/g, siteConfig.company.worktime)
    .replace(/href=["']tel:[^"']+["']/gi, `href="tel:${siteConfig.company.phoneHref}"`)
    .replace(/href=["']mailto:[^"']+["']/gi, `href="mailto:${siteConfig.company.email}"`);
}

function normalizeLegacyHtml(html: string): string {
  return normalizeLegacyContacts(normalizeLegacyMedia(stripLegacySocialLinks(stripLegacyContactStaff(html))));
}

function stripEmbeddedH1(html: string): string {
  return html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, '').trim();
}

// Strip div blocks whose class attribute contains any of the given class names.
// Handles arbitrary nesting by tracking <div> depth.
function stripDivsByClass(html: string, ...classNames: string[]): string {
  const patterns = classNames.map(
    (c) => new RegExp(`(?:^|\\s)${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`),
  );

  const parts: string[] = [];
  let i = 0;
  let lastSafe = 0;
  const len = html.length;

  while (i < len) {
    const divPos = html.indexOf('<div', i);
    if (divPos === -1) break;

    const tagEnd = html.indexOf('>', divPos);
    if (tagEnd === -1) break;

    const fullTag = html.slice(divPos, tagEnd + 1);
    if (!/^<div\b/i.test(fullTag)) { i = divPos + 1; continue; }

    const classMatch = fullTag.match(/\bclass="([^"]*)"/i);
    if (classMatch && patterns.some((p) => p.test(classMatch[1]))) {
      parts.push(html.slice(lastSafe, divPos));
      i = tagEnd + 1;
      let depth = 1;
      while (i < len && depth > 0) {
        const nd = html.indexOf('<div', i);
        const nc = html.indexOf('</div>', i);
        if (nc === -1) { i = len; break; }
        if (nd !== -1 && nd < nc) {
          const nte = html.indexOf('>', nd);
          if (nte !== -1 && /^<div\b/i.test(html.slice(nd, nte + 1))) {
            depth++;
            i = nte + 1;
          } else {
            i = nd + 1;
          }
        } else {
          depth--;
          i = nc + 6; // '</div>'.length
        }
      }
      lastSafe = i;
    } else {
      i = divPos + 1;
    }
  }

  parts.push(html.slice(lastSafe));
  return parts.join('');
}

// Remove donor-specific noise that appears in crawled content_html.
function stripDonorNoise(html: string): string {
  return stripDivsByClass(
    html,
    'authors-wrap',         // donor author profiles with real emails/photos
    'rat_block_item',       // product rating cards in listing pages
    'product_review-block', // product review containers
    'button_show',          // JS "show more" toggle
    'button_hide',          // JS "hide" toggle
    'related',              // donor "related articles" widget (we render our own RelatedPages)
  );
}

let _manifest: ManifestPage[] | null = null;
let _allPages: FullPage[] | null = null;

export function loadManifest(): ManifestPage[] {
  if (_manifest) return _manifest;
  const raw = readFileSync(resolve(DATA_ROOT, 'build_manifest.json'), 'utf-8');
  _manifest = JSON.parse(raw) as ManifestPage[];
  return _manifest;
}

export function loadPageData(relativePageFile: string): PageData {
  const abs = resolve(PROJECT_ROOT, relativePageFile);
  const data = JSON.parse(readFileSync(abs, 'utf-8')) as PageData;
  if (data.content_html) data.content_html = stripDonorNoise(data.content_html);
  // Rewrite donor links to root-relative paths so they work on any host
  if (data.content_html) data.content_html = rewriteInternalLinks(data.content_html);
  if (data.excerpt_html) data.excerpt_html = rewriteInternalLinks(data.excerpt_html);
  if (data.content_html) data.content_html = normalizeLegacyHtml(data.content_html);
  if (data.excerpt_html) data.excerpt_html = normalizeLegacyHtml(data.excerpt_html);
  return normalizePageData(data);
}

function normalizePageData(data: PageData): PageData {
  return {
    ...data,
    seed: {
      ...data.seed,
      source_url: rewriteLegacyUrl(data.seed.source_url),
      url: rewriteLegacyUrl(data.seed.url),
      path: rewriteLegacyPath(data.seed.path),
      title: replaceLegacyBrand(data.seed.title),
      meta_description: replaceLegacyBrand(data.seed.meta_description),
      h1: replaceLegacyBrand(data.seed.h1),
      h2: data.seed.h2.map(replaceLegacyBrand),
    },
    meta: {
      ...data.meta,
      html_title: replaceLegacyBrand(data.meta.html_title),
      html_meta_description: replaceLegacyBrand(data.meta.html_meta_description),
      canonical: rewriteLegacyUrl(data.meta.canonical),
    },
    wp: data.wp
      ? {
          ...data.wp,
          slug: rewriteLegacyPath(`/${data.wp.slug}/`).replace(/^\/|\/$/g, ''),
          link: rewriteLegacyUrl(data.wp.link),
        }
      : null,
    wp_title: replaceLegacyBrand(data.wp_title),
    excerpt_html: replaceLegacyBrand(data.excerpt_html),
    excerpt_text: normalizeLegacyContacts(replaceLegacyBrand(data.excerpt_text)),
    content_html: stripEmbeddedH1(replaceLegacyBrand(data.content_html)),
    content_text: normalizeLegacyContacts(replaceLegacyBrand(data.content_text)),
    links: data.links.map((link) => ({
      ...link,
      href: rewriteLegacyUrl(normalizeLegacyContacts(link.href || '')),
      text: normalizeLegacyContacts(replaceLegacyBrand(link.text)),
    })),
    images: data.images.map((image) => ({
      ...image,
      src: rewriteLegacyMediaUrl(image.src || ''),
      alt: replaceLegacyBrand(image.alt),
    })),
  };
}

function normalizeFullPage(page: FullPage): FullPage {
  return {
    ...page,
    path: rewriteLegacyPath(page.path),
    url: rewriteLegacyUrl(page.url),
    title: replaceLegacyBrand(page.title),
    description: replaceLegacyBrand(page.description),
    h1: replaceLegacyBrand(page.h1),
    data: normalizePageData(page.data),
  };
}

function editorialToFullPage(post: EditorialPost): FullPage {
  const seed = {
    source_url: `${LEGACY_SITE_URL}${post.path}`,
    url: `${LEGACY_SITE_URL}${post.path}`,
    path: post.path,
    section: post.section,
    depth: post.path.replace(/^\/|\/$/g, '').split('/').length,
    title: post.title,
    meta_description: post.description,
    h1: post.h1,
    h2: [],
    csv_line: 0,
  };
  const data: PageData = {
    id: post.id,
    seed,
    fetch: {},
    meta: {
      html_title: post.title,
      html_meta_description: post.description,
      canonical: `${siteConfig.siteUrl.replace(/\/$/, '')}${post.path}`,
      body_class: [],
    },
    wp: post.date_published
      ? {
          id: 0,
          type: 'post',
          slug: post.id,
          date: post.date_published,
          modified: post.date_modified,
          link: `${LEGACY_SITE_URL}${post.path}`,
          featured_media: 0,
          categories: [],
          tags: [],
        }
      : null,
    wp_title: post.h1,
    excerpt_html: '',
    excerpt_text: '',
    content_html: post.content_html,
    content_text: '',
    links: [],
    images: [],
    quality: {
      content_text_chars: post.content_html.length,
      links_count: 0,
      images_count: 0,
      has_csv_title: true,
      has_csv_h1: true,
    },
  };
  return {
    id: post.id,
    path: post.path,
    url: `${LEGACY_SITE_URL}${post.path}`,
    section: post.section,
    title: post.title,
    description: post.description,
    h1: post.h1,
    severity: post.severity as FullPage['severity'],
    issue_codes: post.issue_codes,
    page_file: '',
    data,
  };
}

export function loadAllPages(): FullPage[] {
  if (_allPages) return _allPages;

  const crawled = loadManifest().map((entry) => ({
    ...entry,
    data: loadPageData(entry.page_file),
  }));

  // Editorial posts are local additions for the default Mosseo-derived dataset.
  const activeEditorialPosts = ENABLE_EDITORIAL_POSTS ? editorialPosts : [];
  const editorialByPath = new Map(activeEditorialPosts.map((p) => [p.path, editorialToFullPage(p)]));
  const merged = crawled.map((p) => editorialByPath.get(p.path) ?? p);
  const crawledPaths = new Set(crawled.map((p) => p.path));
  for (const [path, ep] of editorialByPath) {
    if (!crawledPaths.has(path)) merged.push(ep);
  }

  _allPages = merged.map(normalizeFullPage);
  return _allPages;
}

function pathDepth(path: string): number {
  return path.replace(/^\/|\/$/g, '').split('/').filter(Boolean).length;
}

export function getDescendantPages(parentPath: string): FullPage[] {
  const parentDepth = pathDepth(parentPath);
  return loadAllPages()
    .filter((candidate) => (
      candidate.path !== parentPath &&
      candidate.path.startsWith(parentPath) &&
      pathDepth(candidate.path) > parentDepth
    ))
    .sort((a, b) => a.path.localeCompare(b.path, 'ru'));
}

export function getImmediateChildPages(parentPath: string): FullPage[] {
  const parentDepth = pathDepth(parentPath);
  return getDescendantPages(parentPath).filter((candidate) => pathDepth(candidate.path) === parentDepth + 1);
}

export interface RelatedPageLink {
  path: string;
  title: string;
  h1: string;
}

let _relatedPages: Record<string, RelatedPageLink[]> | null = null;

function loadRelatedPagesMap(): Record<string, RelatedPageLink[]> {
  if (_relatedPages) return _relatedPages;
  const relatedPath = resolve(DATA_ROOT, 'related_pages.json');
  try {
    const raw = readFileSync(relatedPath, 'utf-8');
    _relatedPages = JSON.parse(raw) as Record<string, RelatedPageLink[]>;
  } catch {
    _relatedPages = {};
  }
  return _relatedPages;
}

export function getRelatedPages(pageId: string): RelatedPageLink[] {
  return loadRelatedPagesMap()[pageId] ?? [];
}
