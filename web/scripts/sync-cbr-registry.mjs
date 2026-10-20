// Снимок реестров Банка России по нашим кредиторам -> apps/rencredit/src/data/cbr-registry.json
// (файл коммитится, diff = ревью). Сборка читает только файл, сеть ей не нужна.
// МФО: list_MFO.xlsx (листы «Действующие» и «Исключенные»), разбор через системный unzip, без зависимостей.
// Банки: SOAP CreditOrgInfo.asmx — EnumBIC (точное RN === номер), затем CreditInfoByIntCodeXML.
// RegNumToIntCode не использовать: для «30» он вернёт ликвидированный АВТОБАНК-НИКОЙЛ.
// Номера берутся из cbrLicense в content/offers и content/services: 13–15 цифр — МФО, 1–4 цифры — банк,
// прочее (страховщики, проф. участники) пропускается.
// Запуск: node web/scripts/sync-cbr-registry.mjs. При сбое формата/сети снимок не трогаем, exit 1.
// Судит о данных web/scripts/check-content.mjs (статус, ОГРН, возраст снимка, домены).
import { readFileSync, readdirSync, writeFileSync, renameSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, domainToUnicode } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '../apps/rencredit');
const dst = join(app, 'src/data/cbr-registry.json');
const MFO_URL = 'https://www.cbr.ru/vfs/finmarkets/files/supervision/list_MFO.xlsx';
const BANK_URL = 'https://www.cbr.ru/CreditInfoWebServ/CreditOrgInfo.asmx';
const MIN_ACTIVE_MFO = 500;
const MIN_BANKS = 300;
const MAX_LAG_DAYS = 3;
const MFO_KIND = { 'Микрофинансовая компания': 'МФК', 'Микрокредитная компания': 'МКК' };

function fail(msg) {
  console.error(`sync-cbr-registry: ${msg}. cbr-registry.json не изменён.`);
  process.exit(1);
}

const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // по Москве
const lagDays = (iso) => (Date.parse(today) - Date.parse(iso)) / 86400e3;
/** 08.07.2011 -> 2011-07-08; иначе null. */
const isoDate = (s) => s?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)?.slice(1).reverse().join('-') ?? null;
/** Хост без протокола, www и пути, в юникоде (xn--80ajiuqaln.xn--p1ai -> финтерра.рф). */
const host = (s) => domainToUnicode(s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0]) || null;

// Номера наших организаций
const licenses = new Set();
for (const dir of ['offers', 'services']) {
  const d = join(app, 'src/content', dir);
  for (const f of readdirSync(d).filter((f) => f.endsWith('.json'))) {
    const n = JSON.parse(readFileSync(join(d, f), 'utf-8')).cbrLicense;
    if (n) licenses.add(n);
  }
}
const mfoNums = [...licenses].filter((n) => /^\d{13,15}$/.test(n));
const bankNums = [...licenses].filter((n) => /^\d{1,4}$/.test(n));

async function fetchOk(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) }).catch((e) => fail(`${url}: ${e.message}`));
  if (!res.ok) fail(`${url} -> HTTP ${res.status}`);
  return res;
}

// ---- МФО ----
const XML_ENT = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
const decode = (s) => s.replace(/&(#\d+|\w+);/g, (m, e) => (e[0] === '#' ? String.fromCodePoint(+e.slice(1)) : XML_ENT[e] ?? m));

/** Листы xlsx по имени: { name: rows[] }, строка = { A: 'текст', B: ... }. */
function readXlsx(file, names) {
  const part = (p) => execFileSync('unzip', ['-p', file, p], { maxBuffer: 256 << 20 }).toString('utf-8');
  const sst = part('xl/sharedStrings.xml').split('<si>').slice(1)
    .map((si) => decode([...si.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join('')));
  const rels = Object.fromEntries([...part('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*>/g)]
    .map(([tag]) => [tag.match(/Id="([^"]+)"/)[1], tag.match(/Target="([^"]+)"/)[1]]));
  const sheets = Object.fromEntries([...part('xl/workbook.xml').matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)]
    .map(([, name, rid]) => [decode(name), rels[rid]]));
  return Object.fromEntries(names.map((name) => {
    if (!sheets[name]) fail(`в list_MFO.xlsx нет листа «${name}» (есть: ${Object.keys(sheets).join(', ')})`);
    const xml = part(`xl/${sheets[name].replace(/^\/?xl\//, '')}`);
    const rows = [...xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map(([, r]) => Object.fromEntries(
      [...r.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, col, attrs, inner]) => {
        const v = inner?.match(/<v>([^<]*)<\/v>/)?.[1] ?? inner?.match(/<t[^>]*>([^<]*)<\/t>/)?.[1];
        return [col, v == null ? '' : (/t="s"/.test(attrs) ? sst[+v] : decode(v)).trim()];
      })));
    return [name, rows];
  }));
}

/** Записи листа: шапку ищем по тексту (у «Действующих» она на 5-й строке, у остальных на 3-й). */
function records(rows, sheet) {
  const asOf = isoDate(rows.slice(0, 5).map((r) => r.A ?? '').join(' ').match(/по состоянию на (\d{2}\.\d{2}\.\d{4})/)?.[1]);
  if (!asOf) fail(`лист «${sheet}»: не найдена дата «по состоянию на»`);
  const hi = rows.findIndex((r) => Object.values(r).includes('Регистрационный номер записи'));
  if (hi < 0) fail(`лист «${sheet}»: нет шапки «Регистрационный номер записи»`);
  const col = (prefix) => {
    const c = Object.keys(rows[hi]).find((k) => rows[hi][k].startsWith(prefix));
    if (!c) fail(`лист «${sheet}»: нет колонки «${prefix}…»`);
    return c;
  };
  const C = {
    reg: col('Регистрационный номер записи'), since: col('Дата внесения сведений'), kind: col('Вид микрофинансовой'),
    ogrn: col('Основной государственный'), name: col('Сокращенное наименование'),
    ...(sheet === 'Исключенные' ? { excludedAt: col('Дата внесения Банком России записи об исключении') } : { sites: col('Адреса официальных сайтов') }),
  };
  const list = rows.slice(hi + 1).filter((r) => r[C.reg]).map((r) => Object.fromEntries(Object.entries(C).map(([k, c]) => [k, r[c] ?? ''])));
  return { asOf, list };
}

async function syncMfo() {
  const tmp = mkdtempSync(join(tmpdir(), 'cbr-mfo-'));
  try {
    const file = join(tmp, 'list_MFO.xlsx');
    writeFileSync(file, Buffer.from(await (await fetchOk(MFO_URL)).arrayBuffer()));
    const book = readXlsx(file, ['Действующие', 'Исключенные']);
    const active = records(book['Действующие'], 'Действующие');
    const excluded = records(book['Исключенные'], 'Исключенные');
    // Предохранители от смены формата: иначе получим ложное «не в реестре»
    if (active.list.length < MIN_ACTIVE_MFO) fail(`«Действующие»: ${active.list.length} записей, нужно >= ${MIN_ACTIVE_MFO}`);
    if (!(lagDays(active.asOf) <= MAX_LAG_DAYS)) fail(`list_MFO.xlsx по состоянию на ${active.asOf}, старше ${MAX_LAG_DAYS} дн.`);
    const bad = active.list.find((r) => !/^\d{13,15}$/.test(r.reg) || !/^\d{13}$/.test(r.ogrn) || !isoDate(r.since) || !MFO_KIND[r.kind]);
    if (bad) fail(`«Действующие»: неожиданный формат записи ${JSON.stringify(bad)}`);
    const byReg = new Map(active.list.map((r) => [r.reg, r]));
    const exByReg = new Map(excluded.list.map((r) => [r.reg, r]));
    const out = {};
    for (const n of mfoNums) {
      const a = byReg.get(n);
      const e = exByReg.get(n);
      const r = a ?? e;
      out[n] = {
        type: 'mfo', status: a ? 'active' : e ? 'excluded' : 'missing',
        ...(r && { kind: MFO_KIND[r.kind] ?? r.kind, since: isoDate(r.since), ogrn: r.ogrn, name: r.name }),
        ...(!a && e && { excludedAt: isoDate(e.excludedAt) }),
        ...(a && { sites: [...new Set(a.sites.split(/[,;\s]+/).filter(Boolean).map(host).filter(Boolean))] }),
        ...(r && { url: `https://www.cbr.ru/finorg/foinfo/?ogrn=${r.ogrn}` }),
      };
    }
    return { asOf: active.asOf, count: active.list.length, out };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---- Банки ----
async function soap(method, inner = '') {
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method} xmlns="http://web.cbr.ru/">${inner}</${method}></soap:Body></soap:Envelope>`;
  const res = await fetchOk(BANK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"http://web.cbr.ru/${method}"` },
    body,
  });
  return res.text();
}
const tag = (xml, t) => xml.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1];

async function syncBanks() {
  const asOf = tag(await soap('LastUpdate'), 'LastUpdateResult')?.slice(0, 10);
  if (!asOf || !(lagDays(asOf) <= MAX_LAG_DAYS)) fail(`CreditOrgInfo.LastUpdate = ${asOf}, старше ${MAX_LAG_DAYS} дн.`);
  const enumXml = await soap('EnumBIC');
  const bics = [...enumXml.matchAll(/<BIC diffgr:id[^>]*>([\s\S]*?)<\/BIC>(?=<BIC diffgr:id|<\/EnumBIC>)/g)]
    .map(([, b]) => ({ rn: tag(b, 'RN'), intCode: tag(b, 'intCode') }));
  if (bics.length < MIN_BANKS) fail(`EnumBIC: ${bics.length} записей, нужно >= ${MIN_BANKS}`);
  const out = {};
  for (const n of bankNums) {
    const intCode = bics.find((b) => b.rn === n)?.intCode; // только точное равенство: «30» != «2275»
    if (!intCode) {
      out[n] = { type: 'bank', status: 'missing' };
      continue;
    }
    const xml = await soap('CreditInfoByIntCodeXML', `<InternalCode>${intCode}</InternalCode>`);
    const ogrn = tag(xml, 'MainRegNumber');
    const since = tag(xml, 'DateKGRRegistration')?.slice(0, 10);
    if (tag(xml, 'RegNumber') !== n || !/^\d{13}$/.test(ogrn ?? '') || !since) fail(`CreditInfoByIntCodeXML(${intCode}) для № ${n}: неожиданный ответ`);
    out[n] = {
      type: 'bank', status: tag(xml, 'OrgStatus') === 'норм.' ? 'active' : 'revoked', kind: 'банк', since, ogrn,
      name: decode(tag(xml, 'OrgName') ?? ''), url: `https://www.cbr.ru/finorg/foinfo/?ogrn=${ogrn}`,
    };
  }
  return { asOf, count: bics.length, out };
}

const [mfo, bank] = await Promise.all([syncMfo(), syncBanks()]);
const byLicense = Object.fromEntries(Object.entries({ ...mfo.out, ...bank.out }).sort(([a], [b]) => a.localeCompare(b)));
const snapshot = {
  asOf: [mfo.asOf, bank.asOf].sort()[0],
  fetchedAt: new Date().toISOString(),
  sources: {
    mfo: { asOf: mfo.asOf, url: MFO_URL, active: mfo.count },
    bank: { asOf: bank.asOf, url: BANK_URL, bics: bank.count },
  },
  byLicense,
};
const tmpFile = `${dst}.tmp`;
writeFileSync(tmpFile, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
renameSync(tmpFile, dst);
const notActive = Object.entries(byLicense).filter(([, r]) => r.status !== 'active');
console.log(`cbr-registry: МФО на ${mfo.asOf} (${mfo.count} действующих), банки на ${bank.asOf}; наших номеров ${Object.keys(byLicense).length} -> ${dst}`);
for (const [n, r] of notActive) console.warn(`sync-cbr-registry: № ${n} — ${r.status}${r.excludedAt ? ` с ${r.excludedAt}` : ''}${r.name ? ` (${r.name})` : ''}`);
