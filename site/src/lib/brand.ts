import { siteConfig } from '../data/siteConfig';

const LATIN_LEGACY_BRAND = ['moss', 'eo'].join('');
const CYRILLIC_LEGACY_BRAND = '\u041c\u043e\u0441\u0441\u0435\u043e';
const LEGACY_BRAND_RE = new RegExp(`\\b${LATIN_LEGACY_BRAND}\\b|${CYRILLIC_LEGACY_BRAND}`, 'gi');

export function replaceLegacyBrand(value: string): string {
  if (!value) return value;
  return value.replace(LEGACY_BRAND_RE, siteConfig.siteName);
}

export function stripBrandSuffix(value: string): string {
  const escapedCurrentBrand = siteConfig.siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffixRe = new RegExp(`[\\s\\-|]+(?:${CYRILLIC_LEGACY_BRAND}|${LATIN_LEGACY_BRAND}|${escapedCurrentBrand})\\s*$`, 'i');
  return replaceLegacyBrand(value)
    .replace(suffixRe, '')
    .replace(/\s+от\s*$/i, '')
    .trim();
}
