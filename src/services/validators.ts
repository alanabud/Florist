import { calculateOrderTotals } from './orderCalculationService';

export interface ValidationResult {
  errors: Record<string, string>;
  tabErrorCounts: Record<string, number>;
}

// Helper to count errors by tab matching the forms configuration
function computeTabErrorCounts(
  errors: Record<string, string>,
  fieldToTabMap: Record<string, string>
): Record<string, number> {
  const counts: Record<string, number> = {};
  Object.keys(errors).forEach((field) => {
    const tab = fieldToTabMap[field] || 'general';
    counts[tab] = (counts[tab] || 0) + 1;
  });
  return counts;
}

export function validateOrder(order: any): ValidationResult {
  const errors: Record<string, string> = {};

  // Map fields to tabs
  const fieldToTabMap: Record<string, string> = {
    dueDate: 'overview',
    deliveryDate: 'overview',
    status: 'overview',
    priority: 'overview',
    assignedStaffId: 'overview',
    customerName: 'customer',
    customerEmail: 'customer',
    customerPhone: 'customer',
    recipientName: 'customer',
    recipientPhone: 'customer',
    addressLine1: 'customer',
    city: 'customer',
    state: 'customer',
    zipCode: 'customer',
    amountPaid: 'finance',
    paymentMethod: 'finance',
    taxRate: 'finance',
    deliveryMethod: 'fulfillment',
    courier: 'fulfillment',
    deliveredTime: 'fulfillment',
    failedReason: 'fulfillment',
  };

  // 1. Basic Required Fields
  if (!order.customerName) errors.customerName = 'Customer Name is required';
  if (!order.recipientName) errors.recipientName = 'Recipient Name is required';
  if (!order.addressLine1) errors.addressLine1 = 'Delivery Address is required';
  if (!order.city) errors.city = 'City is required';
  if (!order.state) errors.state = 'State is required';
  if (!order.zipCode) errors.zipCode = 'ZIP Code is required';
  if (!order.deliveryDate) errors.deliveryDate = 'Delivery date is required';

  if (order.customerEmail && !order.customerEmail.includes('@')) {
    errors.customerEmail = 'Invalid customer email address';
  }

  // 2. Calculations check
  const totals = calculateOrderTotals(order);
  
  // Rule: Completed/Delivered order cannot have unpaid balance
  if ((order.status === 'delivered' || order.status === 'paid') && totals.balanceDue > 0) {
    errors.amountPaid = `Completed order has an unpaid balance of $${totals.balanceDue.toFixed(2)}`;
  }

  // Rule: Delivered order must have delivery date/time
  if (order.status === 'delivered' && !order.deliveredTime) {
    errors.deliveredTime = 'Delivered time stamp is required for delivered status';
  }

  // Rule: Balance due is negative
  if (totals.balanceDue < 0) {
    errors.amountPaid = `Amount paid ($${order.amountPaid}) exceeds grand total ($${totals.grandTotal})`;
  }

  // Rule: Paid but not GL posted
  if (order.paymentStatus === 'paid' && order.glPostingStatus === 'unposted') {
    errors.glPostingStatus = 'Order is paid but general ledger posting is pending';
  }

  return {
    errors,
    tabErrorCounts: computeTabErrorCounts(errors, fieldToTabMap),
  };
}

export function validateProduct(product: any): ValidationResult {
  const errors: Record<string, string> = {};

  const fieldToTabMap: Record<string, string> = {
    name: 'details',
    sku: 'details',
    category: 'details',
    basePrice: 'pricing',
    salePrice: 'pricing',
    cost: 'pricing',
    stockQuantity: 'inventory',
    reorderPoint: 'inventory',
    mainImage: 'media',
  };

  if (!product.name) errors.name = 'Product Title is required';
  if (!product.sku) errors.sku = 'SKU Code is required';
  if (product.basePrice === undefined || product.basePrice === null || product.basePrice === '') {
    errors.basePrice = 'Base price is required';
  } else if (parseFloat(product.basePrice) < 0) {
    errors.basePrice = 'Base price cannot be negative';
  }

  // Rule: Product sale price cannot exceed base price
  const base = parseFloat(product.basePrice) || 0;
  const sale = parseFloat(product.salePrice) || 0;
  if (sale > 0 && sale > base) {
    errors.salePrice = 'Sale price cannot exceed the base price';
  }

  const stock = parseInt(product.stockQuantity) || 0;
  if (stock < 0) {
    errors.stockQuantity = 'Stock quantity cannot be negative';
  }

  return {
    errors,
    tabErrorCounts: computeTabErrorCounts(errors, fieldToTabMap),
  };
}

export function validateCustomer(customer: any): ValidationResult {
  const errors: Record<string, string> = {};

  const fieldToTabMap: Record<string, string> = {
    name: 'profile',
    email: 'profile',
    phone: 'profile',
    billingAddress: 'addresses',
    deliveryAddress: 'addresses',
    creditLimit: 'sales',
    preferredPaymentMethod: 'sales',
  };

  if (!customer.name) errors.name = 'Customer name is required';
  if (!customer.email) {
    errors.email = 'Customer email is required';
  } else if (!customer.email.includes('@')) {
    errors.email = 'Invalid email address format';
  }

  const limit = parseFloat(customer.creditLimit) || 0;
  if (limit < 0) {
    errors.creditLimit = 'Credit limit cannot be negative';
  }

  return {
    errors,
    tabErrorCounts: computeTabErrorCounts(errors, fieldToTabMap),
  };
}

export function validateInventoryItem(item: any): ValidationResult {
  const errors: Record<string, string> = {};

  const fieldToTabMap: Record<string, string> = {
    name: 'details',
    sku: 'details',
    category: 'details',
    quantity: 'stock',
    reorderPoint: 'stock',
    unitCost: 'supplier',
    supplier: 'supplier',
    expirationDate: 'quality',
  };

  if (!item.name) errors.name = 'Item name is required';
  if (!item.sku) errors.sku = 'SKU code is required';
  
  const qty = parseInt(item.quantity);
  if (isNaN(qty)) {
    errors.quantity = 'Quantity on hand is required';
  } else if (qty < 0) {
    errors.quantity = 'Quantity cannot be negative';
  }

  const cost = parseFloat(item.unitCost);
  if (isNaN(cost)) {
    errors.unitCost = 'Unit material cost is required';
  } else if (cost < 0) {
    errors.unitCost = 'Cost cannot be negative';
  }

  return {
    errors,
    tabErrorCounts: computeTabErrorCounts(errors, fieldToTabMap),
  };
}

export function validateSubscription(sub: any): ValidationResult {
  const errors: Record<string, string> = {};

  const fieldToTabMap: Record<string, string> = {
    subscriptionNumber: 'details',
    customer: 'details',
    status: 'details',
    pricePerCycle: 'billing',
    nextBillingDate: 'billing',
    nextDeliveryDate: 'schedule',
    address: 'schedule',
  };

  if (!sub.customer) errors.customer = 'Subscriber Name is required';
  if (!sub.subscriptionNumber) errors.subscriptionNumber = 'Subscription ID is required';
  
  const price = parseFloat(sub.pricePerCycle);
  if (isNaN(price) || price <= 0) {
    errors.pricePerCycle = 'Price per period must be greater than zero';
  }

  // Rule: Next billing date cannot be before start date
  if (sub.nextBillingDate && sub.startDate) {
    if (new Date(sub.nextBillingDate) < new Date(sub.startDate)) {
      errors.nextBillingDate = 'Next billing date cannot be earlier than plan start date';
    }
  }

  return {
    errors,
    tabErrorCounts: computeTabErrorCounts(errors, fieldToTabMap),
  };
}

export function validateEvent(event: any): ValidationResult {
  const errors: Record<string, string> = {};

  const fieldToTabMap: Record<string, string> = {
    name: 'overview',
    client: 'overview',
    date: 'overview',
    email: 'client',
    phone: 'client',
    estimateAmount: 'financials',
    depositPaid: 'financials',
    deliveryDate: 'logistics',
  };

  if (!event.name) errors.name = 'Event name is required';
  if (!event.client) errors.client = 'Client name is required';
  if (!event.date) errors.date = 'Event date is required';

  const est = parseFloat(event.estimateAmount) || 0;
  const dep = parseFloat(event.depositPaid) || 0;
  
  // Rule: Event deposit paid cannot exceed estimate amount
  if (dep > est) {
    errors.depositPaid = 'Deposit paid cannot exceed total quoted estimate';
  }

  return {
    errors,
    tabErrorCounts: computeTabErrorCounts(errors, fieldToTabMap),
  };
}

export function validateDelivery(delivery: any): ValidationResult {
  const errors: Record<string, string> = {};

  const fieldToTabMap: Record<string, string> = {
    recipientName: 'overview',
    addressLine1: 'overview',
    city: 'overview',
    state: 'overview',
    zipCode: 'overview',
    courier: 'dispatch',
    routeNumber: 'dispatch',
    failedReason: 'proof',
  };

  if (!delivery.recipientName) errors.recipientName = 'Recipient Name is required';
  if (!delivery.addressLine1) errors.addressLine1 = 'Address Line 1 is required';
  
  // Rule: Address must have city, state, ZIP
  if (!delivery.city) errors.city = 'City is required';
  if (!delivery.state) errors.state = 'State is required';
  if (!delivery.zipCode) errors.zipCode = 'ZIP Code is required';

  if (delivery.status === 'failed' && !delivery.failedReason) {
    errors.failedReason = 'Reason must be recorded for failed attempts';
  }

  return {
    errors,
    tabErrorCounts: computeTabErrorCounts(errors, fieldToTabMap),
  };
}
