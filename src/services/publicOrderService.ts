import { collection, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  hasDeliveryAddress,
  hasRecipientContact,
  isDeliveryMethod,
  isPastFulfillmentDate,
  isValidFulfillmentDate,
  isValidPhone,
  isValidSender,
  isValidZip,
} from './checkoutValidation';

export interface GuestOrderLineItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  isCustom: boolean;
}

export interface GuestOrderData {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity: string;
  recipientState: string;
  recipientZip: string;
  deliveryType: string;
  deliveryDate: string;
  senderName: string;
  senderEmail: string;
  cardMessage?: string;
  items: GuestOrderLineItem[];
  subtotal: number;
  deliveryFee: number;
  taxes: number;
  total: number;
}

/**
 * Guest checkout order lifecycle (changed by the Stripe integration,
 * certification fix pass 2026-10-18):
 *
 *  1. The client creates the order here in a PENDING state
 *     (status 'pending_payment', paymentStatus 'pending'). No money has
 *     moved, so the order must NOT present itself as confirmed or paid.
 *  2. The client asks the `createStripeCheckoutSession` Cloud Function
 *     for a Stripe-hosted Checkout Session and redirects the customer to
 *     Stripe, where the card is entered (card data never touches this
 *     app or Firestore).
 *  3. ONLY the Stripe webhook (Admin SDK, server-side) may flip the
 *     order to status 'confirmed' / paymentStatus 'paid', and it also
 *     creates the public tracking document at that moment — so an unpaid
 *     order never gets a public "order placed" tracking page.
 */
/** 32 hex chars. The confirmation URL carries this, never the email. */
export const createTrackingToken = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** Opaque track-order id. SHA-256 of the normalized email, not the email itself. */
export const emailLookupDocId = async (
  orderNumberNormalized: string,
  senderEmailNormalized: string,
): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(senderEmailNormalized));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${orderNumberNormalized}_${hash}`;
};

const assertGuestOrderReady = (orderData: GuestOrderData): void => {
  if (!isDeliveryMethod(orderData.deliveryType)) {
    throw new Error('A delivery method is required to place an order.');
  }
  if (!isValidFulfillmentDate(orderData.deliveryDate) || isPastFulfillmentDate(orderData.deliveryDate)) {
    throw new Error('A current or future delivery/pickup date is required to place an order.');
  }
  if (!hasRecipientContact(orderData) || !isValidPhone(orderData.recipientPhone)) {
    throw new Error('A recipient name and valid phone number are required to place an order.');
  }
  if (orderData.deliveryType !== 'pickup' && (!hasDeliveryAddress(orderData) || !isValidZip(orderData.recipientZip))) {
    throw new Error('A full delivery address and valid US ZIP are required to place an order.');
  }
  if (!isValidSender(orderData)) {
    throw new Error('A sender name and a valid email address are required to place an order.');
  }
};

export const createGuestOrder = async (orderData: GuestOrderData) => {
  try {
    assertGuestOrderReady(orderData);

    // 1. Generate unique order tracking number
    const generatedNum = Math.floor(Math.random() * 90000) + 10000;
    const orderNumber = `BLM-${generatedNum}`;

    // 2. The public confirmation id is order number + an unguessable
    // token. The sender email is stored on the order for the receipt,
    // but it is not part of the confirmation URL. Track Order finds the
    // token through a hashed lookup document.
    const orderNumberNormalized = orderNumber.toLowerCase().trim();
    const senderEmailNormalized = orderData.senderEmail.toLowerCase().trim();
    const trackingToken = createTrackingToken();
    const trackingLookupId = `${orderNumberNormalized}_${trackingToken}`;

    // 3. Write the order to 'orders' in its PENDING state. Pre-allocate
    // the doc ref so the stored id equals the Firestore document id —
    // admin-side mutations (edit/delete/status/GL post) key off order.id,
    // and a fabricated 'ord-…' id would make them target a nonexistent
    // document. Note: the guest-create rules allowlist 'id' but not
    // 'documentId', so only id is set. 'companyId' is required by the
    // guest-create rules and was previously missing from this payload.
    const orderRef = doc(collection(db, 'orders'));
    const fullOrderPayload = {
      ...orderData,
      id: orderRef.id,
      orderNumber,
      orderNumberNormalized,
      senderEmailNormalized,
      trackingToken,
      companyId: 'DEFAULT_COMPANY',
      customerId: 'guest',
      customerName: orderData.senderName || 'Guest Customer',
      status: 'pending_payment', // becomes 'confirmed' only via the Stripe webhook
      paymentStatus: 'pending', // becomes 'paid' only on confirmed payment
      glPostingStatus: 'unposted', // GL postings isolated for admin execution
      createdAt: new Date().toISOString(), // Use ISO string to match existing model structure
      deliveryDate: orderData.deliveryDate,
    };

    await setDoc(orderRef, fullOrderPayload);
    const orderId = orderRef.id;

    return {
      orderId, // full order Firestore ID
      trackingLookupId, // orderNumber_token (email is not in this id)
      trackingToken,
      orderNumber, // readable BLM-XXXXX tracking code
    };
  } catch (error) {
    console.error('Failed to create guest order:', error);
    throw error;
  }
};
