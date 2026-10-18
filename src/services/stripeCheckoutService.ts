import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { STRIPE_CONFIG, isStripeConfigured } from '../config/stripeConfig';

interface CreateSessionResponse {
  url: string;
  sessionId: string;
}

/**
 * Starts Stripe-hosted Checkout for a pending guest order.
 *
 * The `createStripeCheckoutSession` Cloud Function re-reads the order
 * from Firestore (amounts are never trusted from the client), creates a
 * Stripe Checkout Session, and returns its URL. We then redirect the
 * browser to Stripe, where the customer enters card details — card data
 * never touches this app. The order is marked paid ONLY by the Stripe
 * webhook after Stripe confirms the payment.
 */
export const startStripeCheckout = async (orderId: string): Promise<void> => {
  if (!isStripeConfigured()) {
    throw new Error(
      'Stripe is not configured: set VITE_STRIPE_PUBLISHABLE_KEY (see src/config/stripeConfig.ts).'
    );
  }

  const createSession = httpsCallable<{ orderId: string }, CreateSessionResponse>(
    functions,
    STRIPE_CONFIG.createSessionFunctionName
  );
  const { data } = await createSession({ orderId });

  if (!data?.url) {
    throw new Error('Stripe Checkout Session was created without a URL.');
  }

  window.location.assign(data.url);
};
