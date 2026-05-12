export interface NavDropdownItem {
  label: string;
  sublabel?: string;
  href: string;
  badge?: string;
}

export interface NavColumn {
  title?: string;
  items: NavDropdownItem[];
}

export interface NavItem {
  label: string;
  href: string;
  columns?: NavColumn[];
}

export const navItems: NavItem[] = [
  {
    label: 'Главная',
    href: '/',
  },
  {
    label: 'О компании',
    href: '/o-kompanii/',
    columns: [
      {
        items: [
          { label: 'Пару слов о компании', sublabel: 'Информация о SEO компании', href: '/o-kompanii/' },
          { label: 'Как мы работаем', sublabel: 'Этапы SEO продвижения', href: '/optimizaciya/kak-my-rabotaem/' },
          { label: 'Наши работы', sublabel: 'Последние кейсы', href: '/portfolio/' },
          { label: 'Отзывы', sublabel: 'Официальные письма', href: '/otzyvy/' },
          { label: 'Гарантии продвижения', sublabel: 'Трафик или позиции', href: '/o-kompanii/garantii/' },
          { label: 'Философия компании', sublabel: 'Принципы работы', href: '/o-kompanii/filosofiya/' },
        ],
      },
      {
        items: [
          { label: 'Вопросы и ответы', sublabel: 'Все о SEO', href: '/faq/' },
          { label: 'Новости', sublabel: 'Что нового в SEO', href: '/vse-o-seo-prodvizhenii/seo-novosti/' },
          { label: 'Условия сотрудничества', sublabel: 'Индивидуальные решения', href: '/o-kompanii/usloviya-sotrudnichestva/' },
          { label: 'Реквизиты', sublabel: 'Данные для договоров', href: '/o-kompanii/' },
          { label: 'Коммерческое предложение', sublabel: 'Цены, сроки', href: '/o-kompanii/kommercheskie-predlozheniya/' },
          { label: 'Партнёрство компании', sublabel: 'Взаимовыручка', href: '/o-kompanii/partnyory/' },
        ],
      },
    ],
  },
  {
    label: 'Услуги',
    href: '/seo-uslugi/',
    columns: [
      {
        title: 'Продвижение в поиске',
        items: [
          { label: 'Продвижение сайта в Яндекс', href: '/seo-prodvizhenie-sajta/osobennosti-prodvizheniya-sajta-v-yandekse/' },
          { label: 'Продвижение сайта в Google', href: '/seo-prodvizhenie-sajta/osobennosti-prodvizheniya-sajta-v-google/' },
          { label: 'Продвижение по позициям', href: '/seo-prodvizhenie-sajta/prodvizhenie-po-poziciyam/' },
          { label: 'Продвижение по трафику', href: '/seo-prodvizhenie-sajta/prodvizhenie-po-trafiku/' },
          { label: 'Комплексное продвижение', href: '/seo-prodvizhenie-sajta/brainstorm-seo-tehnologiya-prodvizheniya-sajtov/' },
        ],
      },
      {
        title: 'Реклама в интернете',
        items: [
          { label: 'Контекстная реклама Яндекс', href: '/kontekstnaya-reklama/stoimost-kontekstnoy-reklami/kontekstnaya-reklama-yandeks-direkt/' },
          { label: 'Контекстная реклама Google', href: '/kontekstnaya-reklama/stoimost-kontekstnoy-reklami/kontekstnaya-reklama-google-adwords/' },
          { label: 'Настройка контекстной рекламы', href: '/kontekstnaya-reklama/stoimost-kontekstnoy-reklami/nastrojka-kontekstnoj-reklamy/' },
          { label: 'Продвижение на картах', href: '/kontekstnaya-reklama/' },
          { label: 'Виджеты для сайта', href: '/uslugi/vidzhet-whatsapp-na-sajt-generaciya-koda-i-ustanovka/' },
          { label: 'Управление репутацией', href: '/kontekstnaya-reklama/upravlenie-reputaciej-v-internete/' },
          { label: 'Продвижение на маркетплейсах', href: '/kontekstnaya-reklama/reklama-v-socialnyh-setyah/' },
        ],
      },
      {
        title: 'Консультации',
        items: [
          { label: 'SEO аудит сайта', href: '/konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta/audit-veb-sajta/' },
          { label: 'Технический аудит сайта', href: '/konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta/tehnicheskij-audit-i-analiz-sajta/' },
          { label: 'SEO анализ сайта', href: '/konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta/obshchij-seo-analiz-sajta/' },
          { label: 'Работа с ПФ сайта', href: '/konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta/sravnitelnyj-analiz-konkurentov/', badge: 'New' },
          { label: 'SEO контроль сайта', href: '/konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta/seo-kontrol-sajta/' },
        ],
      },
      {
        title: 'Помощь при выборе',
        items: [
          { label: 'Что входит в SEO раскрутку', href: '/stoimost-uslug/chto-vhodit-v-stoimost-prodvizheniya-sajta/' },
          { label: 'Как мы работаем', href: '/optimizaciya/kak-my-rabotaem/' },
          { label: 'Как заказать SEO сайта', href: '/stoimost-uslug/kak-zakazat-uslugu/' },
          { label: 'Как выбрать SEO компанию', href: '/vse-o-seo-prodvizhenii/seo-stati/kak-vybrat-seo-kompaniju-po-prodvizheniju-sajta/' },
          { label: 'SEO по тематикам', href: '/seo-po-tematikam/' },
        ],
      },
    ],
  },
  {
    label: 'Стоимость',
    href: '/stoimost-uslug/',
    columns: [
      {
        items: [
          { label: 'Тариф SEO Region', href: '/stoimost-uslug/tarif-seo-region/' },
          { label: 'Тариф SEO Standart', href: '/stoimost-uslug/tarif-seo-standart/' },
          { label: 'Тариф SEO Plus', href: '/stoimost-uslug/tarif-seo-plus/' },
          { label: 'Тариф SEO Expert', href: '/stoimost-uslug/tarif-seo-expert/' },
          { label: 'Сравнить тарифы', href: '/stoimost-uslug/' },
          { label: 'Ценообразование в SEO', href: '/stoimost-uslug/' },
        ],
      },
    ],
  },
  {
    label: 'SEO Блог',
    href: '/vse-o-seo-prodvizhenii/',
    columns: [
      {
        items: [
          { label: 'SEO блог', href: '/vse-o-seo-prodvizhenii/seo-blog/' },
          { label: 'SEO статьи', href: '/vse-o-seo-prodvizhenii/seo-stati/' },
          { label: 'SEO новости', href: '/vse-o-seo-prodvizhenii/seo-novosti/' },
        ],
      },
    ],
  },
  {
    label: 'SEO — Wikipedia',
    href: '/seo-wikipedia/',
    columns: [
      {
        items: [
          { label: 'Оптимизация сайта', href: '/optimizaciya/' },
          { label: 'Виды сайтов', href: '/vidy-tipy-sajtov-i-ih-klassifikaciya/' },
          { label: 'Поисковые системы', href: '/poiskovye-sistemy/' },
          { label: 'Рейтинг SEO', href: '/rejting-seo/' },
        ],
      },
    ],
  },
  {
    label: 'Самостоятельное SEO',
    href: '/prodvizhenie-sajta-samostoyatelno/',
  },
  {
    label: 'Контакты',
    href: '/kontakty/',
  },
];
