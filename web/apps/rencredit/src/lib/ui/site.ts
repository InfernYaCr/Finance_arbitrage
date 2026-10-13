const env = import.meta.env;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Прод-режимы из переменных окружения (см. .env.example). Читаются на этапе сборки.
 * Ничего не выдумываем: пустая переменная = блок на сайте не выводится.
 */
export const ENV = {
  /** true -> meta robots noindex,nofollow везде и robots.txt «Disallow: /» (тестовый поддомен). */
  noindex: str(env.PUBLIC_NOINDEX) === 'true',
  /** Номер счётчика Яндекс Метрики (цифры). Пусто -> счётчик не вставляется. */
  metrikaId: /^\d+$/.test(str(env.PUBLIC_METRIKA_ID)) ? str(env.PUBLIC_METRIKA_ID) : '',
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
    'Сайт не является сайтом банка или МФО, не выдаёт займы и не принимает заявки на их выдачу. Это информационный агрегатор: мы сравниваем публичные условия организаций из реестра Банка России. Окончательные условия определяет кредитор — проверяйте их на его сайте до подписания договора.',
  risk:
    'Заём — это ответственность. Чрезмерная задолженность может привести к потере платёжеспособности и ухудшению кредитной истории. Максимальная переплата по договору потребительского займа ограничена законом.',
} as const;

export const NAV = [
  { label: 'Займы', href: '/zaimy/' },
  { label: 'Карты', href: '/karty/' },
  { label: 'Кредиты', href: '/kredity/' },
  { label: 'Статьи', href: '/stati/' },
  { label: 'Новости', href: '/novosti/' },
] as const;

/** Страницы, на которые нельзя занимать slug посадочных (guides). */
export const RESERVED_SLUGS = ['zaimy', 'karty', 'kredity', 'stati', 'novosti', 'mfo', 'go', 'o-proekte', 'politika-konfidencialnosti', 'search.json', 'robots.txt', 'credit', 'og', '404'];

export const CATEGORY_LABELS: Record<string, string> = {
  zaimy: 'Займы',
  kredity: 'Кредиты',
  karty: 'Карты',
  refinansirovanie: 'Рефинансирование',
  'kreditnaya-istoriya': 'Кредитная история',
  fingramotnost: 'Финансовая грамотность',
};
