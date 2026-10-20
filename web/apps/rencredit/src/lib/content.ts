import { getCollection, type CollectionEntry } from 'astro:content';
import { getOffers, showsRate } from './offers';

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

/** Меньше стольких офферов с признаком подборки — подборка тонкая. То же число — в astro.config.mjs (sitemap). */
export const MIN_GUIDE_OFFERS = 3;

/**
 * Витрина подборки, отфильтрованная в сборке: в HTML только офферы с признаком guide.feature,
 * клиентский фильтр (preset) их не сужает. Признаки офферов не додумываем: если подтверждённых
 * меньше MIN_GUIDE_OFFERS — thin (noindex, вне меню), витрина — все офферы kind.
 */
export async function getGuideOffers(guide: CollectionEntry<'guides'>) {
  const { kind, feature, verifiedOnly } = guide.data;
  const all = (await getOffers(kind)).filter((o) => !verifiedOnly || (o.verified && showsRate(o)));
  const own = feature ? all.filter((o) => o.features.includes(feature)) : all;
  if (own.length >= MIN_GUIDE_OFFERS) return { offers: own, preset: feature, thin: false };
  return { offers: all, preset: undefined, thin: true };
}

/** Подборки для меню, футера и перелинковки — без тонких (noindex). */
export async function getIndexableGuides() {
  const guides = await getGuides();
  const thin = await Promise.all(guides.map(async (g) => (await getGuideOffers(g)).thin));
  return guides.filter((_, i) => !thin[i]);
}

/** Индексируемые подборки, в витрине которых есть оффер (блок «Входит в подборки» на обзоре). */
export async function getOfferGuides(slug: string) {
  const guides = await getIndexableGuides();
  const lists = await Promise.all(guides.map(getGuideOffers));
  return guides.filter((_, i) => lists[i].offers.some((o) => o.slug === slug));
}
