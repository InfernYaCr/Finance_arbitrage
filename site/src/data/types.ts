export interface ManifestPage {
  id: string;
  path: string;
  url: string;
  section: string;
  title: string;
  description: string;
  h1: string;
  severity: 'ok' | 'info' | 'warning' | 'error';
  issue_codes: string[];
  page_file: string;
}

export interface PageSeed {
  source_url: string;
  url: string;
  path: string;
  section: string;
  depth: number;
  title: string;
  meta_description: string;
  h1: string;
  h2: string[];
  csv_line: number;
}

export interface PageMeta {
  html_title: string;
  html_meta_description: string;
  canonical: string;
  body_class: string[];
}

export interface PageWp {
  id: number;
  type: string;
  slug: string;
  date: string;
  modified: string;
  link: string;
  featured_media: number;
  categories: number[];
  tags: number[];
}

export interface PageQuality {
  content_text_chars: number;
  links_count: number;
  images_count: number;
  has_csv_title: boolean;
  has_csv_h1: boolean;
}

export interface ExtractedData {
  page_type?: string;
  services?: unknown[];
  faq_pairs?: Array<{ question?: string; answer?: string; q?: string; a?: string }>;
  pricing_tiers?: unknown[];
  case_results?: unknown[];
  key_points?: string[];
  cta_text?: string;
}

export interface PageData {
  id: string;
  seed: PageSeed;
  fetch: Record<string, unknown>;
  meta: PageMeta;
  wp: PageWp | null;
  wp_title: string;
  excerpt_html: string;
  excerpt_text: string;
  content_html: string;
  content_text: string;
  links: Array<{ href: string; text: string }>;
  images: Array<{ src: string; alt: string }>;
  quality: PageQuality;
  extracted?: ExtractedData;
}

export interface FullPage extends ManifestPage {
  data: PageData;
}

export type PageType =
  | 'home'
  | 'article'
  | 'archive'
  | 'faq'
  | 'portfolio_archive'
  | 'portfolio_case'
  | 'service'
  | 'dictionary_archive'
  | 'dictionary_article'
  | 'contact'
  | 'company'
  | 'content_page';

export interface SeoFields {
  title: string;
  description: string;
  h1: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogType: 'website' | 'article';
  datePublished?: string;
  dateModified?: string;
  breadcrumbs: Array<{ label: string; path: string }>;
}
