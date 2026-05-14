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
  /** Raw HTML to render. If empty, html is auto-generated from link_ids. */
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

/** Resolve a slot's html: use provided html or auto-generate from link_ids. */
function resolveSlotHtml(slot: PromoSlot): string {
  if (slot.html) return slot.html;
  if (slot.link_ids.length === 0) return '';
  const items = slot.link_ids
    .map((id) => {
      const link = affiliateLinks.find((l) => l.id === id && l.enabled);
      if (!link) return null;
      const href = buildUtmHref(link);
      return `<a href="${href}" rel="${link.rel}">${link.label}</a>`;
    })
    .filter(Boolean);
  if (items.length === 0) return '';
  return `<p class="promo-slot__links">${items.join(' · ')}</p>`;
}

export interface ResolvedPromoSlot extends PromoSlot {
  resolvedHtml: string;
}

export function getPromoSlotsForPage(
  placement: string,
  section: string,
  path: string,
  _pageType: PageType,
): ResolvedPromoSlot[] {
  return promoSlots
    .filter((slot) => {
      if (!slot.enabled) return false;
      if (slot.placement !== placement) return false;
      if (slot.sections.length > 0 && !slot.sections.includes(section)) return false;
      if (slot.paths.length > 0 && !slot.paths.includes(path)) return false;
      return true;
    })
    .map((slot) => ({ ...slot, resolvedHtml: resolveSlotHtml(slot) }))
    .filter((slot) => slot.resolvedHtml !== '');
}
