// Analytics IDs and company info come from env vars or site config.
// Do not hardcode real IDs here.
const siteName = import.meta.env.PUBLIC_SITE_NAME ?? 'Тестовый SEO-проект';
const siteNameFull = import.meta.env.PUBLIC_SITE_NAME_FULL ?? `${siteName} — SEO-продвижение сайтов`;
const companyPhone = import.meta.env.PUBLIC_COMPANY_PHONE ?? '+7 000 000-00-00';
const companyPhoneHref = import.meta.env.PUBLIC_COMPANY_PHONE_HREF ?? '+70000000000';
const companyEmail = import.meta.env.PUBLIC_COMPANY_EMAIL ?? 'hello@example.test';
const companyAddress = import.meta.env.PUBLIC_COMPANY_ADDRESS ?? 'Адрес уточняется';
const companyWorktime = import.meta.env.PUBLIC_COMPANY_WORKTIME ?? 'Пн-Пт, 09:30-18:30';

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
    legalName: import.meta.env.PUBLIC_COMPANY_LEGAL_NAME ?? `ООО «${siteName}»`,
    url: import.meta.env.SITE_URL ?? 'https://mosseo.expert',
    phone: companyPhone,
    phoneHref: companyPhoneHref,
    email: companyEmail,
    address: companyAddress,
    city: 'Москва',
    country: 'RU',
    worktime: companyWorktime,
    foundingYear: import.meta.env.PUBLIC_COMPANY_FOUNDING_YEAR ?? '2018',
    inn: import.meta.env.PUBLIC_COMPANY_INN ?? '0000000000',
    kpp: import.meta.env.PUBLIC_COMPANY_KPP ?? '000000000',
    ogrn: import.meta.env.PUBLIC_COMPANY_OGRN ?? '0000000000000',
    bank: import.meta.env.PUBLIC_COMPANY_BANK ?? 'Банк уточняется',
    bik: import.meta.env.PUBLIC_COMPANY_BIK ?? '000000000',
    account: import.meta.env.PUBLIC_COMPANY_ACCOUNT ?? '00000000000000000000',
    correspondentAccount: import.meta.env.PUBLIC_COMPANY_CORRESPONDENT_ACCOUNT ?? '00000000000000000000',
  },

  legacyContent: {
    // placeholder: hide old Mosseo media; source: load from mosseo.ru; local: use copied /content and /wp-content files.
    mediaMode: import.meta.env.PUBLIC_LEGACY_MEDIA_MODE ?? 'placeholder',
    mediaPlaceholder: import.meta.env.PUBLIC_MEDIA_PLACEHOLDER ?? '/images/placeholder.svg',
    sourceDomain: 'https://mosseo.ru',
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
