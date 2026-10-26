/**
 * BloomPro Cloud Functions — Stripe hosted Checkout.
 *
 * Scaffolded by the certification fix pass (2026-10-18). Before this,
 * guest checkout was a mock: the client collected card fields into local
 * state, never sent them anywhere, and wrote orders to Firestore already
 * marked paymentStatus 'paid'. This file replaces that with a real flow:
 *
 *   1. The client creates the order in Firestore in a PENDING state
 *      (status 'pending_payment', paymentStatus 'pending') — see
 *      src/services/publicOrderService.ts.
 *   2. `createStripeCheckoutSession` (callable) re-reads the order
 *      server-side — amounts are NEVER trusted from the client — creates
 *      a Stripe-hosted Checkout Session and returns its URL. The client
 *      redirects the customer to Stripe; card data goes to Stripe only.
 *   3. `stripeWebhook` receives Stripe's signed events. ONLY on a
 *      confirmed payment does it flip the order to 'confirmed' / 'paid'
 *      and create the public tracking document. Nothing anywhere else
 *      may mark a guest order paid.
 *
 * Secrets (never in source): STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET,
 * set with `firebase functions:secrets:set …`. Test keys first; going
 * live is a secrets + publishable-key swap, not a code change.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Transaction } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import Stripe from 'stripe';
import { APP_BASE_URL, ORDER_CURRENCY, GUEST_COMPANY_ID } from './config';

initializeApp();
const db = getFirestore();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

/**
 * Server-side gate for DEMO payments. The client offers its demo flow
 * only while no Stripe publishable key is configured, but the server
 * does not trust the client: `confirmDemoPayment` refuses to run unless
 * PAYMENTS_DEMO_MODE is explicitly 'enabled' in the functions
 * environment (functions/.env or the deployed functions config). When
 * Alan's real Stripe keys go in, this stays 'disabled' and demo
 * confirmation is impossible even if an old client build asks for it.
 */
const demoPaymentsMode = defineString('PAYMENTS_DEMO_MODE', {
  default: 'disabled',
});

const getStripe = (): Stripe => new Stripe(stripeSecretKey.value());

interface OrderLineItem {
  name?: string;
  price?: number;
  quantity?: number;
}

interface OrderData {
  companyId?: string;
  customerId?: string;
  status?: string;
  paymentStatus?: string;
  items?: OrderLineItem[];
  deliveryFee?: number;
  taxes?: number;
  total?: number;
  orderNumber?: string;
  orderNumberNormalized?: string;
  senderEmailNormalized?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientCity?: string;
  recipientState?: string;
  recipientZip?: string;
  deliveryType?: string;
  deliveryDate?: string;
}

const toCents = (dollars: number | undefined): number =>
  Math.round((dollars ?? 0) * 100);

const trackingLookupIdFor = (order: OrderData): string =>
  `${order.orderNumberNormalized}_${order.senderEmailNormalized}`;

/**
 * Creates a Stripe-hosted Checkout Session for a pending guest order.
 * Input: { orderId: string }. Output: { url, sessionId }.
 */
export const createStripeCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    const orderId = request.data?.orderId as unknown;
    if (typeof orderId !== 'string' || orderId.length === 0) {
      throw new HttpsError('invalid-argument', 'A valid orderId is required.');
    }

    const orderRef = db.collection('orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }
    const order = snap.data() as OrderData;

    if (order.companyId !== GUEST_COMPANY_ID || order.customerId !== 'guest') {
      throw new HttpsError('permission-denied', 'Not a guest checkout order.');
    }
    if (order.paymentStatus !== 'pending') {
      throw new HttpsError(
        'failed-precondition',
        'This order is not awaiting payment.'
      );
    }

    // Build Stripe line items from the SERVER-SIDE order document.
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let accountedCents = 0;
    for (const item of order.items ?? []) {
      const unitAmount = toCents(item.price);
      const quantity = item.quantity ?? 1;
      accountedCents += unitAmount * quantity;
      lineItems.push({
        quantity,
        price_data: {
          currency: ORDER_CURRENCY,
          unit_amount: unitAmount,
          product_data: { name: String(item.name ?? 'Item') },
        },
      });
    }

    const deliveryCents = toCents(order.deliveryFee);
    if (deliveryCents > 0) {
      accountedCents += deliveryCents;
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: ORDER_CURRENCY,
          unit_amount: deliveryCents,
          product_data: { name: 'Delivery' },
        },
      });
    }

    // Fold any float-rounding residual into the tax line so the amount
    // Stripe charges equals the order total to the cent. The residual is
    // what remains of the total AFTER items, delivery AND the recorded
    // tax — computing it before adding the tax would count the tax
    // twice on every internally-consistent order (caught by the
    // functions QA harness, 2026-10-18).
    const taxCents =
      toCents(order.taxes) +
      (toCents(order.total) - (accountedCents + toCents(order.taxes)));
    if (taxCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: ORDER_CURRENCY,
          unit_amount: taxCents,
          product_data: { name: 'Sales tax' },
        },
      });
    } else if (taxCents < 0) {
      throw new HttpsError('internal', 'Order totals are inconsistent.');
    }

    if (lineItems.length === 0 || toCents(order.total) <= 0) {
      throw new HttpsError('failed-precondition', 'Order has no payable total.');
    }

    const trackingLookupId = trackingLookupIdFor(order);
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      client_reference_id: orderId,
      metadata: {
        orderId,
        orderNumber: order.orderNumber ?? '',
        trackingLookupId,
      },
      payment_intent_data: {
        metadata: { orderId, orderNumber: order.orderNumber ?? '' },
      },
      success_url:
        `${APP_BASE_URL}/order-confirmation/${trackingLookupId}` +
        '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: `${APP_BASE_URL}/checkout?payment=cancelled`,
    });

    if (!session.url) {
      throw new HttpsError('internal', 'Stripe did not return a checkout URL.');
    }

    await orderRef.update({
      paymentProvider: 'stripe',
      stripeCheckoutSessionId: session.id,
    });

    return { url: session.url, sessionId: session.id };
  }
);

/**
 * Writes the public tracking document for an order inside a transaction.
 * The tracking document exists only once payment (real or demo) has been
 * confirmed server-side — an unpaid order never gets a public "order
 * placed" page. Demo confirmations stamp `paymentMode: 'demo'` on the
 * document so the confirmation/tracking UI can label the order as a demo
 * (no real payment was processed).
 */
const writeTrackingDoc = (
  tx: Transaction,
  order: OrderData,
  now: string,
  paymentMode?: 'demo'
): void => {
  const trackingRef = db
    .collection('publicOrderTracking')
    .doc(trackingLookupIdFor(order));
  tx.set(trackingRef, {
    orderNumber: order.orderNumber,
    orderNumberNormalized: order.orderNumberNormalized,
    senderEmailNormalized: order.senderEmailNormalized,
    status: 'placed',
    deliveryDate: order.deliveryDate,
    deliveryType: order.deliveryType ?? '',
    recipientFirstName: String(order.recipientName ?? '').split(' ')[0],
    recipientName: String(order.recipientName ?? '').trim(),
    addressLine1: String(order.recipientAddress ?? '').trim(),
    city: order.recipientCity,
    state: order.recipientState,
    zip: String(order.recipientZip ?? '').trim(),
    itemsSummary: (order.items ?? [])
      .map((item) => `${item.quantity ?? 1}x ${item.name ?? ''}`)
      .join(', '),
    timeline: [{ status: 'placed', label: 'Order Placed', timestamp: now }],
    updatedAt: now,
    companyId: GUEST_COMPANY_ID,
    ...(paymentMode ? { paymentMode } : {}),
  });
};

/** Flips an order to confirmed/paid and creates its public tracking doc. */
const confirmOrderPaid = async (session: Stripe.Checkout.Session): Promise<void> => {
  const orderId = session.metadata?.orderId || session.client_reference_id;
  if (!orderId) {
    logger.warn('Stripe session without an orderId', { sessionId: session.id });
    return;
  }

  const orderRef = db.collection('orders').doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) {
      logger.warn('Webhook for unknown order', { orderId });
      return;
    }
    const order = snap.data() as OrderData;
    if (order.paymentStatus === 'paid') {
      return; // Idempotent: duplicate webhook deliveries are expected.
    }

    const now = new Date().toISOString();
    tx.update(orderRef, {
      status: 'confirmed',
      paymentStatus: 'paid',
      paidAt: now,
      paymentProvider: 'stripe',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : null,
    });

    writeTrackingDoc(tx, order, now);
  });

  logger.info('Order confirmed paid via Stripe webhook', {
    orderId,
    sessionId: session.id,
  });
};

/**
 * Confirms a DEMO payment for a pending guest order (callable).
 *
 * This is the demo-mode counterpart of the Stripe webhook flip, with a
 * deliberately different outcome: the order becomes status 'confirmed'
 * with paymentStatus 'demo_paid' — NEVER 'paid' — because no real money
 * moved. Demo orders carry paymentProvider 'demo' and demoPayment: true,
 * and every revenue/GL/report derivation in the app excludes
 * paymentStatus 'demo_paid' (see src/services/demoOrder.ts).
 *
 * Validation mirrors createStripeCheckoutSession: the order is re-read
 * server-side, must be a guest checkout order for the storefront company,
 * and must still be in its pending state — an already-paid, already-demo,
 * or staff order is refused. The flip happens in a transaction that
 * re-checks the pending state, so concurrent/duplicate confirmations are
 * idempotent. The Firestore rules are NOT weakened for this: guests
 * still cannot update orders at all; this runs on the Admin SDK.
 *
 * Server gate: refuses unless PAYMENTS_DEMO_MODE === 'enabled' in the
 * functions environment (see demoPaymentsMode above).
 *
 * Input: { orderId: string }. Output: { ok: true, trackingLookupId }.
 */
export const confirmDemoPayment = onCall(async (request) => {
  if (demoPaymentsMode.value() !== 'enabled') {
    throw new HttpsError(
      'failed-precondition',
      'Demo payments are not enabled on this server.'
    );
  }

  const orderId = request.data?.orderId as unknown;
  if (typeof orderId !== 'string' || orderId.length === 0) {
    throw new HttpsError('invalid-argument', 'A valid orderId is required.');
  }

  const orderRef = db.collection('orders').doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Order not found.');
  }
  const order = snap.data() as OrderData;

  if (order.companyId !== GUEST_COMPANY_ID || order.customerId !== 'guest') {
    throw new HttpsError('permission-denied', 'Not a guest checkout order.');
  }
  if (order.paymentStatus === 'demo_paid') {
    // Idempotent: a confirmation that already landed (e.g. the client
    // retries after a lost response) reports success, not an error.
    return { ok: true, trackingLookupId: trackingLookupIdFor(order) };
  }
  if (order.status !== 'pending_payment' || order.paymentStatus !== 'pending') {
    throw new HttpsError(
      'failed-precondition',
      'This order is not awaiting payment.'
    );
  }

  const trackingLookupId = trackingLookupIdFor(order);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(orderRef);
    if (!fresh.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }
    const freshOrder = fresh.data() as OrderData;
    if (
      freshOrder.status !== 'pending_payment' ||
      freshOrder.paymentStatus !== 'pending'
    ) {
      // Already confirmed (by this demo flow or otherwise) — treat a
      // repeat confirmation of a demo-paid order as idempotent success,
      // anything else as a conflict.
      if (freshOrder.paymentStatus === 'demo_paid') {
        return;
      }
      throw new HttpsError(
        'failed-precondition',
        'This order is not awaiting payment.'
      );
    }

    tx.update(orderRef, {
      status: 'confirmed',
      paymentStatus: 'demo_paid',
      paymentProvider: 'demo',
      demoPayment: true,
      paidAt: now,
    });

    writeTrackingDoc(tx, freshOrder, now, 'demo');
  });

  logger.info('Order confirmed as DEMO payment (no real charge)', { orderId });
  return { ok: true, trackingLookupId };
});

/** Records a failed/expired payment attempt; the order stays unpaid. */
const markOrderPaymentFailed = async (
  session: Stripe.Checkout.Session
): Promise<void> => {
  const orderId = session.metadata?.orderId || session.client_reference_id;
  if (!orderId) return;

  const orderRef = db.collection('orders').doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return;
  const order = snap.data() as OrderData;
  if (order.paymentStatus === 'paid') return;

  await orderRef.update({
    paymentStatus: 'failed',
    paymentProvider: 'stripe',
    stripeCheckoutSessionId: session.id,
  });
  logger.info('Order payment marked failed/expired', {
    orderId,
    sessionId: session.id,
  });
};

/**
 * Stripe webhook endpoint. Stripe signs every event; the signature is
 * verified against the raw request body before anything is trusted.
 * Configure the endpoint URL for `checkout.session.completed`,
 * `checkout.session.async_payment_succeeded`,
 * `checkout.session.async_payment_failed`, and `checkout.session.expired`.
 */
export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      res.status(400).send('Missing stripe-signature header.');
      return;
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        req.rawBody,
        signature,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      logger.error('Stripe webhook signature verification failed', err);
      res.status(400).send('Webhook signature verification failed.');
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          // Card payments are 'paid' immediately; delayed methods report
          // 'unpaid' here and confirm via async_payment_succeeded instead.
          if (session.payment_status === 'paid') {
            await confirmOrderPaid(session);
          }
          break;
        }
        case 'checkout.session.async_payment_succeeded':
          await confirmOrderPaid(event.data.object);
          break;
        case 'checkout.session.expired':
        case 'checkout.session.async_payment_failed':
          await markOrderPaymentFailed(event.data.object);
          break;
        default:
          break;
      }
    } catch (err) {
      logger.error('Stripe webhook handler failed', { type: event.type, err });
      res.status(500).send('Webhook handler error.');
      return;
    }

    res.status(200).json({ received: true });
  }
);
