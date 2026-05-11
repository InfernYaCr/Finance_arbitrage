// Analytics IDs and company info come from env vars or site config.
// Do not hardcode real IDs here.
const siteName = import.meta.env.PUBLIC_SITE_NAME ?? 'Тестовый SEO-проект';
const siteNameFull = import.meta.env.PUBLIC_SITE_NAME_FULL ?? `${siteName} — SEO-продвижение сайтов`;

export const siteConfig = {
  siteUrl: import.meta.env.SITE_URL ?? 'https://mosseo.expert',
  siteName,
  siteNameFull,
  siteDescription: 'Комплексное SEO-продвижение сайтов. Аудит, оптимизация, продвижение в Яндекс и Google.',

  // Set via environment variables; leave empty to disable in dev
  yandexMetricaId: import.meta.env.YANDEX_METRICA_ID ?? '',
  gtagId: import.meta.env.GTAG_ID ?? '',

  company: {
    name: siteName,
    legalName: siteName,
    url: 'https://mosseo.expert',
    phone: '',
    email: '',
    address: '',
    city: 'Москва',
    country: 'RU',
    foundingYear: '2018',
  },

  // Nav links
  nav: [
    { label: 'Услуги', path: '/seo-uslugi/' },
    { label: 'Портфолио', path: '/portfolio/' },
    { label: 'Блог', path: '/vse-o-seo-prodvizhenii/' },
    { label: 'FAQ', path: '/faq/' },
    { label: 'SEO-словарь', path: '/seo-wikipedia/' },
    { label: 'Контакты', path: '/kontakty/' },
  ],
} as const;
