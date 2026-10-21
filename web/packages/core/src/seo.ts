/** Хелперы для title/description/canonical. Чистый TS. */

export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–—]+$/, '') + '…';
}

/**
 * «Заголовок — Бренд» не длиннее maxLen. Бренд опускается, если не помещается.
 * Длинный заголовок режется по последнему «:», «,» или « — » (без многоточия), если остаётся ≥ половины лимита,
 * иначе — по слову с «…».
 */
export function buildTitle(title: string, siteName?: string, maxLen = 60): string {
  const t = title.replace(/\s+/g, ' ').trim();
  const full = siteName ? `${t} — ${siteName}` : t;
  if (full.length <= maxLen) return full;
  if (t.length <= maxLen) return t;
  const head = t.slice(0, maxLen + 1);
  const cut = Math.max(head.lastIndexOf(':'), head.lastIndexOf(','), head.lastIndexOf(' — '));
  return cut >= maxLen / 2 ? t.slice(0, cut).trim() : truncate(t, maxLen);
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
