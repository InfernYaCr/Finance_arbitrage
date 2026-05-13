import type { PageType } from '../data/types';

const SERVICE_SECTIONS = new Set([
  'seo-uslugi',
  'uslugi',
  'stoimost-uslug',
  'tarify-seo',
  'konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta',
  'seo-prodvizhenie-sajta',
  'kontekstnaya-reklama',
  'zakazat-kompleksnoe-prodvizhenie-sajta',
]);

const ARCHIVE_PATHS = new Set([
  '/vse-o-seo-prodvizhenii/',
  '/seo-wikipedia/',
  '/portfolio/',
  '/faq/',
  '/novosti/',
  '/otzyvy/',
  '/photogallery/',
  '/seo-po-tematikam/',
  '/na-ponyatnom-yazyke/',
  '/optimizaciya/',
  '/vidy-tipy-sajtov-i-ih-klassifikaciya/',
  '/poiskovye-sistemy/',
]);

export function getPageType(
  path: string,
  section: string,
  hints: { hasChildren: boolean; contactPath: string } = { hasChildren: false, contactPath: '/kontakty/' },
): PageType {
  if (path === '/') return 'home';

  // Per-site contact page (from site.config.json)
  if (path === hints.contactPath) return 'contact';
  // Legacy mosseo fallback
  if (path === '/kontakty/') return 'contact';

  if (section === 'o-kompanii') return 'company';

  if (path === '/portfolio/') return 'portfolio_archive';
  if (section === 'portfolio' || section === 'case') return 'portfolio_case';

  if (path === '/seo-wikipedia/') return 'dictionary_archive';
  if (section === 'seo-wikipedia') return 'dictionary_article';

  if (path === '/faq/') return 'archive';
  if (section === 'faq') return 'faq';

  if (SERVICE_SECTIONS.has(section)) {
    const depth = path.replace(/^\/|\/$/g, '').split('/').length;
    return depth === 1 ? 'archive' : 'service';
  }

  if (ARCHIVE_PATHS.has(path)) return 'archive';

  // Universal structural fallback: page with children → archive
  if (hints.hasChildren) return 'archive';

  return 'article';
}

// Convert a URL path to Astro slug param (strips leading/trailing slashes)
export function pathToSlug(path: string): string | undefined {
  const clean = path.replace(/^\/|\/$/g, '');
  return clean || undefined;
}

// Build breadcrumb trail from path
export function buildBreadcrumbs(
  path: string,
  pageTitle: string,
): Array<{ label: string; path: string }> {
  const SECTION_LABELS: Record<string, string> = {
    'vse-o-seo-prodvizhenii': 'Блог',
    'seo-wikipedia': 'SEO-словарь',
    'seo-uslugi': 'Услуги',
    'uslugi': 'Услуги',
    'portfolio': 'Портфолио',
    'faq': 'FAQ',
    'o-kompanii': 'О компании',
    'kontakty': 'Контакты',
    'seo-prodvizhenie-sajta': 'SEO-продвижение',
    'na-ponyatnom-yazyke': 'На понятном языке',
    'konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta': 'Консультации',
    'optimizaciya': 'Оптимизация',
    'vidy-tipy-sajtov-i-ih-klassifikaciya': 'Виды сайтов',
    'poiskovye-sistemy': 'Поисковые системы',
    'seo-po-tematikam': 'SEO по тематикам',
    'stoimost-uslug': 'Стоимость услуг',
    'tarify-seo': 'Тарифы',
    'kontekstnaya-reklama': 'Контекстная реклама',
    'novosti': 'Новости',
    'otzyvy': 'Отзывы',
  };

  const crumbs: Array<{ label: string; path: string }> = [
    { label: 'Главная', path: '/' },
  ];

  const segments = path.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    const segPath = '/' + segments.slice(0, i + 1).join('/') + '/';
    crumbs.push({ label: SECTION_LABELS[seg] ?? seg, path: segPath });
  }

  if (segments.length > 0) {
    crumbs.push({ label: pageTitle, path });
  }

  return crumbs;
}
