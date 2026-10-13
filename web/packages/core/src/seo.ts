/** Хелперы для title/description/canonical. Чистый TS. */

export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–—]+$/, '') + '…';
}

/** «Заголовок — Бренд»; бренд опускается, если не помещается в maxLen (по умолчанию 60). */
export function buildTitle(title: string, siteName?: string, maxLen = 60): string {
  const t = title.trim();
  if (!siteName) return truncate(t, maxLen);
  const full = `${t} — ${siteName}`;
  return full.length <= maxLen ? full : truncate(t, maxLen);
}

/** Description до ~160 символов; fallback — запасной текст. */
export function buildDescription(text: string | undefined, fallback = '', max = 160): string {
  return truncate(text?.trim() || fallback, max);
}

/** Абсолютный canonical: сайт + путь, всегда со слэшем на конце, без query/hash. */
export function canonicalUrl(site: string | URL, path = '/'): string {
  const base = String(site).replace(/\/+$/, '');
  const clean = path.replace(/[?#].*$/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  return clean ? `${base}/${clean}/` : `${base}/`;
}
