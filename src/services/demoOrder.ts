/**
 * Demo-order identification — single source of truth.
 *
 * Orders paid through the DEMO checkout flow (see stripeConfig.ts
 * PAYMENTS_MODE) end with paymentStatus 'demo_paid' — never 'paid' —
 * because no real money moved. Every revenue total, GL posting path,
 * sales report, and reconciliation derivation MUST exclude demo orders:
 * they are try-outs of the flow, not sales. Admin views use this same
 * predicate to show the DEMO badge and to disable ledger posting.
 *
 * The check is deliberately keyed on paymentStatus (not order status):
 * a demo order otherwise walks the normal fulfilment lifecycle
 * (confirmed → scheduled → … → delivered) exactly like a real one, so
 * the demo origin has to be recognised from the payment field alone.
 */
export const DEMO_PAYMENT_STATUS = 'demo_paid';

export interface DemoOrderLike {
  paymentStatus?: string;
}

export const isDemoOrder = (order: DemoOrderLike | null | undefined): boolean =>
  order?.paymentStatus === DEMO_PAYMENT_STATUS;
