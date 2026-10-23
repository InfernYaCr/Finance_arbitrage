import type { OrgInfo, ProductKind } from '@pbn/core';

const env = import.meta.env;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const noindex = str(env.PUBLIC_NOINDEX) === 'true';

/**
 * Прод-режимы из переменных окружения (см. .env.example). Читаются на этапе сборки.
 * Ничего не выдумываем: пустая переменная = блок на сайте не выводится.
 */
export const ENV = {
  /** true -> meta robots noindex,nofollow везде и robots.txt «Disallow: /» (тестовый поддомен). */
  noindex,
  /** Номер счётчика Яндекс Метрики (цифры). Пусто или noindex (тестовый поддомен) -> счётчик не вставляется. */
  metrikaId: !noindex && /^\d+$/.test(str(env.PUBLIC_METRIKA_ID)) ? str(env.PUBLIC_METRIKA_ID) : '',
  yandexVerification: str(env.PUBLIC_YANDEX_VERIFICATION),
  googleVerification: str(env.PUBLIC_GOOGLE_VERIFICATION),
} as const;

/** Всё, что меняется при смене бренда/домена, живёт здесь. */
export const SITE = {
  name: 'Мерка',
  tagline: 'Займы, карты и кредиты — по вашей мерке',
  /** Короткое пояснение (og, manifest): сайт сравнивает, а не выдаёт. */
  descriptor: 'Сравниваем займы, карты и кредиты — не выдаём',
  domain: 'rencredit-online.ru',
  /** Почта для связи: PUBLIC_CONTACT_EMAIL. Пусто -> ссылки на почту не выводятся. */
  email: str(env.PUBLIC_CONTACT_EMAIL),
  /** Реквизиты владельца сайта. Пустые поля в футере не выводятся. */
  legal: {
    owner: str(env.PUBLIC_LEGAL_OWNER),
    inn: str(env.PUBLIC_LEGAL_INN),
    ogrn: str(env.PUBLIC_LEGAL_OGRN),
    address: str(env.PUBLIC_LEGAL_ADDRESS),
  },
  disclaimer:
    'Сайт не является сайтом банка или МФО, не даёт вход в личный кабинет и не принимает платежи, не выдаёт займы и не принимает заявки на их выдачу. Это информационный агрегатор: мы сравниваем публичные условия организаций из реестра Банка России. Окончательные условия определяет кредитор — проверяйте их на его сайте до подписания договора.',
  /**
   * Яндекс «Мимикрия»: связь с оригиналом — в шапке; в description — в конце, чтобы не мешать SEO-части.
   * Плашка над шапкой на всех страницах — единственное место с названием банка вне /o-proekte/, политики и 404.
   */
  notice: 'Привет! «Мерка» — независимый сервис сравнения, не связан с банком «Ренессанс Кредит». Личного кабинета здесь нет.',
  descriptionSuffix: 'Мерка — независимый агрегатор, не банк.',
  /** Полный дисклеймер о непринадлежности банку (SEO_PLAN §2.3): /o-proekte/, политика и 404. */
  notBank:'Сайт не является сайтом КБ «Ренессанс Кредит» (ООО), не связан с банком, не даёт вход в личный кабинет и не принимает платежи.',
  risk:
    'Заём — это ответственность. Чрезмерная задолженность может привести к потере платёжеспособности и ухудшению кредитной истории. Максимальная переплата по договору потребительского займа ограничена законом.',
} as const;

/** Автор статей и новостей в JSON-LD (Organization). */
export const EDITORIAL = 'Редакция Мерки';

/** Организация для JSON-LD (@pbn/core): реквизиты и почта — только из env, пустые не выводятся. */
const home = new URL('/', env.SITE).href;
export const ORG: OrgInfo = {
  name: SITE.name,
  url: home,
  logo: new URL('/icon-512.png', home).href,
  email: SITE.email,
  legalName: SITE.legal.owner,
  taxID: SITE.legal.inn,
  publishingPrinciples: new URL('/redakcionnaya-politika/', home).href,
};

interface NavItem { label: string; href?: string; sub?: { label: string; href: string }[] }

/**
 * Шапка. Пункты с sub — выпадающее меню (на мобиле — <details>). У «Займы» подменю — подборки (guides),
 * его добавляет Header. Пункт без href («Ещё») — только раскрывашка.
 */
export const NAV: NavItem[] = [
  { label: 'Займы', href: '/zaimy/' },
  { label: 'Карты', href: '/karty/', sub: [
    { label: 'Кредитные карты', href: '/karty/' },
    { label: 'Дебетовые карты', href: '/debetovye-karty/' },
  ] },
  { label: 'Кредиты', href: '/kredity/', sub: [
    { label: 'Все кредиты', href: '/kredity/' },
    { label: 'Рефинансирование', href: '/refinansirovanie/' },
  ] },
  { label: 'Страхование', href: '/strahovanie/', sub: [
    { label: 'Всё страхование', href: '/strahovanie/' },
    { label: 'ОСАГО', href: '/osago/' },
    { label: 'КАСКО', href: '/kasko/' },
    { label: 'Страхование ипотеки', href: '/strahovanie-ipoteki/' },
    { label: 'Путешествия', href: '/strahovanie-puteshestvennikov/' },
    { label: 'Квартира', href: '/strahovanie-kvartiry/' },
  ] },
  { label: 'Ещё', sub: [
    { label: 'Вклады', href: '/vklady/' },
    { label: 'РКО для бизнеса', href: '/rko/' },
    { label: 'Статьи', href: '/stati/' },
    { label: 'Новости', href: '/novosti/' },
  ] },
];

/** Страницы, на которые нельзя занимать slug посадочных (guides). */
export const RESERVED_SLUGS = ['zaimy', 'karty', 'kredity', 'stati', 'novosti', 'mfo', 'go', 'o-proekte', 'politika-konfidencialnosti', 'search.json', 'robots.txt', 'credit', 'refinansirovanie', 'og', '404',
  'strahovanie', 'osago', 'kasko', 'strahovanie-ipoteki', 'strahovanie-puteshestvennikov', 'strahovanie-kvartiry',
  'strahovanie-drugoe', 'debetovye-karty', 'vklady', 'rko'];

export const CATEGORY_LABELS: Record<string, string> = {
  zaimy: 'Займы',
  kredity: 'Кредиты',
  karty: 'Карты',
  refinansirovanie: 'Рефинансирование',
  'kreditnaya-istoriya': 'Кредитная история',
  fingramotnost: 'Финансовая грамотность',
};

interface Hub { label: string; href: string; /** id подборки-кластера (content/guides); в крошках, только если она есть и индексируется. */ cluster?: string }

/** Хаб L1 по виду продукта — подписи совпадают с H1/меню хабов. */
export const KIND_HUB: Record<ProductKind, Hub> = {
  mfo: { label: 'Займы', href: '/zaimy/' },
  card: { label: 'Кредитные карты', href: '/karty/' },
  credit: { label: 'Кредиты', href: '/kredity/' },
};

/**
 * Логический родитель статьи (SEO-18, 03-architecture §2–3): рубрика -> хаб и кластер. Задаёт крошки
 * «Главная › хаб › кластер › статья». Рубрики без записи (fingramotnost) — хаб по виду продукта статьи.
 */
export const CATEGORY_HUB: Record<string, Hub> = {
  zaimy: KIND_HUB.mfo,
  'kreditnaya-istoriya': KIND_HUB.mfo,
  kredity: KIND_HUB.credit,
  refinansirovanie: { label: 'Рефинансирование', href: '/refinansirovanie/' },
  karty: KIND_HUB.card,
};
