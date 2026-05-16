import { siteConfig } from '../data/siteConfig';

const LATIN_LEGACY_BRAND = ['moss', 'eo'].join('');
const CYRILLIC_LEGACY_BRAND = '\u041c\u043e\u0441\u0441\u0435\u043e';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _withoutTld(alias: string): string[] {
  const without = alias.replace(/\.(ru|com|net|org|рф)$/i, '');
  return without !== alias ? [without] : [];
}

const LEGACY_BRAND_ALIASES = [
  LATIN_LEGACY_BRAND,
  CYRILLIC_LEGACY_BRAND,
  ...siteConfig.legacyContent.brandAliases,
  ...siteConfig.legacyContent.brandAliases.flatMap(_withoutTld),
].filter(Boolean);
const LEGACY_BRAND_RE = new RegExp(
  LEGACY_BRAND_ALIASES.map((alias) => escapeRegExp(alias)).join('|'),
  'gi',
);

export function replaceLegacyBrand(value: string): string {
  if (!value) return value;
  return value.replace(LEGACY_BRAND_RE, siteConfig.siteName);
}

export function stripBrandSuffix(value: string): string {
  const escapedCurrentBrand = escapeRegExp(siteConfig.siteName);
  const escapedLegacyBrands = LEGACY_BRAND_ALIASES.map((alias) => escapeRegExp(alias)).join('|');
  const suffixRe = new RegExp(`[\\s\\-|]+(?:${escapedLegacyBrands}|${escapedCurrentBrand})\\s*$`, 'i');
  return replaceLegacyBrand(value)
    .replace(suffixRe, '')
    .replace(/\s+от\s*$/i, '')
    .trim();
}
