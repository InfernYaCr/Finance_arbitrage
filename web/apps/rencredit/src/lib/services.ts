import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { SERVICE_CATEGORIES } from '../content.config';

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
export type ServiceKind = 'insurance' | 'debit' | 'deposit' | 'rko';
export type Service = CollectionEntry<'services'>['data'] & { slug: string };

interface CategoryMeta {
  kind: ServiceKind;
  /** Короткое имя для навигации, плиток и крошек. */
  label: string;
  /** Адрес посадочной; null — категория показывается только на хабе /strahovanie/. */
  href: string | null;
  /** Фолбэк H1/description/lead, если нет src/content/service-pages/<category>.mdx. */
  h1: string;
  description: string;
  lead: string;
}

export const SERVICE_META: Record<ServiceCategory, CategoryMeta> = {
  osago: {
    kind: 'insurance', label: 'ОСАГО', href: '/osago/', h1: 'ОСАГО онлайн: сравнение сервисов и страховщиков',
    description: 'Где оформить электронный полис ОСАГО: сервисы сравнения и страховые компании, условия оформления онлайн.',
    lead: 'Электронный полис ОСАГО оформляется на сайте страховщика или через сервис сравнения — без визита в офис.',
  },
  kasko: {
    kind: 'insurance', label: 'КАСКО', href: '/kasko/', h1: 'КАСКО: где оформить полис онлайн',
    description: 'Сравните, где оформить КАСКО онлайн: страховые компании и сервисы, что входит в полис и как его купить.',
    lead: 'КАСКО добровольное: покрытие, франшизу и цену каждая компания считает по-своему — сравните до покупки.',
  },
  'strahovanie-ipoteki': {
    kind: 'insurance', label: 'Страхование ипотеки', href: '/strahovanie-ipoteki/', h1: 'Страхование ипотеки онлайн',
    description: 'Страхование квартиры, жизни и титула для ипотеки: где оформить или продлить полис онлайн и что проверить.',
    lead: 'Полис для ипотеки можно купить не только в банке-кредиторе — главное, чтобы страховщик соответствовал требованиям банка.',
  },
  'strahovanie-puteshestvennikov': {
    kind: 'insurance', label: 'Страхование путешественников', href: '/strahovanie-puteshestvennikov/', h1: 'Страхование путешественников',
    description: 'Медицинская страховка для поездок за рубеж и отмена поездки: где оформить полис онлайн и на что смотреть.',
    lead: 'Полис для поездки оформляется онлайн за несколько минут — проверьте страну, сумму покрытия и исключения.',
  },
  'strahovanie-kvartiry': {
    kind: 'insurance', label: 'Страхование квартиры', href: '/strahovanie-kvartiry/', h1: 'Страхование квартиры онлайн',
    description: 'Страхование квартиры от залива, пожара и других рисков: где оформить полис онлайн и что в него входит.',
    lead: 'Полис защищает отделку, имущество и ответственность перед соседями — состав рисков отличается у разных страховщиков.',
  },
  'strahovanie-drugoe': {
    kind: 'insurance', label: 'Другое страхование', href: null, h1: 'Другое страхование', description: '', lead: '',
  },
  'debetovye-karty': {
    kind: 'debit', label: 'Дебетовые карты', href: '/debetovye-karty/', h1: 'Дебетовые карты: сравнение условий',
    description: 'Сравните дебетовые карты банков: стоимость обслуживания, кешбэк, процент на остаток и условия выпуска.',
    lead: 'Стоимость обслуживания, кешбэк и процент на остаток — сравните условия банков в одном списке.',
  },
  vklady: {
    kind: 'deposit', label: 'Вклады', href: '/vklady/', h1: 'Вклады: сравнение ставок',
    description: 'Сравните вклады банков: ставка, срок, пополнение и снятие. Вклады в банках РФ застрахованы АСВ.',
    lead: 'Ставка, срок и возможность пополнения — сравните вклады банков. Вклады физлиц застрахованы АСВ в пределах лимита.',
  },
  rko: {
    kind: 'rko', label: 'РКО для бизнеса', href: '/rko/', h1: 'Расчётный счёт для ИП и ООО',
    description: 'Сравните тарифы РКО: стоимость обслуживания расчётного счёта, платежи, снятие наличных, открытие онлайн.',
    lead: 'Стоимость обслуживания, лимиты на платежи и снятие наличных — сравните тарифы банков для ИП и ООО.',
  },
};

export const INSURANCE_CATEGORIES = SERVICE_CATEGORIES.filter((c) => SERVICE_META[c].kind === 'insurance');
/** Посадочные некредитных разделов (для навигации, перелинковки, главной). */
export const SERVICE_LINKS = SERVICE_CATEGORIES.filter((c) => SERVICE_META[c].href).map((c) => ({ category: c, label: SERVICE_META[c].label, href: SERVICE_META[c].href! }));

const prio = (a: Service, b: Service) => b.priority - a.priority || a.name.localeCompare(b.name, 'ru');
/** Нет значения — в конец списка. */
const by = (pick: (s: Service) => number | undefined, dir: 1 | -1) => (a: Service, b: Service) => {
  const x = pick(a), y = pick(b);
  if (x == null || y == null) return x == null && y == null ? prio(a, b) : x == null ? 1 : -1;
  return (x - y) * dir || prio(a, b);
};
const SORT: Record<ServiceKind, (a: Service, b: Service) => number> = {
  insurance: prio,
  deposit: by((s) => s.ratePct, -1),
  debit: by((s) => s.priceFrom, 1),
  rko: by((s) => s.priceFrom, 1),
};

export async function getServices(filter: { kind?: ServiceKind; category?: ServiceCategory } = {}): Promise<Service[]> {
  const all = (await getCollection('services')).map((e) => ({ slug: e.id, ...e.data }));
  const list = all.filter((s) => (!filter.kind || s.kind === filter.kind) && (!filter.category || s.category === filter.category));
  const kind = filter.kind ?? (filter.category && SERVICE_META[filter.category].kind);
  return list.sort(kind ? SORT[kind] : prio);
}

/** SEO-текст посадочной (id = category или 'strahovanie' для хаба); undefined — используем фолбэк. */
export const getServicePage = (id: string) => getEntry('servicePages', id);

/** schema.org-тип элемента ItemList. */
export const SCHEMA_TYPE: Record<ServiceKind, string> = { insurance: 'FinancialProduct', debit: 'PaymentCard', deposit: 'DepositAccount', rko: 'BankAccount' };
/** Брокерский счёт лежит в разделе вкладов, но это не DepositAccount. */
const SCHEMA_OVERRIDE: Record<string, string> = { 'bks-investitsii': 'BrokerageAccount' };
export const schemaType = (s: Pick<Service, 'slug' | 'kind'>) => SCHEMA_OVERRIDE[s.slug] ?? SCHEMA_TYPE[s.kind];

/** Официальный сайт организации из src/data/service-sources/<slug>.json. */
const sources = import.meta.glob<{ officialUrl?: string }>('../data/service-sources/*.json', { eager: true, import: 'default' });
export const serviceOfficialUrl = (slug: string): string | undefined => sources[`../data/service-sources/${slug}.json`]?.officialUrl;
