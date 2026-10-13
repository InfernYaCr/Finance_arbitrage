/** Всё, что меняется при смене бренда/домена, живёт здесь. */
export const SITE = {
  name: 'ФинКомпас',
  tagline: 'Подбор займов, карт и кредитов онлайн',
  domain: 'rencredit-online.ru',
  email: 'info@rencredit-online.ru',
  /** Реквизиты владельца сайта. Пустые поля в футере не выводятся. */
  legal: {
    owner: '',
    inn: '',
    ogrn: '',
    address: '',
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
export const RESERVED_SLUGS = ['zaimy', 'karty', 'kredity', 'stati', 'novosti', 'mfo', 'go', 'o-proekte', 'politika-konfidencialnosti', 'search.json', '404'];

export const CATEGORY_LABELS: Record<string, string> = {
  zaimy: 'Займы',
  kredity: 'Кредиты',
  karty: 'Карты',
  refinansirovanie: 'Рефинансирование',
  'kreditnaya-istoriya': 'Кредитная история',
  fingramotnost: 'Финансовая грамотность',
};
