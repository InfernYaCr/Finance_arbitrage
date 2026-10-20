// Проверка контента перед сборкой. Запуск: node web/scripts/check-content.mjs
// ALLOW_STALE=1 — срочный деплой: устаревшие checkedAt и снимок реестра ЦБ становятся предупреждениями.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath, domainToUnicode } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '../apps/rencredit');
const pool = JSON.parse(readFileSync(resolve(here, '../packages/core/src/data/pool.json'), 'utf-8'));
const poolById = new Map(pool.map((o) => [o.id, o]));

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const ALLOW_STALE = process.env.ALLOW_STALE === '1';
const stale = (m) => (ALLOW_STALE ? warns : errors).push(`${m}${ALLOW_STALE ? ' (ALLOW_STALE=1)' : ''}`);

// Снимок реестров ЦБ (web/scripts/sync-cbr-registry.mjs). Для всех офферов и услуг с номером МФО (13–15 цифр)
// или банка (1–4 цифры): организация действует, номер и ОГРН совпадают с источниками, снимок не старше 14 дней.
const REGISTRY_PATH = join(app, 'src/data/cbr-registry.json');
const REGISTRY_MAX_AGE_DAYS = 14;
const registry = existsSync(REGISTRY_PATH) ? JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8')) : null;
if (!registry) err('нет src/data/cbr-registry.json: запустите node web/scripts/sync-cbr-registry.mjs');
else if (!((Date.now() - Date.parse(registry.asOf)) / 86400000 <= REGISTRY_MAX_AGE_DAYS)) {
  stale(`cbr-registry.json: данные ЦБ на ${registry.asOf}, старше ${REGISTRY_MAX_AGE_DAYS} дней — запустите node web/scripts/sync-cbr-registry.mjs`);
}
const host = (u) => domainToUnicode(new URL(u).hostname.replace(/^www\./, ''));
function checkRegistry(f, license, src) {
  if (!registry || !/^\d{1,4}$|^\d{13,15}$/.test(license ?? '')) return;
  const r = registry.byLicense[license];
  if (!r) return err(`${f}: № ${license} нет в cbr-registry.json — запустите sync-cbr-registry`);
  if (r.status !== 'active') return err(`${f}: № ${license} в реестре ЦБ не действует (${r.status}${r.excludedAt ? ` с ${r.excludedAt}` : ''}) — реклама запрещена (ч. 13 ст. 28 38-ФЗ)`);
  if (!src) return;
  if (src.registry?.regNumber !== license) err(`${f}: cbrLicense ${license} не совпадает с registry.regNumber ${src.registry?.regNumber}`);
  if (src.registry?.ogrn !== r.ogrn) err(`${f}: ОГРН в источниках ${src.registry?.ogrn} ≠ ОГРН в реестре ЦБ ${r.ogrn} (${r.name})`);
  const h = src.officialUrl && host(src.officialUrl);
  if (h && r.sites && !r.sites.some((s) => h === s || h.endsWith(`.${s}`))) {
    warns.push(`${f}: сайт ${h} не указан в реестре ЦБ у ${r.name} (там: ${r.sites.join(', ') || '—'})`);
  }
}
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null);

// verified=true разрешён только при полном наборе источников в src/data/offer-sources/<slug>.json:
// официальный сайт, запись реестра ЦБ, проверка не старше 30 дней, источник на каждое числовое условие.
const SOURCES_DIR = join(app, 'src/data/offer-sources');
const SOURCED_FIELDS = ['amountMin', 'amountMax', 'termMinDays', 'termMaxDays', 'rateDayPct', 'freeDays',
  'pskMin', 'pskMax', 'ageMin', 'ageMax'];
const MAX_AGE_DAYS = 30;
// Предельная ПСК (ч. 11 ст. 6 353-ФЗ: min(292%, среднерыночная ПСК × 4/3)) на договоры IV кв. 2026 —
// таблицы ЦБ от 14.08.2026 (cbr.ru/statistics/bank_sector/psk/). Обновлять ежеквартально.
// mfo: беззалоговые займы до 100 тыс. — 292; card: кредитные карты (ЭСП) — 72,809; credit: банк, без залога — 55,437.
const PSK_LIMIT = { mfo: 292, card: 72.809, credit: 55.437 };
const noPsk = [];
function checkSources(f, slug, o) {
  const path = join(SOURCES_DIR, `${slug}.json`);
  if (!existsSync(path)) return err(`${f}: verified=true, но нет src/data/offer-sources/${slug}.json`);
  const s = JSON.parse(readFileSync(path, 'utf-8'));
  const ageDays = (Date.now() - Date.parse(s.checkedAt)) / 86400000;
  if (!(ageDays >= 0)) err(`${f}: checkedAt (${s.checkedAt}) некорректна`);
  else if (!(ageDays <= MAX_AGE_DAYS)) stale(`${f}: checkedAt (${s.checkedAt}) старше ${MAX_AGE_DAYS} дней`);
  if (!/^https:\/\//.test(s.officialUrl ?? '')) err(`${f}: в источниках нет officialUrl`);
  if (!s.registry?.regNumber || !s.registry?.url) err(`${f}: в источниках нет записи реестра ЦБ (regNumber + url)`);
  if (o.cbrLicense !== s.registry?.regNumber) err(`${f}: cbrLicense не совпадает с registry.regNumber`);
  for (const k of SOURCED_FIELDS) {
    if (o[k] != null && !s.fields?.[k]?.url) err(`${f}: у поля ${k} нет источника (fields.${k}.url)`);
  }
}

// 1. Офферы
const offersDir = join(app, 'src/content/offers');
const files = readdirSync(offersDir).filter((f) => f.endsWith('.json'));
const slugs = new Set();
const poolUsed = new Map();
for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err(`${f}: slug должен быть латиницей kebab-case`);
  if (slugs.has(slug)) err(`${f}: дубль slug`);
  slugs.add(slug);
  const o = JSON.parse(readFileSync(join(offersDir, f), 'utf-8'));
  const p = poolById.get(o.poolId);
  if (!p) err(`${f}: poolId ${o.poolId} нет в пуле`);
  else {
    if (!p.enabled) err(`${f}: оффер ${o.poolId} в пуле выключен (enabled=false)`);
    if (!p.href) err(`${f}: у оффера ${o.poolId} нет href`);
    // vertical=finance в Saleads — общий раздел (займы под залог и т.п.): допустим для mfo/credit
    if (p.vertical !== o.kind && !(p.vertical === 'finance' && (o.kind === 'mfo' || o.kind === 'credit'))) {
      err(`${f}: kind=${o.kind}, а vertical в пуле=${p.vertical}`);
    }
  }
  if (poolUsed.has(o.poolId)) err(`${f}: poolId ${o.poolId} уже использован в ${poolUsed.get(o.poolId)}`);
  poolUsed.set(o.poolId, f);
  if (o.verified) checkSources(f, slug, o);
  checkRegistry(f, o.cbrLicense, readJson(join(SOURCES_DIR, f)));
  if (o.rateDayPct > 0.8) err(`${f}: ставка > 0.8%/день (ч. 23 ст. 5 353-ФЗ)`);
  if (o.pskMax != null && o.pskMax > PSK_LIMIT[o.kind]) err(`${f}: ПСК ${o.pskMax} > предельной ${PSK_LIMIT[o.kind]} для kind=${o.kind}`);
  if (o.pskMin != null && o.pskMax != null && o.pskMin > o.pskMax) err(`${f}: pskMin > pskMax`);
  if (o.pskMin == null || o.pskMax == null || !o.legalName || !o.erid) noPsk.push(slug);
  if (o.amountMin > o.amountMax) err(`${f}: amountMin > amountMax`);
  if (o.termMinDays > o.termMaxDays) err(`${f}: termMin > termMax`);
  if (o.ageMin > o.ageMax) err(`${f}: ageMin > ageMax`);
  if (o.logo && !existsSync(join(app, 'public', o.logo))) err(`${f}: нет файла логотипа ${o.logo}`);
  if (o.rating != null || o.reviewsCount != null) warns.push(`${f}: rating/reviewsCount заполнены — убедитесь, что это не выдуманные отзывы`);
}

// 1b. Некредитные продукты (services): страхование, дебетовые карты, вклады, РКО.
// verified=true — только с src/data/service-sources/<slug>.json: officialUrl, свежий checkedAt,
// источник на каждый highlight (fields[label].url) и на ratePct/priceFrom, лицензия ЦБ совпадает с реестром.
const SVC_SOURCES_DIR = join(app, 'src/data/service-sources');
const SVC_KIND = { osago: 'insurance', kasko: 'insurance', 'strahovanie-ipoteki': 'insurance', 'strahovanie-puteshestvennikov': 'insurance',
  'strahovanie-kvartiry': 'insurance', 'strahovanie-drugoe': 'insurance', 'debetovye-karty': 'debit', vklady: 'deposit', rko: 'rko' };
function checkServiceSources(f, slug, o) {
  const path = join(SVC_SOURCES_DIR, `${slug}.json`);
  if (!existsSync(path)) return err(`${f}: verified=true, но нет src/data/service-sources/${slug}.json`);
  const s = JSON.parse(readFileSync(path, 'utf-8'));
  const ageDays = (Date.now() - Date.parse(s.checkedAt)) / 86400000;
  if (!(ageDays >= 0)) err(`${f}: checkedAt (${s.checkedAt}) некорректна`);
  else if (!(ageDays <= MAX_AGE_DAYS)) stale(`${f}: checkedAt (${s.checkedAt}) старше ${MAX_AGE_DAYS} дней`);
  if (!/^https:\/\//.test(s.officialUrl ?? '')) err(`${f}: в источниках нет officialUrl`);
  for (const h of o.highlights ?? []) {
    if (!s.fields?.[h.label]?.url) err(`${f}: у highlight «${h.label}» нет источника (fields["${h.label}"].url)`);
  }
  for (const k of ['ratePct', 'priceFrom']) {
    if (o[k] != null && !s.fields?.[k]?.url) err(`${f}: у поля ${k} нет источника (fields.${k}.url)`);
  }
  if (o.cbrLicense && (s.registry?.regNumber !== o.cbrLicense || !s.registry?.url)) {
    err(`${f}: cbrLicense не совпадает с registry.regNumber (или нет registry.url)`);
  }
}
const servicesDir = join(app, 'src/content/services');
const svcFiles = existsSync(servicesDir) ? readdirSync(servicesDir).filter((f) => f.endsWith('.json')) : [];
for (const f of svcFiles) {
  const rel = `services/${f}`;
  const slug = f.replace(/\.json$/, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err(`${rel}: slug должен быть латиницей kebab-case`);
  const text = readFileSync(join(servicesDir, f), 'utf-8');
  const o = JSON.parse(text);
  const p = poolById.get(o.poolId);
  if (!p) err(`${rel}: poolId ${o.poolId} нет в пуле`);
  else if (!p.enabled || !p.href) err(`${rel}: оффер ${o.poolId} в пуле выключен или без href`);
  if (poolUsed.has(o.poolId)) err(`${rel}: poolId ${o.poolId} уже использован в ${poolUsed.get(o.poolId)}`);
  poolUsed.set(o.poolId, rel);
  if (SVC_KIND[o.category] !== o.kind) err(`${rel}: category=${o.category} не соответствует kind=${o.kind}`);
  if (o.logo && !existsSync(join(app, 'public', o.logo))) err(`${rel}: нет файла логотипа ${o.logo}`);
  if (/(Ренессанс|Renaissance)/i.test(text)) err(`${rel}: упоминание «Ренессанс»`);
  if (!o.legalName || !o.erid) warns.push(`${rel}: реклама без legalName/erid (ст. 18.1 38-ФЗ)`);
  if (o.verified) checkServiceSources(rel, slug, o);
  checkRegistry(rel, o.cbrLicense, readJson(join(SVC_SOURCES_DIR, f)));
}

// 2. Тексты: чужие партнёрки и внешние ссылки
const PARTNER_RE = /saleads|admitad|leads\.su|leadgid|actionpay|cpa\.|utm_|aff_|click\.|clickid/i;
const ALLOWED_HOSTS = ['cbr.ru', 'www.cbr.ru', 'consultant.ru', 'www.consultant.ru', 'garant.ru', 'pravo.gov.ru',
  'publication.pravo.gov.ru', 'gosuslugi.ru', 'www.gosuslugi.ru', 'fedresurs.ru', 'interfax.ru', 'www.interfax.ru',
  'banki.ru', 'www.banki.ru', 'rencredit-online.ru', 'duma.gov.ru', 'government.ru', 'kremlin.ru', 'minfin.gov.ru', 'xn--90aivcdt6dxbc.xn--p1ai',
  // первоисточники для «Источников» статей: госорганы и суды, финомбудсмен, БКИ, ДОМ.РФ, «Российская газета» (публикация законов),
  // банки и BNPL-сервисы без своего оффера
  'gov.ru', 'ksrf.ru', 'vsrf.ru', 'finombudsman.ru', 'rospotrebnadzor.ru', 'grfc.ru', 'rg.ru', 'nbki.ru', 'scoring.ru',
  'xn--d1aqf.xn--p1ai', 'sovcombank.ru', 'vtb.ru', 'dolyame.ru', 'yandex.ru', 'alfabank.servicecdn.ru'];
// + домены официальных сайтов кредиторов и партнёров (officialUrl в offer-sources/service-sources), с поддоменами
for (const dir of [SOURCES_DIR, SVC_SOURCES_DIR]) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const u = readJson(join(dir, f)).officialUrl;
    if (u) ALLOWED_HOSTS.push(new URL(u).hostname.split('.').slice(-2).join('.'));
  }
}
const allowedHost = (h) => ALLOWED_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
}
const contentDir = join(app, 'src/content');
const counts = {};
for (const file of walk(contentDir)) {
  const ext = extname(file);
  if (!['.md', '.mdx', '.json'].includes(ext)) continue;
  const rel = file.slice(contentDir.length + 1).replace(/\\/g, '/');
  const sect = rel.split('/')[0];
  counts[sect] = (counts[sect] ?? 0) + 1;
  const text = readFileSync(file, 'utf-8');
  if (sect !== 'offers' && sect !== 'services') {
    if (PARTNER_RE.test(text)) err(`${rel}: похоже на партнёрскую ссылку/метку`);
    for (const m of text.matchAll(/https?:\/\/([^\s/)"'\]>]+)/g)) {
      // В новостях только allowlist; в статьях и гайдах прочее — предупреждение редактору (не первоисточник?)
      if (!allowedHost(m[1].toLowerCase())) (sect === 'news' ? err : (x) => warns.push(x))(`${rel}: внешняя ссылка на ${m[1]} (нет в allowlist)`);
    }
    if (/100\s*%\s*(одобрен|гарант)/i.test(text)) err(`${rel}: обещание 100% одобрения`);
    if (/(Ренессанс|Renaissance)/i.test(text)) err(`${rel}: упоминание «Ренессанс Кредит»`);
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) err(`${rel}: нет frontmatter`);
    else if (/^verified:/m.test(fm[1])) err(`${rel}: лишнее поле verified`);
  }
}

if (noPsk.length) warns.push(`реклама без pskMin+pskMax/legalName/erid (ст. 18.1, ч. 1 и 3 ст. 28 38-ФЗ): ${noPsk.join(', ')}`);
console.log('Контент:', counts, `| офферов в пуле использовано: ${poolUsed.size}`);
for (const w of warns) console.warn('WARN', w);
if (errors.length) {
  for (const e of errors) console.error('ERROR', e);
  process.exit(1);
}
console.log('check-content: OK');
