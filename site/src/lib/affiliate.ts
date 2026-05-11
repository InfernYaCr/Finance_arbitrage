import affiliateLinksRaw from '../data/affiliateLinks.json';
import promoSlotsRaw from '../data/promoSlots.json';
import type { PageType } from '../data/types';

interface AffiliateLink {
  id: string;
  label: string;
  href: string;
  rel: string;
  utm: {
    source: string;
    medium: string;
    campaign: string;
    content?: string; // различает несколько ссылок в одной статье
    term?: string;    // ключевое слово (опционально)
  };
  enabled: boolean;
}

interface PromoSlot {
  id: string;
  enabled: boolean;
  placement: string;
  sections: string[];
  paths: string[];
  html: string;
  link_ids: string[];
}

const affiliateLinks = affiliateLinksRaw as AffiliateLink[];
const promoSlots = promoSlotsRaw as PromoSlot[];

export function buildUtmHref(link: AffiliateLink): string {
  const params: Record<string, string> = {
    utm_source: link.utm.source,
    utm_medium: link.utm.medium,
    utm_campaign: link.utm.campaign,
  };
  if (link.utm.content) params['utm_content'] = link.utm.content;
  if (link.utm.term) params['utm_term'] = link.utm.term;
  const qs = new URLSearchParams(params).toString();
  const sep = link.href.includes('?') ? '&' : '?';
  return `${link.href}${sep}${qs}`;
}

export function getAffiliateLink(id: string): (AffiliateLink & { utmHref: string }) | null {
  const link = affiliateLinks.find((l) => l.id === id && l.enabled);
  if (!link) return null;
  return { ...link, utmHref: buildUtmHref(link) };
}

export function getPromoSlotsForPage(
  placement: string,
  section: string,
  path: string,
  _pageType: PageType,
): PromoSlot[] {
  return promoSlots.filter((slot) => {
    if (!slot.enabled) return false;
    if (slot.placement !== placement) return false;
    if (slot.sections.length > 0 && !slot.sections.includes(section)) return false;
    if (slot.paths.length > 0 && !slot.paths.includes(path)) return false;
    return true;
  });
}
