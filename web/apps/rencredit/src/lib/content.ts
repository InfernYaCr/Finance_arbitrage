import { getCollection } from 'astro:content';

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
