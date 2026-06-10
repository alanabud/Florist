import { getTaxConfigForState } from '../data/taxConfig';

export interface OrderCalculationResult {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  serviceFee: number;
  taxableAmount: number;
  tax: number;
  tip: number;
  grandTotal: number;
  balanceDue: number;
  estimatedCost: number;
  estimatedMargin: number;
  marginPercentage: number;
}

export function calculateOrderTotals(order: {
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  serviceFee?: number;
  tip?: number;
  amountPaid?: number;
  state?: string;
  recipientState?: string;
  lineItems?: Array<{
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxable?: boolean;
    cost?: number;
  }>;
  estimatedCost?: number;
}): OrderCalculationResult {
  const state = order.recipientState || order.state || 'NY';
  const taxConfig = getTaxConfigForState(state);

  let subtotal = 0;
  let lineDiscountSum = 0;
  let taxableSubtotal = 0;
  let estimatedCost = 0;

  if (order.lineItems && order.lineItems.length > 0) {
    order.lineItems.forEach((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = item.discount || 0;
      const itemLineTotal = Math.max(0, itemSubtotal - itemDiscount);

      subtotal += itemSubtotal;
      lineDiscountSum += itemDiscount;

      if (item.taxable !== false) {
        taxableSubtotal += itemLineTotal;
      }

      // Estimate item cost (stem cost or default markup ratio)
      const itemCost = item.cost !== undefined ? item.cost * item.quantity : itemSubtotal * 0.35;
      estimatedCost += itemCost;
    });
  } else {
    subtotal = order.subtotal || 0;
    taxableSubtotal = Math.max(0, subtotal - (order.discount || 0));
    estimatedCost = order.estimatedCost !== undefined ? order.estimatedCost : subtotal * 0.35;
  }

  const orderDiscount = order.discount !== undefined ? order.discount : 0;
  const totalDiscount = lineDiscountSum + orderDiscount;
  const netSubtotal = Math.max(0, subtotal - totalDiscount);

  const deliveryFee = order.deliveryFee !== undefined ? order.deliveryFee : 9.99;
  const serviceFee = order.serviceFee !== undefined ? order.serviceFee : 0;
  const tip = order.tip !== undefined ? order.tip : 0;

  // Taxable base calculation
  let taxableAmount = taxableSubtotal;
  if (taxConfig.isDeliveryTaxable) {
    taxableAmount += deliveryFee;
  }

  const tax = Math.round(taxableAmount * taxConfig.rate * 100) / 100;
  const grandTotal = Math.round((netSubtotal + deliveryFee + serviceFee + tax + tip) * 100) / 100;

  const amountPaid = order.amountPaid !== undefined ? order.amountPaid : 0;
  const balanceDue = Math.round((grandTotal - amountPaid) * 100) / 100;

  const estimatedMargin = Math.round((grandTotal - estimatedCost) * 100) / 100;
  const marginPercentage = grandTotal > 0 ? Math.round((estimatedMargin / grandTotal) * 10000) / 100 : 0;

  return {
    subtotal,
    discount: totalDiscount,
    deliveryFee,
    serviceFee,
    taxableAmount,
    tax,
    tip,
    grandTotal,
    balanceDue,
    estimatedCost,
    estimatedMargin,
    marginPercentage,
  };
}
