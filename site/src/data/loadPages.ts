import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ManifestPage, PageData, FullPage } from './types';
import editorialPostsRaw from './editorialPosts.json';

const DATA_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../site_pipeline/output',
);

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

// Rewrite internal mosseo.ru links to root-relative paths so they work
// on any domain (localhost, staging, production).
const OLD_DOMAINS = ['https://mosseo.ru', 'http://mosseo.ru', 'https://www.mosseo.ru'];
function rewriteInternalLinks(html: string): string {
  let result = html;
  for (const domain of OLD_DOMAINS) {
    result = result.replaceAll(domain + '/', '/');
    result = result.replaceAll(domain, '/');
  }
  return result;
}

let _manifest: ManifestPage[] | null = null;

export function loadManifest(): ManifestPage[] {
  if (_manifest) return _manifest;
  const raw = readFileSync(resolve(DATA_ROOT, 'build_manifest.json'), 'utf-8');
  _manifest = JSON.parse(raw) as ManifestPage[];
  return _manifest;
}

export function loadPageData(relativePageFile: string): PageData {
  const abs = resolve(DATA_ROOT, '../../', relativePageFile);
  const data = JSON.parse(readFileSync(abs, 'utf-8')) as PageData;
  // Rewrite mosseo.ru links → root-relative so they work on any host
  if (data.content_html) data.content_html = rewriteInternalLinks(data.content_html);
  if (data.excerpt_html) data.excerpt_html = rewriteInternalLinks(data.excerpt_html);
  return data;
}

function editorialToFullPage(post: EditorialPost): FullPage {
  const seed = {
    source_url: `https://mosseo.ru${post.path}`,
    url: `https://mosseo.ru${post.path}`,
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
      canonical: `https://mosseo.expert${post.path}`,
      body_class: [],
    },
    wp: post.date_published
      ? {
          id: 0,
          type: 'post',
          slug: post.id,
          date: post.date_published,
          modified: post.date_modified,
          link: `https://mosseo.ru${post.path}`,
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
    url: `https://mosseo.ru${post.path}`,
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
  const crawled = loadManifest().map((entry) => ({
    ...entry,
    data: loadPageData(entry.page_file),
  }));

  // Editorial posts override crawled pages with same path; new paths are appended
  const editorialByPath = new Map(editorialPosts.map((p) => [p.path, editorialToFullPage(p)]));
  const merged = crawled.map((p) => editorialByPath.get(p.path) ?? p);
  const crawledPaths = new Set(crawled.map((p) => p.path));
  for (const [path, ep] of editorialByPath) {
    if (!crawledPaths.has(path)) merged.push(ep);
  }

  return merged;
}
