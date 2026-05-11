import { siteConfig } from '../data/siteConfig';

const LEGACY_BRAND_RE = /\bMOSSEO\b|\bMosseo\b|МОССЕО|Моссео/g;

export function replaceLegacyBrand(value: string): string {
  if (!value) return value;
  return value.replace(LEGACY_BRAND_RE, siteConfig.siteName);
}

export function stripBrandSuffix(value: string): string {
  const escapedCurrentBrand = siteConfig.siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffixRe = new RegExp(`[\\s\\-|]+(?:МОССЕО|Моссео|MOSSEO|Mosseo|${escapedCurrentBrand})\\s*$`, 'i');
  return replaceLegacyBrand(value)
    .replace(suffixRe, '')
    .replace(/\s+от\s*$/i, '')
    .trim();
}
