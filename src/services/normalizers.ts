import { type Order, type InventoryItem, type Customer, type EventItem, type SubscriptionItem } from '../store/adminStore';
import { type Product } from '../data/products';

export function normalizeOrder(order: any): Order {
  if (!order) return {} as Order;
  const subtotal = order.subtotal !== undefined ? parseFloat(order.subtotal) : (order.total || 0) * 0.85;
  const deliveryFee = order.deliveryFee !== undefined ? parseFloat(order.deliveryFee) : 9.99;
  const taxes = order.taxes !== undefined ? parseFloat(order.taxes) : (order.total || 0) * 0.08875;
  const total = order.total !== undefined ? parseFloat(order.total) : subtotal + deliveryFee + taxes;

  // Convert line items safely
  let lineItems = order.lineItems;
  if (!lineItems || !Array.isArray(lineItems)) {
    lineItems = [
      {
        productId: order.product || 'p1',
        sku: 'WR-001',
        description: 'Default arrangement items',
        quantity: parseInt(order.quantity || order.items || '1') || 1,
        unitPrice: subtotal,
        discount: order.discount || 0,
        taxable: true,
        lineTotal: subtotal,
        substitutionAllowed: true,
        designerNotes: '',
      }
    ];
  }

  return {
    id: order.id || `ord-${Date.now()}`,
    companyId: order.companyId || 'DEFAULT_COMPANY',
    customerId: order.customerId || 'c1',
    customerName: order.customerName || 'Walk-in Client',
    status: order.status || 'draft',
    total: total,
    items: order.items || lineItems.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0),
    createdAt: order.createdAt || new Date().toISOString(),
    deliveryDate: order.deliveryDate || new Date().toISOString(),
    driver: order.driver || '',
    priority: order.priority || 'normal',
    notes: order.notes || '',
    subtotal: subtotal,
    deliveryFee: deliveryFee,
    taxes: taxes,
    assignedStaffId: order.assignedStaffId || '',
    
    // Expanded Overview fields
    dueDate: order.dueDate || order.deliveryDate || new Date().toISOString(),
    deliveryWindow: order.deliveryWindow || 'morning',
    fulfillmentStatus: order.fulfillmentStatus || 'unfulfilled',
    salesChannel: order.salesChannel || 'store',
    storeLocation: order.storeLocation || 'Main Branch',
    customerSource: order.customerSource || 'organic',
    occasion: order.occasion || 'Just Because',
    internalOrderType: order.internalOrderType || 'retail',
    tags: Array.isArray(order.tags) ? order.tags : (order.tags ? [order.tags] : []),
    balanceDue: order.balanceDue !== undefined ? parseFloat(order.balanceDue) : (order.status === 'delivered' || order.status === 'paid' ? 0 : total),
    paymentStatus: order.paymentStatus || (order.status === 'delivered' || order.status === 'paid' ? 'paid' : 'unpaid'),
    marginEstimate: order.marginEstimate !== undefined ? parseFloat(order.marginEstimate) : subtotal * 0.65,
    slaRisk: order.slaRisk || 'low',

    // Customer/Recipient details
    customerEmail: order.customerEmail || order.senderEmail || '',
    customerPhone: order.customerPhone || order.senderPhone || '',
    customerType: order.customerType || 'retail',
    accountNumber: order.accountNumber || '',
    loyaltyStatus: order.loyaltyStatus || 'none',
    preferredContactMethod: order.preferredContactMethod || 'email',
    recipientName: order.recipientName || order.customerName || '',
    recipientPhone: order.recipientPhone || '',
    relationshipToSender: order.relationshipToSender || 'self',
    addressLine1: order.addressLine1 || order.recipientAddress || '',
    addressLine2: order.addressLine2 || '',
    city: order.city || '',
    state: order.state || order.recipientState || 'NY',
    zipCode: order.zipCode || '',
    deliveryInstructions: order.deliveryInstructions || '',
    gateCode: order.gateCode || '',
    safeDropAllowed: order.safeDropAllowed !== undefined ? !!order.safeDropAllowed : false,
    signatureRequired: order.signatureRequired !== undefined ? !!order.signatureRequired : false,
    lineItems: lineItems,

    // Pricing & Totals
    discount: order.discount !== undefined ? parseFloat(order.discount) : 0,
    serviceFee: order.serviceFee !== undefined ? parseFloat(order.serviceFee) : 0,
    tip: order.tip !== undefined ? parseFloat(order.tip) : 0,
    estimatedCost: order.estimatedCost !== undefined ? parseFloat(order.estimatedCost) : subtotal * 0.35,
    estimatedMargin: order.estimatedMargin !== undefined ? parseFloat(order.estimatedMargin) : subtotal * 0.65,

    // Finance/GL accounts
    paymentMethod: order.paymentMethod || 'cash',
    amountPaid: order.amountPaid !== undefined ? parseFloat(order.amountPaid) : (order.status === 'delivered' || order.status === 'paid' ? total : 0),
    paymentReference: order.paymentReference || '',
    stripeId: order.stripeId || '',
    invoiceNumber: order.invoiceNumber || `INV-${order.id ? order.id.replace('ord-', '') : Date.now()}`,
    taxJurisdiction: order.taxJurisdiction || 'Local',
    taxRate: order.taxRate !== undefined ? parseFloat(order.taxRate) : 0.08875,
    glPostingStatus: order.glPostingStatus || 'unposted',
    revenueAccount: order.revenueAccount || '4000-Sales',
    arAccount: order.arAccount || '1200-AR',
    cashAccount: order.cashAccount || '1010-Cash',
    refundStatus: order.refundStatus || 'none',
    refundAmount: order.refundAmount !== undefined ? parseFloat(order.refundAmount) : 0,
    financeNotes: order.financeNotes || '',

    // Fulfillment
    deliveryMethod: order.deliveryMethod || 'courier',
    courier: order.courier || order.driver || '',
    routeNumber: order.routeNumber || '',
    deliveryZone: order.deliveryZone || 'Zone A',
    pickupWindow: order.pickupWindow || '',
    dispatchTime: order.dispatchTime || '',
    deliveredTime: order.deliveredTime || '',
    proofOfDelivery: order.proofOfDelivery || '',
    deliveryPhotoUrl: order.deliveryPhotoUrl || '',
    deliveryAttemptCount: order.deliveryAttemptCount !== undefined ? parseInt(order.deliveryAttemptCount) : 0,
    failedReason: order.failedReason || '',
    redeliveryRequired: order.redeliveryRequired !== undefined ? !!order.redeliveryRequired : false,
    driverNotes: order.driverNotes || '',
    customerDeliveryNotes: order.customerDeliveryNotes || '',

    // Internal/Audit
    internalNotes: order.internalNotes || '',
    floristNotes: order.floristNotes || order.cardMessage || '',
    qaChecklist: Array.isArray(order.qaChecklist) ? order.qaChecklist : [],
    fraudRiskFlag: order.fraudRiskFlag !== undefined ? !!order.fraudRiskFlag : false,
    createdBy: order.createdBy || 'System',
    lastUpdatedBy: order.lastUpdatedBy || 'System',
    lastUpdatedDate: order.lastUpdatedDate || new Date().toISOString(),
    auditTrail: Array.isArray(order.auditTrail) ? order.auditTrail : [],
    documentId: order.documentId || order.id || '',
    sourceType: order.sourceType || 'system',
    lastExportDate: order.lastExportDate || ''
  };
}

export function normalizeProduct(product: any): Product {
  if (!product) return {} as Product;
  return {
    id: product.id || `p-${Date.now()}`,
    name: product.name || 'Unnamed Product',
    price: product.price !== undefined ? parseFloat(product.price) : 0,
    description: product.description || '',
    category: product.category || 'Roses',
    occasions: Array.isArray(product.occasions) ? product.occasions : ['Just Because'],
    colors: Array.isArray(product.colors) ? product.colors : ['Mixed'],
    imageUrl: product.imageUrl || 'https://images.unsplash.com/photo-1591886960571-74d43a9d4166?q=80&w=600&auto=format&fit=crop',
    isBestSeller: product.isBestSeller !== undefined ? !!product.isBestSeller : false,
    isSameDay: product.isSameDay !== undefined ? !!product.isSameDay : true,
    isTaxable: product.isTaxable !== undefined ? !!product.isTaxable : true,
    rating: product.rating !== undefined ? parseFloat(product.rating) : 4.5,
    inStock: product.inStock !== undefined ? !!product.inStock : true,
    tags: Array.isArray(product.tags) ? product.tags : [],

    // Expanded Product details
    shortDescription: product.shortDescription || '',
    productStatus: product.productStatus || 'active',
    featuredProduct: product.featuredProduct !== undefined ? !!product.featuredProduct : false,
    seasonalProduct: product.seasonalProduct !== undefined ? !!product.seasonalProduct : false,
    basePrice: product.basePrice !== undefined ? parseFloat(product.basePrice) : (product.price || 0),
    salePrice: product.salePrice !== undefined ? parseFloat(product.salePrice) : 0,
    cost: product.cost !== undefined ? parseFloat(product.cost) : (product.price || 0) * 0.4,
    marginPercent: product.marginPercent !== undefined ? parseFloat(product.marginPercent) : 60,
    taxCategory: product.taxCategory || 'Standard',
    deliveryEligible: product.deliveryEligible !== undefined ? !!product.deliveryEligible : true,
    subscriptionEligible: product.subscriptionEligible !== undefined ? !!product.subscriptionEligible : true,

    // Inventory settings
    stockQuantity: product.stockQuantity !== undefined ? parseInt(product.stockQuantity) : 100,
    reorderPoint: product.reorderPoint !== undefined ? parseInt(product.reorderPoint) : 10,
    preferredSupplier: product.preferredSupplier || 'Dutch Blooms Wholesale',
    leadTimeDays: product.leadTimeDays !== undefined ? parseInt(product.leadTimeDays) : 3,
    unitOfMeasure: product.unitOfMeasure || 'Stem',
    storageLocation: product.storageLocation || 'Cold Room A',
    shelfLifeDays: product.shelfLifeDays !== undefined ? parseInt(product.shelfLifeDays) : 7,
    substitutionProduct: product.substitutionProduct || '',

    // Media & storefront
    mainImage: product.mainImage || product.imageUrl || '',
    galleryUrls: Array.isArray(product.galleryUrls) ? product.galleryUrls : [],
    storefrontVisibility: product.storefrontVisibility !== undefined ? !!product.storefrontVisibility : true,
    seoTitle: product.seoTitle || product.name || '',
    seoDescription: product.seoDescription || product.description || '',
    productBadge: product.productBadge || '',
    displayOrder: product.displayOrder !== undefined ? parseInt(product.displayOrder) : 0,

    // Audit
    createdBy: product.createdBy || 'Admin',
    createdDate: product.createdDate || new Date().toISOString(),
    lastUpdated: product.lastUpdated || new Date().toISOString(),
    internalNotes: product.internalNotes || '',
    auditTrail: Array.isArray(product.auditTrail) ? product.auditTrail : []
  };
}

export function normalizeCustomer(customer: any): Customer {
  if (!customer) return {} as Customer;
  return {
    id: customer.id || `cust-${Date.now()}`,
    companyId: customer.companyId || 'DEFAULT_COMPANY',
    name: customer.name || 'Walk-in Client',
    email: customer.email || '',
    phone: customer.phone || '',
    lifetimeValue: customer.lifetimeValue !== undefined ? parseFloat(customer.lifetimeValue) : 0,
    totalOrders: customer.totalOrders !== undefined ? parseInt(customer.totalOrders) : 0,

    // Expanded Profile
    customerType: customer.customerType || 'retail',
    secondaryPhone: customer.secondaryPhone || '',
    preferredContactMethod: customer.preferredContactMethod || 'email',
    status: customer.status || 'active',
    loyaltyTier: customer.loyaltyTier || 'bronze',
    birthday: customer.birthday || '',
    anniversary: customer.anniversary || '',

    // Addresses
    billingAddress: customer.billingAddress || customer.address || '',
    deliveryAddress: customer.deliveryAddress || customer.address || '',
    city: customer.city || '',
    state: customer.state || 'NY',
    zipCode: customer.zipCode || customer.zip || '',
    deliveryInstructions: customer.deliveryInstructions || '',
    defaultDeliveryZone: customer.defaultDeliveryZone || 'Zone A',

    // Financial
    openBalance: customer.openBalance !== undefined ? parseFloat(customer.openBalance) : 0,
    creditLimit: customer.creditLimit !== undefined ? parseFloat(customer.creditLimit) : 0,
    paymentTerms: customer.paymentTerms || 'Due on Receipt',
    taxExempt: customer.taxExempt !== undefined ? !!customer.taxExempt : false,
    taxId: customer.taxId || '',
    preferredPaymentMethod: customer.preferredPaymentMethod || 'credit_card',
    lastOrderDate: customer.lastOrderDate || '',

    // Preferences
    favoriteFlowers: Array.isArray(customer.favoriteFlowers) ? customer.favoriteFlowers : (customer.favoriteFlowers ? [customer.favoriteFlowers] : []),
    allergies: Array.isArray(customer.allergies) ? customer.allergies : (customer.allergies ? [customer.allergies] : []),
    preferredColors: Array.isArray(customer.preferredColors) ? customer.preferredColors : (customer.preferredColors ? [customer.preferredColors] : []),
    occasionReminders: customer.occasionReminders !== undefined ? !!customer.occasionReminders : false,
    marketingOptIn: customer.marketingOptIn !== undefined ? !!customer.marketingOptIn : false,
    smsOptIn: customer.smsOptIn !== undefined ? !!customer.smsOptIn : false,

    // Notes & Audit
    notes: customer.notes || '',
    createdBy: customer.createdBy || 'Admin',
    createdDate: customer.createdDate || new Date().toISOString(),
    lastUpdated: customer.lastUpdated || new Date().toISOString(),
    internalNotes: customer.internalNotes || '',
    auditTrail: Array.isArray(customer.auditTrail) ? customer.auditTrail : []
  };
}

export function normalizeInventoryItem(item: any): InventoryItem {
  if (!item) return {} as InventoryItem;
  return {
    id: item.id || `inv-${Date.now()}`,
    companyId: item.companyId || 'DEFAULT_COMPANY',
    name: item.name || 'Unnamed Stem',
    sku: item.sku || 'SKU-TEMP',
    category: item.category || 'Flowers',
    quantity: item.quantity !== undefined ? parseInt(item.quantity) : 0,
    reorderPoint: item.reorderPoint !== undefined ? parseInt(item.reorderPoint) : 50,
    unitCost: item.unitCost !== undefined ? parseFloat(item.unitCost) : 1.0,
    supplier: item.supplier || '',

    // Expanded Details
    type: item.type || 'Stem',
    unitOfMeasure: item.unitOfMeasure || 'Stem',
    status: item.status !== undefined ? !!item.status : true,
    storageLocation: item.storageLocation || 'Cold Room A',
    shelfLifeDays: item.shelfLifeDays !== undefined ? parseInt(item.shelfLifeDays) : 7,

    // Stock fields
    quantityReserved: item.quantityReserved !== undefined ? parseInt(item.quantityReserved) : 0,
    quantityAvailable: item.quantityAvailable !== undefined ? parseInt(item.quantityAvailable) : (item.quantity || 0),
    reorderQuantity: item.reorderQuantity !== undefined ? parseInt(item.reorderQuantity) : 100,
    minimumStock: item.minimumStock !== undefined ? parseInt(item.minimumStock) : 20,
    maximumStock: item.maximumStock !== undefined ? parseInt(item.maximumStock) : 1000,
    lastCountedDate: item.lastCountedDate || new Date().toISOString().split('T')[0],

    // Supplier details
    supplierSku: item.supplierSku || item.sku || '',
    lastPurchaseCost: item.lastPurchaseCost !== undefined ? parseFloat(item.lastPurchaseCost) : (item.unitCost || 0),
    leadTimeDays: item.leadTimeDays !== undefined ? parseInt(item.leadTimeDays) : 3,
    purchaseOrderLink: item.purchaseOrderLink || '',
    lastRestockDate: item.lastRestockDate || '',

    // Quality/Waste
    expirationDate: item.expirationDate || '',
    condition: item.condition || 'Fresh',
    wasteQuantity: item.wasteQuantity !== undefined ? parseInt(item.wasteQuantity) : 0,
    wasteReason: item.wasteReason || '',
    qualityNotes: item.qualityNotes || '',

    // Audit
    createdBy: item.createdBy || 'Admin',
    createdDate: item.createdDate || new Date().toISOString(),
    updatedBy: item.updatedBy || 'Admin',
    auditTrail: Array.isArray(item.auditTrail) ? item.auditTrail : []
  };
}

export function normalizeSubscription(sub: any): SubscriptionItem {
  if (!sub) return {} as SubscriptionItem;
  return {
    id: sub.id || `sub-${Date.now()}`,
    companyId: sub.companyId || 'DEFAULT_COMPANY',
    customerName: sub.customerName || 'Walk-in Client',
    product: sub.product || 'Seasonal Designer Mix',
    frequency: sub.frequency || 'Weekly',
    status: sub.status || 'active',
    nextDelivery: sub.nextDelivery || new Date().toISOString(),
    value: sub.value !== undefined ? parseFloat(sub.value) : 85,

    // Custom mappings
    productName: sub.productName || sub.product || 'Seasonal Designer Mix',
    nextDeliveryDate: sub.nextDeliveryDate || sub.nextDelivery || new Date().toISOString(),

    // Expanded details
    subscriptionNumber: sub.subscriptionNumber || sub.id || `SUB-${Date.now()}`,
    customer: sub.customer || sub.customerName || '',
    planType: sub.planType || 'designer_choice',
    startDate: sub.startDate || new Date().toISOString().split('T')[0],
    endDate: sub.endDate || '',
    pauseStatus: sub.pauseStatus !== undefined ? !!sub.pauseStatus : (sub.status === 'paused'),

    // Preferences
    preferredFlowers: Array.isArray(sub.preferredFlowers) ? sub.preferredFlowers : (sub.preferredFlowers ? [sub.preferredFlowers] : []),
    preferredColors: Array.isArray(sub.preferredColors) ? sub.preferredColors : (sub.preferredColors ? [sub.preferredColors] : []),
    occasionType: sub.occasionType || 'Just Because',
    exclusions: Array.isArray(sub.exclusions) ? sub.exclusions : (sub.exclusions ? [sub.exclusions] : []),
    designerNotes: sub.designerNotes || '',
    deliveryInstructions: sub.deliveryInstructions || '',

    // Billing
    pricePerCycle: sub.pricePerCycle !== undefined ? parseFloat(sub.pricePerCycle) : (sub.value || 85),
    tax: sub.tax !== undefined ? parseFloat(sub.tax) : 0,
    deliveryFee: sub.deliveryFee !== undefined ? parseFloat(sub.deliveryFee) : 0,
    paymentMethod: sub.paymentMethod || 'credit_card',
    billingStatus: sub.billingStatus || 'active',
    lastPaymentDate: sub.lastPaymentDate || '',
    nextBillingDate: sub.nextBillingDate || sub.nextDelivery || '',
    failedPaymentCount: sub.failedPaymentCount !== undefined ? parseInt(sub.failedPaymentCount) : 0,

    // Schedule
    deliveryDay: sub.deliveryDay || 'Friday',
    deliveryWindow: sub.deliveryWindow || 'morning',
    address: sub.address || '',
    courierNotes: sub.courierNotes || '',
    route: sub.route || '',
    skipNextDelivery: sub.skipNextDelivery !== undefined ? !!sub.skipNextDelivery : false,

    // Audit
    createdBy: sub.createdBy || 'Admin',
    createdDate: sub.createdDate || new Date().toISOString(),
    updatedBy: sub.updatedBy || 'Admin',
    internalNotes: sub.internalNotes || '',
    auditTrail: Array.isArray(sub.auditTrail) ? sub.auditTrail : []
  };
}

export function normalizeEvent(event: any): EventItem {
  if (!event) return {} as EventItem;
  return {
    id: event.id || `evt-${Date.now()}`,
    companyId: event.companyId || 'DEFAULT_COMPANY',
    name: event.name || 'New Consultation',
    type: event.type || 'Wedding',
    date: event.date || new Date().toISOString(),
    budget: event.budget !== undefined ? parseFloat(event.budget) : 1000,
    status: event.status || 'planning',
    client: event.client || '',

    // Custom mappings
    title: event.title || event.name || '',
    customerName: event.customerName || event.client || '',
    total: event.total !== undefined ? parseFloat(event.total) : (event.budget || 0),

    // Expanded details
    startTime: event.startTime || '10:00',
    endTime: event.endTime || '16:00',
    venue: event.venue || '',
    coordinator: event.coordinator || ' Elena R.',
    priority: event.priority || 'normal',

    // Client/Venue
    clientContact: event.clientContact || event.client || '',
    phone: event.phone || '',
    email: event.email || '',
    venueAddress: event.venueAddress || event.venue || '',
    venueContact: event.venueContact || '',
    setupAccessTime: event.setupAccessTime || '',
    parkingNotes: event.parkingNotes || '',
    specialRestrictions: event.specialRestrictions || '',

    // Floral Plan
    bridalBouquetCount: event.bridalBouquetCount !== undefined ? parseInt(event.bridalBouquetCount) : 0,
    centerpieceCount: event.centerpieceCount !== undefined ? parseInt(event.centerpieceCount) : 0,
    ceremonyArrangements: event.ceremonyArrangements || '',
    receptionArrangements: event.receptionArrangements || '',
    colorPalette: event.colorPalette || '',
    flowerPreferences: Array.isArray(event.flowerPreferences) ? event.flowerPreferences : (event.flowerPreferences ? [event.flowerPreferences] : []),
    rentalItems: Array.isArray(event.rentalItems) ? event.rentalItems : [],
    designerNotes: event.designerNotes || event.notes || '',

    // Financials
    estimateAmount: event.estimateAmount !== undefined ? parseFloat(event.estimateAmount) : (event.budget || 0),
    depositRequired: event.depositRequired !== undefined ? parseFloat(event.depositRequired) : (event.budget || 0) * 0.25,
    depositPaid: event.depositPaid !== undefined ? parseFloat(event.depositPaid) : 0,
    balanceDue: event.balanceDue !== undefined ? parseFloat(event.balanceDue) : (event.budget || 0),
    paymentStatus: event.paymentStatus || 'unpaid',
    invoiceNumber: event.invoiceNumber || `EVT-${event.id ? event.id.replace('evt-', '') : Date.now()}`,
    contractStatus: event.contractStatus || 'draft',
    marginEstimate: event.marginEstimate !== undefined ? parseFloat(event.marginEstimate) : (event.budget || 0) * 0.5,

    // Logistics
    deliveryDate: event.deliveryDate || event.date || new Date().toISOString(),
    deliveryTime: event.deliveryTime || '09:00',
    setupCrew: Array.isArray(event.setupCrew) ? event.setupCrew : [],
    breakdownCrew: Array.isArray(event.breakdownCrew) ? event.breakdownCrew : [],
    truckRoute: event.truckRoute || '',
    checklist: Array.isArray(event.checklist) ? event.checklist : [],
    riskNotes: event.riskNotes || '',

    // Audit
    createdBy: event.createdBy || 'Admin',
    createdDate: event.createdDate || new Date().toISOString(),
    updatedBy: event.updatedBy || 'Admin',
    auditTrail: Array.isArray(event.auditTrail) ? event.auditTrail : []
  };
}
