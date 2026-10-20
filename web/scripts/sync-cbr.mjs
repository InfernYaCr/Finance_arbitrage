// Факты Банка России -> packages/core/src/data/facts.json (файл коммитится, diff = ревью YMYL).
// keyRate {value, since} из SOAP KeyRateXML, nextMeeting из календаря dkp/cal_mp,
// taxFree (необлагаемый лимит НДФЛ по вкладам, ст. 214.2 НК) из той же истории ставки.
// Запуск локально: node web/scripts/sync-cbr.mjs. В build/prebuild не встраивать:
// сборка без сети не должна падать. При любой ошибке старый файл не трогаем, exit 1.
//
// День решения ЦБ: KeyRateXML отдаёт новую ставку только с даты вступления в силу (обычно
// следующий понедельник). До этого кладём рядом facts.override.json, например:
//   { "keyRate": { "value": 13.5, "since": "2026-10-26", "announced": "2026-10-23" },
//     "nextMeeting": "2026-12-18" }
// Ключи override заменяют ключи из API целиком. Когда API догонит (since из API >= since из
// override), скрипт override игнорирует и просит удалить файл.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../packages/core/src/data');
const dst = resolve(dataDir, 'facts.json');
const overridePath = resolve(dataDir, 'facts.override.json');

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const TAX_FREE_BASE_RUB = 1_000_000;
const pad = (n) => String(n).padStart(2, '0');

function fail(msg) {
  console.error(`sync-cbr: ${msg}. facts.json не изменён.`);
  process.exit(1);
}

// Сегодня по Москве (UTC+3, без перехода на летнее время), YYYY-MM-DD.
const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const year = Number(today.slice(0, 4));

async function fetchText(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) fail(`${url} -> HTTP ${res.status}`);
  return res.text();
}

/** История ставки [{date, rate}] по возрастанию даты; в ответе ЦБ только рабочие дни. */
async function keyRateHistory() {
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><KeyRateXML xmlns="http://web.cbr.ru/"><fromDate>${year - 1}-12-01</fromDate><ToDate>${today}</ToDate></KeyRateXML></soap:Body></soap:Envelope>`;
  const xml = await fetchText('https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx', {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://web.cbr.ru/KeyRateXML"' },
    body,
  });
  const rows = [...xml.matchAll(/<DT>(\d{4}-\d{2}-\d{2})T[^<]*<\/DT><Rate>([\d.]+)<\/Rate>/g)]
    .map(([, date, rate]) => ({ date, rate: Number(rate) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 20) fail(`KeyRateXML: ${rows.length} строк истории, нужно >= 20`);
  for (const r of rows) if (!(r.rate >= 3 && r.rate <= 30)) fail(`KeyRateXML: ставка ${r.rate} на ${r.date} вне 3–30%`);
  return rows;
}

/** Ближайшая дата заседания по ставке >= сегодня. На странице календари всех лет. */
async function nextMeeting() {
  const html = await fetchText('https://www.cbr.ru/dkp/cal_mp/');
  const dates = html.split('class="date').flatMap((chunk) => {
    const m = chunk.match(/^[^>]*>(\d{1,2})&nbsp;([а-я]+) (\d{4}) года/);
    if (!m || !chunk.includes('Заседание Совета директоров')) return [];
    const month = MONTHS.indexOf(m[2]) + 1;
    return month ? [`${m[3]}-${pad(month)}-${pad(m[1])}`] : [];
  });
  const next = dates.filter((d) => d >= today).sort()[0];
  if (!next) fail(`cal_mp: нет будущих заседаний (найдено дат: ${dates.length})`);
  return next;
}

const rows = await keyRateHistory();
const last = rows.at(-1);
let since = last.date;
for (let i = rows.length - 1; i >= 0 && rows[i].rate === last.rate; i--) since = rows[i].date;

// Лимит = 1 млн × максимальная ставка на 1-е число каждого месяца года. 1-е число бывает
// выходным, поэтому берём последнюю известную ставку на эту дату или раньше.
const curMonth = Number(today.slice(5, 7));
const rateOn = (date) => rows.filter((r) => r.date <= date).at(-1)?.rate;
const firstRates = Array.from({ length: curMonth }, (_, i) => rateOn(`${year}-${pad(i + 1)}-01`));
if (firstRates.some((r) => r === undefined)) fail('нет ставки на 1-е число одного из месяцев');
const maxRate = Math.max(...firstRates);

const api = {
  fetchedAt: new Date().toISOString(),
  keyRate: { value: last.rate, since },
  nextMeeting: await nextMeeting(),
  taxFree: { year, maxRate, limitRub: Math.round((TAX_FREE_BASE_RUB * maxRate) / 100), final: curMonth === 12 },
};

let facts = api;
if (existsSync(overridePath)) {
  const override = JSON.parse(readFileSync(overridePath, 'utf-8'));
  const ov = override.keyRate;
  if (ov && !(ov.value >= 3 && ov.value <= 30)) fail(`override: ставка ${ov.value} вне 3–30%`);
  if (ov && api.keyRate.since >= ov.since) {
    console.warn(`sync-cbr: API уже отдаёт ставку с ${api.keyRate.since}, override игнорирую. Удалите ${overridePath}`);
  } else {
    facts = { ...api, ...override, override: true };
    console.warn(`sync-cbr: применён override ${JSON.stringify(override)}`);
  }
}

const tmp = `${dst}.tmp`;
writeFileSync(tmp, JSON.stringify(facts, null, 2) + '\n', 'utf-8');
renameSync(tmp, dst);
console.log(`facts: ставка ${facts.keyRate.value}% с ${facts.keyRate.since}, заседание ${facts.nextMeeting}, ` +
  `лимит НДФЛ ${facts.taxFree.year}: ${facts.taxFree.limitRub} ₽ -> ${dst}`);
