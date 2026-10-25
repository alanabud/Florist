import { getTaxConfigForState } from '../data/taxConfig';
import { SITE_CONFIG } from '../config/siteConfig';

/**
 * Storefront checkout checks and the quote shown beside them.
 * Pickup does not use the recipient's delivery state: in-store tax
 * follows the studio state in SITE_CONFIG, which is 0 until that
 * state is set (same DEFAULT rule as an unselected delivery state).
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const PHONE_CHARS = /^[+()\-.\s\d]+$/;
const ZIP = /^\d{5}(-\d{4})?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function filled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseFulfillmentDate(value: string): Date | null {
  if (!value || typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  const match = DATE_ONLY.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function todayIsoDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isValidFulfillmentDate(value: string): boolean {
  return parseFulfillmentDate(value) !== null;
}

export function isPastFulfillmentDate(value: string, now = new Date()): boolean {
  const date = parseFulfillmentDate(value);
  if (!date) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return date.getTime() < start.getTime();
}

export function formatFulfillmentDateLong(value: string, locale?: string): string | null {
  const date = parseFulfillmentDate(value);
  if (!date) return null;
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function isValidPhone(value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!PHONE_CHARS.test(trimmed)) return false;
  return trimmed.replace(/\D/g, '').length >= 10;
}

export function isValidZip(value: string): boolean {
  return typeof value === 'string' && ZIP.test(value.trim());
}

export function hasRecipientContact(form: { recipientName: string; recipientPhone: string }): boolean {
  return filled(form.recipientName) && filled(form.recipientPhone);
}

export function hasDeliveryAddress(form: {
  recipientAddress: string;
  recipientCity: string;
  recipientState: string;
  recipientZip: string;
}): boolean {
  return filled(form.recipientAddress)
    && filled(form.recipientCity)
    && filled(form.recipientState)
    && filled(form.recipientZip);
}

export function isValidSender(form: { senderName: string; senderEmail: string }): boolean {
  return filled(form.senderName) && typeof form.senderEmail === 'string' && EMAIL.test(form.senderEmail.trim());
}

export function isDeliveryMethod(value: string): value is 'standard' | 'sameday' | 'pickup' {
  return value === 'standard' || value === 'sameday' || value === 'pickup';
}

export interface CheckoutQuoteInput {
  deliveryType: string;
  recipientState: string;
  subtotal: number;
  taxableSubtotal: number;
}

export interface CheckoutQuote {
  /** False until the customer picks standard, same-day, or pickup. */
  deliveryChosen: boolean;
  deliveryFee: number;
  taxes: number;
  total: number;
}

export function quoteCheckout(input: CheckoutQuoteInput): CheckoutQuote {
  if (!isDeliveryMethod(input.deliveryType)) {
    return {
      deliveryChosen: false,
      deliveryFee: 0,
      taxes: 0,
      total: input.subtotal,
    };
  }

  const deliveryFee = input.deliveryType === 'sameday' ? 19.99 : input.deliveryType === 'pickup' ? 0 : 9.99;
  // Pickup is fulfilled at the studio, so destination (recipient) state
  // does not set the rate. An unset studio state stays on the 0 DEFAULT.
  const taxState = input.deliveryType === 'pickup' ? SITE_CONFIG.addressState : input.recipientState;
  const taxConfig = getTaxConfigForState(taxState || '');
  let taxableAmount = input.taxableSubtotal;
  if (input.deliveryType !== 'pickup' && taxConfig.isDeliveryTaxable) {
    taxableAmount += deliveryFee;
  }
  const taxes = taxableAmount * taxConfig.rate;
  return {
    deliveryChosen: true,
    deliveryFee,
    taxes,
    total: input.subtotal + deliveryFee + taxes,
  };
}
