import { getCollection, type CollectionEntry } from 'astro:content';

type Article = CollectionEntry<'articles'>;

/**
 * Старые статьи WordPress жили по адресу /credit/<slug>.html. Переписанная статья с таким
 * legacyUrl остаётся на нём же (без редиректа): файл собирается как /credit/<slug>/index.html,
 * а .htaccess внутренним rewrite отдаёт его по старому адресу. /stati/<id>/ для неё не создаётся.
 */
const LEGACY_RE = /^https?:\/\/[^/]+\/credit\/([A-Za-z0-9._~%-]+)\.html$/;

/** slug старой статьи или undefined, если legacyUrl не задан/не подходит. */
export function legacySlug(entry: Pick<Article, 'data'>): string | undefined {
  return entry.data.legacyUrl?.trim().match(LEGACY_RE)?.[1];
}

/** Единственный источник ссылки на статью: карточки, «читайте также», листинги, поиск. */
export function articleHref(entry: Pick<Article, 'id' | 'data'>): string {
  const slug = legacySlug(entry);
  return slug ? `/credit/${slug}.html` : `/stati/${entry.id}/`;
}

/** Абсолютный canonical: точный legacyUrl (с .html) либо undefined (тогда по пути страницы). */
export function articleCanonical(entry: Pick<Article, 'data'>): string | undefined {
  return legacySlug(entry) ? entry.data.legacyUrl!.trim() : undefined;
}

export async function getArticles() {
  const all = await getCollection('articles', (e) => !e.data.draft);
  return all.sort((a, b) => +b.data.publishDate - +a.data.publishDate);
}
export async function getNews() {
  const all = await getCollection('news', (e) => !e.data.draft);
  return all.sort((a, b) => +b.data.publishDate - +a.data.publishDate);
}
export async function getGuides() {
  const all = await getCollection('guides');
  return all.sort((a, b) => a.data.order - b.data.order || a.data.navLabel.localeCompare(b.data.navLabel, 'ru'));
}
