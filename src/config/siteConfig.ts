/**
 * SITE CONFIG — single source of truth for the storefront's business facts.
 *
 * Fields Alan has not confirmed yet are intentionally EMPTY STRINGS
 * (launch configuration, 2026-10-18). The UI hides empty contact fields
 * and falls back gracefully — it never renders placeholder/TODO text to
 * visitors. Fill a field in here and the corresponding UI appears.
 * Nothing else in the codebase should hard-code these facts — pages read
 * them from here.
 */
export const SITE_CONFIG = {
  /** Brand name shown across the storefront. */
  businessName: 'BloomPro Florals',

  /**
   * Legal entity name that operates the store (Terms/Privacy). EMPTY for
   * the demo launch — the legal pages fall back to the trading name
   * (businessName) until Alan confirms the legal entity. Required before
   * real sales.
   */
  legalBusinessName: 'AF Strategic Technologies LLC',

  /** Public contact email (Contact page, Terms, Privacy). Set by Alan for the 2026-10-18 demo launch. */
  contactEmail: 'alanabud@gmail.com',

  /** Public contact phone (Contact page). Empty = the phone row is hidden. */
  contactPhone: '+1 (352) 809-4226',

  /** Studio/store address (Contact page, pickup instructions). Empty = hidden / generic pickup wording. */
  addressLine1: '',
  addressCity: '',
  /** Studio tax state on the live florist deploy. Not a street; pickup copy stays hidden until addressLine1 is set. */
  addressState: 'FL',
  addressZip: '',

  /** Public support hours, e.g. "Mon–Sat, 9 AM – 6 PM ET" (Contact page). Empty = hidden. */
  supportHours: '',

  /** Founding story for the About page. Empty = no story paragraph is rendered. */
  foundingStory: '',

  /**
   * Cities where delivery is actually offered. The Delivery Policy page
   * lists these verbatim; while empty (Alan has not confirmed a list for
   * the demo launch) it shows generic "contact us to confirm coverage"
   * wording instead of inventing coverage. Same-day delivery claims
   * elsewhere on the site must match this list once it is set.
   */
  deliveryCities: [] as string[],

  /** Instagram profile linked from the homepage gallery. Handle as branded on the homepage — TODO: verify it is the real account. */
  instagramHandle: '@BloomProStudio',
  instagramUrl: 'https://www.instagram.com/bloomprostudio',

  /**
   * US state whose law governs the Terms of Service. Empty for the demo
   * launch — the governing-law section is hidden until Alan confirms it.
   * Required before real sales.
   */
  governingLawState: 'FL',
};

/**
 * Street line for in-store pickup. Empty until a future tenant sets
 * SITE_CONFIG.addressLine1. City, state, or ZIP alone are not a street
 * and must not surface as a location fragment.
 */
export function studioAddressLines(): string[] {
  const street = SITE_CONFIG.addressLine1.trim();
  if (!street) return [];
  const cityState = [SITE_CONFIG.addressCity.trim(), SITE_CONFIG.addressState.trim()].filter(Boolean).join(', ');
  const locality = [cityState, SITE_CONFIG.addressZip.trim()].filter(Boolean).join(' ');
  return [street, locality].filter((line) => line.length > 0);
}

/**
 * Customer-facing pickup block.
 * With no street (BloomPro demo): "{businessName} — {atStudio}" plus the
 * email-instructions line. Never a blank street row, a downtown claim,
 * or an invented address.
 * With a complete street (future tenant): the same title, then the street,
 * then City, ST ZIP — incomplete locality fragments stay hidden.
 * The recipient's name is not part of the location.
 */
export function studioPickupBodyLines(atStudio: string, emailInstructions: string): string[] {
  const name = SITE_CONFIG.businessName.trim();
  const title = [name, atStudio.trim()].filter(Boolean).join(' — ');
  const address = studioAddressLines();
  if (address.length === 0) {
    return [title, emailInstructions.trim()].filter((line) => line.length > 0);
  }
  return [title, ...address];
}
