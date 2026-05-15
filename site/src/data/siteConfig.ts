// Analytics IDs and company info come from env vars or site config.
// Do not hardcode real IDs here.
const siteUrl = import.meta.env.SITE_URL ?? 'https://example.test';
const siteName = import.meta.env.PUBLIC_SITE_NAME ?? 'Тестовый SEO-проект';
const siteNameFull = import.meta.env.PUBLIC_SITE_NAME_FULL ?? `${siteName} — SEO-продвижение сайтов`;
const companyPhone = import.meta.env.PUBLIC_COMPANY_PHONE ?? '+7 000 000-00-00';
const companyPhoneHref = import.meta.env.PUBLIC_COMPANY_PHONE_HREF ?? '+70000000000';
const companyPhoneLabel = import.meta.env.PUBLIC_COMPANY_PHONE_LABEL ?? 'звонок по РФ бесплатный';
const companyPhone2 = import.meta.env.PUBLIC_COMPANY_PHONE2 ?? '';
const companyPhone2Href = import.meta.env.PUBLIC_COMPANY_PHONE2_HREF ?? '';
const companyPhone2Label = import.meta.env.PUBLIC_COMPANY_PHONE2_LABEL ?? 'для звонков из Москвы';
const companyEmail = import.meta.env.PUBLIC_COMPANY_EMAIL ?? 'hello@example.test';
const companyAddress = import.meta.env.PUBLIC_COMPANY_ADDRESS ?? 'Адрес уточняется';
const companyWorktime = import.meta.env.PUBLIC_COMPANY_WORKTIME ?? 'Пн-Пт, 09:30-18:30';
const companyTelegram = import.meta.env.PUBLIC_COMPANY_TELEGRAM ?? '';
const contactFormAction = import.meta.env.PUBLIC_CONTACT_FORM_ACTION ?? '/mail.php';
const contactFormRedirect = import.meta.env.PUBLIC_CONTACT_FORM_REDIRECT ?? `${siteUrl.replace(/\/$/, '')}/thanks/`;
const contactFormSubject = import.meta.env.PUBLIC_CONTACT_FORM_SUBJECT ?? `Заявка с сайта ${siteName}`;
const legacyBrandAliases = (import.meta.env.PUBLIC_LEGACY_BRAND_ALIASES ?? '')
  .split(',')
  .map((alias: string) => alias.trim())
  .filter(Boolean);

export const siteConfig = {
  siteUrl,
  siteName,
  siteNameFull,
  siteDescription: import.meta.env.PUBLIC_SITE_DESCRIPTION ?? siteNameFull,

  // Set via environment variables; leave empty to disable in dev
  yandexMetricaId: import.meta.env.PUBLIC_METRIKA_ID ?? import.meta.env.YANDEX_METRICA_ID ?? '',
  gtagId: import.meta.env.GTAG_ID ?? '',

  company: {
    name: siteName,
    legalName: import.meta.env.PUBLIC_COMPANY_LEGAL_NAME ?? `ООО «${siteName}»`,
    url: siteUrl,
    phone: companyPhone,
    phoneHref: companyPhoneHref,
    phoneLabel: companyPhoneLabel,
    phone2: companyPhone2,
    phone2Href: companyPhone2Href,
    phone2Label: companyPhone2Label,
    telegram: companyTelegram,
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
    // placeholder: hide old donor media; source: load from the original donor; local: use copied /content and /wp-content files.
    mediaMode: import.meta.env.PUBLIC_LEGACY_MEDIA_MODE ?? 'placeholder',
    mediaPlaceholder: import.meta.env.PUBLIC_MEDIA_PLACEHOLDER ?? '/images/placeholder.svg',
    sourceDomain: import.meta.env.PUBLIC_LEGACY_SOURCE_DOMAIN ?? `https://${['moss', 'eo.ru'].join('')}`,
    brandAliases: legacyBrandAliases,
  },

  social: {
    vk: import.meta.env.PUBLIC_SOCIAL_VK ?? '',
    telegram: import.meta.env.PUBLIC_SOCIAL_TG ?? '',
    ok: import.meta.env.PUBLIC_SOCIAL_OK ?? '',
  },

  contactForm: {
    action: contactFormAction,
    redirect: contactFormRedirect,
    subject: contactFormSubject,
  },

  contactPath: import.meta.env.PUBLIC_CONTACT_PATH ?? '/kontakty/',

  siteStats: (import.meta.env.PUBLIC_SITE_STATS ?? '')
    .split('|')
    .map((s: string) => s.trim())
    .filter(Boolean),

  niche: {
    ctaQuestion:  import.meta.env.PUBLIC_NICHE_CTA_QUESTION  ?? 'Есть вопросы?',
    ctaBtn:       import.meta.env.PUBLIC_NICHE_CTA_BTN       ?? 'Задать вопрос',
    sidebarTitle: import.meta.env.PUBLIC_NICHE_SIDEBAR_TITLE ?? 'Нужна помощь?',
    sidebarDesc:  import.meta.env.PUBLIC_NICHE_SIDEBAR_DESC  ?? 'Свяжитесь с нами.',
    sidebarBtn:   import.meta.env.PUBLIC_NICHE_SIDEBAR_BTN   ?? 'Получить консультацию',
  },

  sectionLabels: (() => {
    try {
      return JSON.parse(import.meta.env.PUBLIC_SECTION_LABELS ?? '{}') as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  })(),

} as const;
