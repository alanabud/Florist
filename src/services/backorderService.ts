import type { OrderLineItem } from '../store/adminStore';

/**
 * Backorder detection & validation for order entry.
 *
 * A line is backordered when the ordered quantity exceeds the available
 * inventory for its SKU. backorderedQty is always DERIVED
 * (max(ordered - available, 0)) — never hand-typed — and a reason is required
 * before an order with backordered lines may leave 'draft'.
 *
 * Pure functions only: no Firestore, no GL/finance coupling. Mirrored by
 * test-backorder.mjs — keep the two in sync.
 */

export const BACKORDER_REASON_CODES = [
  'vendor_shipment_delay',
  'seasonal_shortage',
  'supplier_out_of_stock',
  'partial_inventory_available',
  'special_order_item',
  'quality_hold',
  'awaiting_po_receipt',
  'other',
] as const;

export type BackorderReasonCode = (typeof BACKORDER_REASON_CODES)[number];

interface ProductRef { id: string; sku?: string }
interface InventoryRef { sku: string; quantity: number }

/**
 * Available stock for a line, resolved product-first (the line's sku can be
 * stale after a product switch). Returns null when the SKU is not tracked in
 * inventory — untracked items (services, special orders) are never flagged.
 */
export function getAvailableQtyForLine(
  line: Pick<OrderLineItem, 'productId' | 'sku'>,
  products: ProductRef[],
  inventory: InventoryRef[]
): number | null {
  const sku = products.find(p => p.id === line.productId)?.sku || line.sku;
  if (!sku) return null;
  const inv = inventory.find(i => i.sku === sku);
  return inv ? Math.max(inv.quantity ?? 0, 0) : null;
}

/** Derived, clamped at 0 — a backordered quantity can never be negative. */
export function deriveBackorderedQty(orderedQty: number, availableQty: number | null): number {
  if (availableQty === null) return 0;
  return Math.max((orderedQty || 0) - availableQty, 0);
}

/**
 * Re-derive a line's backorderedQty from current inventory. When the line is
 * no longer backordered, stale reason/date/note fields are cleared (removed,
 * not set to undefined — Firestore rejects undefined values).
 */
export function applyBackorderDerivation<T extends Record<string, any>>(
  line: T,
  products: ProductRef[],
  inventory: InventoryRef[]
): T {
  const available = getAvailableQtyForLine(line as any, products, inventory);
  const backorderedQty = deriveBackorderedQty(parseInt(line.quantity) || 0, available);
  if (backorderedQty <= 0) {
    const {
      backorderedQty: _q, backorderReasonCode: _c, backorderReasonText: _t,
      expectedRestockDate: _d, customerBackorderNote: _n, ...rest
    } = line;
    return rest as T;
  }
  return { ...line, backorderedQty };
}

export interface BackorderIssue {
  /** 0-based line index. */
  index: number;
  code: 'missing_reason' | 'missing_other_text';
}

/**
 * Confirm-gate validation. Drafts are always allowed (the UI shows a gentle
 * hint instead); any other target status requires each backordered line to
 * carry a reason code — and free text when the reason is 'other'.
 */
export function validateBackorderLines(
  lineItems: Array<Record<string, any>>,
  targetStatus: string
): BackorderIssue[] {
  if (targetStatus === 'draft') return [];
  const issues: BackorderIssue[] = [];
  lineItems.forEach((line, index) => {
    if ((line.backorderedQty || 0) <= 0) return;
    if (!line.backorderReasonCode) {
      issues.push({ index, code: 'missing_reason' });
    } else if (line.backorderReasonCode === 'other' && !(line.backorderReasonText || '').trim()) {
      issues.push({ index, code: 'missing_other_text' });
    }
  });
  return issues;
}

export function orderHasBackorder(lineItems: Array<Record<string, any>>): boolean {
  return lineItems.some(line => (line.backorderedQty || 0) > 0);
}
