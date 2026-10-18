import { collection, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

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
export const createGuestOrder = async (orderData: GuestOrderData) => {
  try {
    // 1. Generate unique order tracking number
    const generatedNum = Math.floor(Math.random() * 90000) + 10000;
    const orderNumber = `BLM-${generatedNum}`;

    // 2. Normalize tracking number and sender email. The tracking lookup
    // id is derived deterministically here and re-derived identically by
    // the payment webhook when it creates the tracking document.
    const orderNumberNormalized = orderNumber.toLowerCase().trim();
    const senderEmailNormalized = orderData.senderEmail.toLowerCase().trim();
    const trackingLookupId = `${orderNumberNormalized}_${senderEmailNormalized}`;

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
      trackingLookupId, // sanitized lookup ID (tracking doc is created by the webhook on payment)
      orderNumber, // readable BLM-XXXXX tracking code
    };
  } catch (error) {
    console.error('Failed to create guest order:', error);
    throw error;
  }
};
