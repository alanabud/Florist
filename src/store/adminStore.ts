import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_ORDERS, DEMO_INVENTORY, DEMO_CUSTOMERS, DEMO_EVENTS, DEMO_SUBSCRIPTIONS } from '../data/demoData';
import { PRODUCTS, type Product } from '../data/products';
import { normalizeOrder, normalizeProduct, normalizeCustomer, normalizeInventoryItem, normalizeSubscription, normalizeEvent } from '../services/normalizers';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { postOrderFinancials, reverseJournalEntry } from '../services/financeService';
import { calculateOrderTotals } from '../services/orderCalculationService';

export type OrderStatus = 'draft' | 'confirmed' | 'scheduled' | 'in_design' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded';

export type CollectionStatus =
  | 'current'
  | 'due_soon'
  | 'past_due'
  | 'promise_to_pay'
  | 'disputed'
  | 'on_hold'
  | 'sent_to_collections'
  | 'closed';

export interface PaymentAllocation {
  orderId: string;
  orderNumber: string;
  originalBalance: number;
  amountApplied: number;
  remainingBalance: number;
}

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  customerId: string;
  customerName: string;
  paymentDate: string;
  paymentMethod: 'cash' | 'check' | 'credit_card' | 'stripe' | 'bank_transfer' | 'other';
  referenceNumber?: string;
  amount: number;
  unappliedAmount: number;
  status: 'draft' | 'posted' | 'voided' | 'refunded';
  allocations: PaymentAllocation[];
  glPostingStatus: 'unposted' | 'posted' | 'reversed';
  journalEntryId?: string;
  reversalJournalEntryId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderLineItem {
  productId: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxable: boolean;
  lineTotal: number;
  substitutionAllowed: boolean;
  designerNotes: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  total: number;
  items: number;
  createdAt: string;
  deliveryDate: string;
  driver?: string;
  priority?: string;
  notes?: string;
  subtotal?: number;
  deliveryFee?: number;
  taxes?: number;
  assignedStaffId?: string;
  
  // New fields
  dueDate?: string;
  deliveryWindow?: string;
  fulfillmentStatus?: string;
  salesChannel?: string;
  storeLocation?: string;
  customerSource?: string;
  occasion?: string;
  internalOrderType?: string;
  tags?: string[];
  balanceDue?: number;
  paymentStatus?: string;
  marginEstimate?: number;
  slaRisk?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerType?: string;
  accountNumber?: string;
  loyaltyStatus?: string;
  preferredContactMethod?: string;
  recipientName?: string;
  recipientPhone?: string;
  relationshipToSender?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  deliveryInstructions?: string;
  gateCode?: string;
  safeDropAllowed?: boolean;
  signatureRequired?: boolean;
  lineItems?: OrderLineItem[];
  discount?: number;
  serviceFee?: number;
  tip?: number;
  estimatedCost?: number;
  estimatedMargin?: number;
  paymentMethod?: string;
  amountPaid?: number;
  paymentReference?: string;
  stripeId?: string;
  invoiceNumber?: string;
  taxJurisdiction?: string;
  taxRate?: number;
  glPostingStatus?: string;
  journalEntryId?: string;
  reversalJournalEntryId?: string;
  reversalReason?: string;
  reversalDate?: string;
  revenueAccount?: string;
  arAccount?: string;
  cashAccount?: string;
  refundStatus?: string;
  refundAmount?: number;
  financeNotes?: string;
  deliveryMethod?: string;
  courier?: string;
  routeNumber?: string;
  deliveryZone?: string;
  pickupWindow?: string;
  dispatchTime?: string;
  deliveredTime?: string;
  proofOfDelivery?: string;
  deliveryPhotoUrl?: string;
  deliveryAttemptCount?: number;
  failedReason?: string;
  redeliveryRequired?: boolean;
  driverNotes?: string;
  customerDeliveryNotes?: string;
  internalNotes?: string;
  floristNotes?: string;
  qaChecklist?: string[];
  fraudRiskFlag?: boolean;
  createdBy?: string;
  lastUpdatedBy?: string;
  lastUpdatedDate?: string;
  auditTrail?: string[];
  documentId?: string;
  sourceType?: string;
  lastExportDate?: string;
  orderNumber?: string;
  orderNumberNormalized?: string;
  senderEmailNormalized?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  reorderPoint: number;
  unitCost: number;
  supplier: string;
  type?: string;
  unitOfMeasure?: string;
  status?: boolean;
  storageLocation?: string;
  shelfLifeDays?: number;
  quantityReserved?: number;
  quantityAvailable?: number;
  reorderQuantity?: number;
  minimumStock?: number;
  maximumStock?: number;
  lastCountedDate?: string;
  supplierSku?: string;
  lastPurchaseCost?: number;
  leadTimeDays?: number;
  purchaseOrderLink?: string;
  lastRestockDate?: string;
  expirationDate?: string;
  condition?: string;
  wasteQuantity?: number;
  wasteReason?: string;
  qualityNotes?: string;
  createdBy?: string;
  createdDate?: string;
  updatedBy?: string;
  auditTrail?: string[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  lifetimeValue: number;
  totalOrders: number;
  customerType?: string;
  secondaryPhone?: string;
  preferredContactMethod?: string;
  status?: string;
  loyaltyTier?: string;
  birthday?: string;
  anniversary?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  deliveryInstructions?: string;
  defaultDeliveryZone?: string;
  openBalance?: number;
  creditLimit?: number;
  paymentTerms?: string;
  taxExempt?: boolean;
  taxId?: string;
  preferredPaymentMethod?: string;
  lastOrderDate?: string;
  favoriteFlowers?: string[];
  allergies?: string[];
  preferredColors?: string[];
  occasionReminders?: boolean;
  marketingOptIn?: boolean;
  smsOptIn?: boolean;
  notes?: string;
  createdBy?: string;
  createdDate?: string;
  lastUpdated?: string;
  internalNotes?: string;
  auditTrail?: string[];
  
  // AR & credit fields
  arBalance?: number;
  lastPaymentDate?: string;
  lastStatementDate?: string;
  collectionStatus?: CollectionStatus;
  creditBalance?: number;
}

export interface EventItem {
  id: string;
  name: string;
  type: string;
  date: string;
  budget: number;
  status: string;
  client: string;
  title?: string;
  customerName?: string;
  total?: number;
  startTime?: string;
  endTime?: string;
  venue?: string;
  coordinator?: string;
  priority?: string;
  clientContact?: string;
  phone?: string;
  email?: string;
  venueAddress?: string;
  venueContact?: string;
  setupAccessTime?: string;
  parkingNotes?: string;
  specialRestrictions?: string;
  bridalBouquetCount?: number;
  centerpieceCount?: number;
  ceremonyArrangements?: string;
  receptionArrangements?: string;
  colorPalette?: string;
  flowerPreferences?: string[];
  rentalItems?: string[];
  designerNotes?: string;
  estimateAmount?: number;
  depositRequired?: number;
  depositPaid?: number;
  balanceDue?: number;
  paymentStatus?: string;
  invoiceNumber?: string;
  contractStatus?: string;
  marginEstimate?: number;
  deliveryDate?: string;
  deliveryTime?: string;
  setupCrew?: string[];
  breakdownCrew?: string[];
  truckRoute?: string;
  checklist?: string[];
  riskNotes?: string;
  createdBy?: string;
  createdDate?: string;
  updatedBy?: string;
  auditTrail?: string[];
}

export interface SubscriptionItem {
  id: string;
  customerName: string;
  product: string;
  frequency: string;
  status: string;
  nextDelivery: string;
  value: number;
  productName?: string;
  nextDeliveryDate?: string;
  subscriptionNumber?: string;
  customer?: string;
  planType?: string;
  startDate?: string;
  endDate?: string;
  pauseStatus?: boolean;
  preferredFlowers?: string[];
  preferredColors?: string[];
  occasionType?: string;
  exclusions?: string[];
  designerNotes?: string;
  deliveryInstructions?: string;
  pricePerCycle?: number;
  tax?: number;
  deliveryFee?: number;
  paymentMethod?: string;
  billingStatus?: string;
  lastPaymentDate?: string;
  nextBillingDate?: string;
  failedPaymentCount?: number;
  deliveryDay?: string;
  deliveryWindow?: string;
  address?: string;
  courierNotes?: string;
  route?: string;
  skipNextDelivery?: boolean;
  createdBy?: string;
  createdDate?: string;
  updatedBy?: string;
  internalNotes?: string;
  auditTrail?: string[];
}

export interface Vendor {
  id: string; // VND-10001
  name: string;
  contactName?: string;
  email: string;
  phone: string;
  billingAddress: string;
  paymentTerms: string;
  taxId?: string;
  active: boolean;
  defaultGlAccount?: string;
  defaultPaymentMethod?: 'check' | 'cash' | 'bank_transfer' | 'credit_card' | 'other';
  notes?: string;
  balance: number;
  openBillsCount: number;
  lastPaymentDate?: string;
  agingBuckets?: {
    current: number;
    thirtyToSixty: number;
    sixtyToNinety: number;
    overNinety: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderLine {
  id?: string;
  itemId: string;
  sku: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityBilled: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string; // PO-20001
  vendorId: string;
  vendorName: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  location: string;
  lines: PurchaseOrderLine[];
  subtotal: number;
  taxAmount: number;
  freightAmount: number;
  freightTreatment: 'capitalize' | 'expense';
  discountAmount: number;
  totalCost: number;
  status: 'draft' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'closed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface InventoryReceiptLine {
  itemId: string;
  sku: string;
  quantityReceived: number;
  quantityDamaged: number;
  quantityRejected: number;
  quantityAccepted: number;
  unitCost: number;
}

export interface InventoryReceipt {
  id: string; // REC-50001
  poId: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  receiptDate: string;
  lines: InventoryReceiptLine[];
  freightAmount: number;
  freightTreatment: 'capitalize' | 'expense';
  notes?: string;
  glPostingStatus: 'unposted' | 'posted';
  journalEntryId?: string;
  createdAt: string;
  createdBy: string;
}

export interface VendorBillLine {
  description: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  glAccount?: string;
  itemId?: string;
  sku?: string;
}

export interface VendorBill {
  id: string; // VBL-30001
  vendorId: string;
  vendorName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  paymentTerms: string;
  poId?: string;
  poNumber?: string;
  receiptId?: string;
  receiptNumber?: string;
  lines: VendorBillLine[];
  subtotal: number;
  taxAmount: number;
  freightAmount: number;
  discountAmount: number;
  totalAmount: number;
  balanceDue: number;
  status: 'draft' | 'posted' | 'partially_paid' | 'paid' | 'voided';
  glPostingStatus: 'unposted' | 'posted' | 'reversed';
  journalEntryId?: string;
  reversalJournalEntryId?: string;
  matchStatus: 'unmatched' | 'matched' | 'variance' | 'blocked';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface VendorPaymentAllocation {
  billId: string;
  billNumber: string;
  originalBalance: number;
  amountApplied: number;
  remainingBalance: number;
}

export interface VendorPayment {
  id: string; // VPM-40001
  paymentNumber: string;
  vendorId: string;
  vendorName: string;
  paymentDate: string;
  paymentMethod: 'check' | 'cash' | 'bank_transfer' | 'credit_card' | 'other';
  referenceNumber?: string;
  amount: number;
  unappliedAmount: number;
  status: 'draft' | 'posted' | 'voided';
  allocations: VendorPaymentAllocation[];
  glPostingStatus: 'unposted' | 'posted' | 'reversed';
  journalEntryId?: string;
  reversalJournalEntryId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

export interface InventoryTransaction {
  id: string;
  type: 'purchase_receipt' | 'waste' | 'sale_fulfillment' | 'manual_adjustment';
  itemId: string;
  sku: string;
  quantityIn: number;
  quantityOut: number;
  unitCost: number;
  location: string;
  sourceReference: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export type AdminModal =
  | 'newOrder'
  | 'customBouquet'
  | 'newDelivery'
  | 'newCustomer'
  | 'newProduct'
  | 'newInventory'
  | 'newEvent'
  | 'newSubscription'
  | 'newJournal'
  | 'newAccount'
  | 'contactVip'
  | 'adjustPrice'
  | 'exportReport'
  | 'newPayment'
  | 'newStatement'
  | 'newVendor'
  | 'newPO'
  | 'receivePO'
  | 'newVendorBill'
  | 'payVendor'
  | null;

interface AdminState {
  orders: Order[];
  inventory: InventoryItem[];
  customers: Customer[];
  events: EventItem[];
  subscriptions: SubscriptionItem[];
  products: Product[];
  activeModal: AdminModal;
  modalPayload: Record<string, any> | null;
  
  ordersLoading: boolean;
  ordersError: string | null;
  fetchOrders: () => Promise<void>;
  postOrderFinancialsAction: (orderId: string) => Promise<void>;
  
  // Actions
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  updateOrderDetails: (id: string, updates: Partial<Order>) => Promise<void>;
  addOrder: (order: any) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  adjustInventory: (id: string, newQuantity: number) => void;
  restockInventoryItem: (sku: string, amount: number) => void;
  deductStemsFromInventory: (stems: { [sku: string]: number }) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  addProduct: (product: Product) => void;
  updateProductDetails: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustRosePrices: () => void;
  addCustomer: (customer: Customer) => void;
  updateCustomerDetails: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addEvent: (event: EventItem) => void;
  updateEventDetails: (id: string, updates: Partial<EventItem>) => void;
  deleteEvent: (id: string) => void;
  addSubscription: (subscription: SubscriptionItem) => void;
  updateSubscriptionDetails: (id: string, updates: Partial<SubscriptionItem>) => void;
  deleteSubscription: (id: string) => void;
  resetToDemo: () => void;
  
  setActiveModal: (modal: AdminModal, payload?: Record<string, any>) => void;
  closeModal: () => void;
  toggleSubscriptionStatus: (id: string) => void;

  payments: PaymentRecord[];
  paymentsLoading: boolean;
  fetchPayments: () => Promise<void>;
  addPayment: (payment: PaymentRecord) => void;
  updatePaymentDetails: (id: string, updates: Partial<PaymentRecord>) => void;

  statements: any[];
  statementsLoading: boolean;
  fetchCustomerStatements: () => Promise<void>;
  addCustomerStatement: (statement: any) => void;

  // Sprint 1C additions
  vendors: Vendor[];
  vendorsLoading: boolean;
  fetchVendors: () => Promise<void>;
  addVendor: (vendor: Vendor) => void;
  updateVendorDetails: (id: string, updates: Partial<Vendor>) => void;

  purchaseOrders: PurchaseOrder[];
  purchaseOrdersLoading: boolean;
  fetchPurchaseOrders: () => Promise<void>;
  addPurchaseOrder: (po: PurchaseOrder) => void;
  updatePurchaseOrderDetails: (id: string, updates: Partial<PurchaseOrder>) => void;

  inventoryReceipts: InventoryReceipt[];
  inventoryReceiptsLoading: boolean;
  fetchInventoryReceipts: () => Promise<void>;
  addInventoryReceipt: (rec: InventoryReceipt) => void;

  vendorBills: VendorBill[];
  vendorBillsLoading: boolean;
  fetchVendorBills: () => Promise<void>;
  addVendorBill: (bill: VendorBill) => void;
  updateVendorBillDetails: (id: string, updates: Partial<VendorBill>) => void;

  vendorPayments: VendorPayment[];
  vendorPaymentsLoading: boolean;
  fetchVendorPayments: () => Promise<void>;
  addVendorPayment: (payment: VendorPayment) => void;
  updateVendorPaymentDetails: (id: string, updates: Partial<VendorPayment>) => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      orders: (DEMO_ORDERS || []).map(normalizeOrder),
      inventory: (DEMO_INVENTORY || []).map(normalizeInventoryItem),
      customers: (DEMO_CUSTOMERS || []).map(normalizeCustomer),
      events: (DEMO_EVENTS || []).map(normalizeEvent),
      subscriptions: (DEMO_SUBSCRIPTIONS || []).map(normalizeSubscription),
      products: (PRODUCTS || []).map(normalizeProduct),
      activeModal: null,
      modalPayload: null,
      ordersLoading: false,
      ordersError: null,
      payments: [],
      paymentsLoading: false,
      statements: [],
      statementsLoading: false,
      vendors: [],
      vendorsLoading: false,
      purchaseOrders: [],
      purchaseOrdersLoading: false,
      inventoryReceipts: [],
      inventoryReceiptsLoading: false,
      vendorBills: [],
      vendorBillsLoading: false,
      vendorPayments: [],
      vendorPaymentsLoading: false,

      fetchOrders: async () => {
        // Prevent concurrent double fetches
        if (useAdminStore.getState().ordersLoading) return;
        set({ ordersLoading: true, ordersError: null });
        try {
          const seedDocRef = doc(db, 'systemSeeds', 'ordersDemoSeed');
          const seedDocSnap = await getDoc(seedDocRef);
          
          const ordersRef = collection(db, 'orders');
          const q = query(ordersRef, orderBy('createdAt', 'desc'));
          let snapshot = await getDocs(q);

          if (!seedDocSnap.exists() && snapshot.empty) {
            // Seeding needs to be idempotent and deterministic
            for (const order of DEMO_ORDERS) {
              const deterministicId = `demo-order-${order.id.replace('ord-', '')}`;
              await setDoc(doc(db, 'orders', deterministicId), {
                ...order,
                id: deterministicId,
                documentId: deterministicId,
                orderNumber: order.id.toUpperCase(),
                orderNumberNormalized: order.id.toLowerCase().trim(),
                senderEmailNormalized: (DEMO_CUSTOMERS[0].email).toLowerCase().trim(),
                glPostingStatus: 'posted',
              });

              // Write public tracking record
              const lookupId = `${order.id.toLowerCase().trim()}_${(DEMO_CUSTOMERS[0].email).toLowerCase().trim()}`;
              await setDoc(doc(db, 'publicOrderTracking', lookupId), {
                orderNumber: order.id.toUpperCase(),
                status: order.status === 'draft' ? 'placed' : order.status,
                deliveryDate: order.deliveryDate,
                recipientFirstName: order.customerName.split(' ')[0],
                city: 'New York',
                state: 'NY',
                itemsSummary: `${order.items}x Floral Curation`,
                timeline: [
                  {
                    status: 'placed',
                    label: 'Order Placed',
                    timestamp: order.createdAt
                  }
                ],
                updatedAt: order.createdAt
              });
            }

            await setDoc(seedDocRef, { seededAt: new Date().toISOString(), version: 1 });
            snapshot = await getDocs(q);
          }

          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            documentId: doc.id,
            ...doc.data()
          }));
          const parsed = docs.map(normalizeOrder);
          set({ orders: parsed });
        } catch (error: any) {
          console.error("Failed to fetch orders from Firestore:", error);
          set({ ordersError: error.message || "Fetch failed" });
        } finally {
          set({ ordersLoading: false });
        }
      },

      postOrderFinancialsAction: async (orderId: string) => {
        try {
          const jeId = await postOrderFinancials(orderId, 'DEFAULT_COMPANY', 'Admin');
          set(state => ({
            orders: state.orders.map(o => o.id === orderId ? { ...o, glPostingStatus: 'posted', journalEntryId: jeId } : o)
          }));
        } catch (error) {
          console.error("Failed to post financials action:", error);
          throw error;
        }
      },

      updateOrderStatus: async (id, status) => {
        const order = get().orders.find((o: Order) => o.id === id);
        if (!order) throw new Error("Order not found");

        const oldStatus = order.status;
        
        // Terminal state guards
        if (oldStatus === 'cancelled' || oldStatus === 'refunded') {
          throw new Error(`Cannot change status of a terminal ${oldStatus} order.`);
        }

        if (status === 'cancelled') {
          if (oldStatus === 'delivered') {
            throw new Error("Delivered orders cannot be cancelled. Use refund instead.");
          }
        }

        if (status === 'refunded') {
          if (oldStatus !== 'delivered') {
            throw new Error("Only delivered orders can be refunded.");
          }
        }

        if (status === 'delivered') {
          const totals = calculateOrderTotals(order);
          if (totals.balanceDue > 0) {
            throw new Error(`Cannot deliver order with unpaid balance of $${totals.balanceDue.toFixed(2)}.`);
          }
        }

        let reversalUpdates = {};

        try {
          const orderRef = doc(db, 'orders', id);
          
          // Reversal logic if already posted to GL
          if ((status === 'cancelled' || status === 'refunded') && order.glPostingStatus === 'posted' && order.journalEntryId) {
            const revJeId = await reverseJournalEntry(order.journalEntryId, 'Admin');
            reversalUpdates = {
              glPostingStatus: 'reversed',
              reversalJournalEntryId: revJeId,
              reversalReason: status === 'cancelled' ? 'Order Cancelled' : 'Order Refunded',
              reversalDate: new Date().toISOString()
            };
          }

          const deliveredTimeUpdate = status === 'delivered' && !order.deliveredTime 
            ? { deliveredTime: new Date().toISOString() } 
            : {};

          const updates = { 
            status, 
            ...reversalUpdates,
            ...deliveredTimeUpdate,
            updatedAt: new Date().toISOString()
          };

          await updateDoc(orderRef, updates);

          // Update public order tracking
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            if (orderData.orderNumberNormalized && orderData.senderEmailNormalized) {
              const lookupId = `${orderData.orderNumberNormalized}_${orderData.senderEmailNormalized}`;
              const trackingRef = doc(db, 'publicOrderTracking', lookupId);
              const trackingSnap = await getDoc(trackingRef);
              if (trackingSnap.exists()) {
                let trackingStatus = 'placed';
                if (status === 'in_design') trackingStatus = 'preparing';
                else if (status === 'ready') trackingStatus = 'ready';
                else if (status === 'out_for_delivery') trackingStatus = 'out_for_delivery';
                else if (status === 'delivered') trackingStatus = 'delivered';
                else if (status === 'cancelled') trackingStatus = 'cancelled';
                else if (status === 'refunded') trackingStatus = 'refunded';
                
                const trackingData = trackingSnap.data();
                const updatedTimeline = [...(trackingData.timeline || [])];
                if (!updatedTimeline.some(t => t.status === trackingStatus)) {
                  let label = 'Order Placed';
                  if (trackingStatus === 'preparing') label = 'In Assembly';
                  else if (trackingStatus === 'ready') label = 'Ready for Pickup/Delivery';
                  else if (trackingStatus === 'out_for_delivery') label = 'In Transit';
                  else if (trackingStatus === 'delivered') label = 'Delivered';
                  else if (trackingStatus === 'cancelled') label = 'Cancelled';
                  else if (trackingStatus === 'refunded') label = 'Refunded';

                  updatedTimeline.push({
                    status: trackingStatus,
                    label,
                    timestamp: new Date().toISOString()
                  });
                }

                await updateDoc(trackingRef, {
                  status: trackingStatus,
                  timeline: updatedTimeline,
                  updatedAt: new Date().toISOString(),
                  deliveryWindow: orderData.deliveryWindow || null,
                  trackingMessage: orderData.customerDeliveryNotes || orderData.driverNotes || null
                });
              }
            }
          }

          // Update local store state
          set((state) => ({
            orders: state.orders.map(o => o.id === id ? { 
              ...o, 
              status, 
              ...reversalUpdates,
              ...deliveredTimeUpdate
            } : o)
          }));
        } catch (e: any) {
          console.error("Failed to update order status in Firestore:", e);
          throw e;
        }
      },

      updateOrderDetails: async (id, updates) => {
        try {
          const orderRef = doc(db, 'orders', id);
          await updateDoc(orderRef, updates);
        } catch (e) {
          console.error("Failed to update order details in Firestore:", e);
        }
        set((state) => ({
          orders: state.orders.map(o => o.id === id ? { ...o, ...updates } : o)
        }));
      },

      addOrder: async (order) => {
        try {
          const docRef = await addDoc(collection(db, 'orders'), {
            ...order,
            createdAt: new Date().toISOString()
          });
          const normalized = normalizeOrder({ ...order, id: docRef.id, documentId: docRef.id });
          set((state) => ({
            orders: [normalized, ...state.orders]
          }));
        } catch (e) {
          console.error("Failed to add order in Firestore:", e);
          throw e;
        }
      },

      deleteOrder: async (id) => {
        try {
          const orderRef = doc(db, 'orders', id);
          await deleteDoc(orderRef);
        } catch (e) {
          console.error("Failed to delete order in Firestore:", e);
        }
        set((state) => ({
          orders: state.orders.filter(o => o.id !== id)
        }));
      },

      adjustInventory: (id, newQuantity) => set((state) => ({
        inventory: state.inventory.map(i => i.id === id ? { ...i, quantity: newQuantity } : i)
      })),

      restockInventoryItem: (sku, amount) => set((state) => ({
        inventory: state.inventory.map(i => i.sku === sku ? { ...i, quantity: i.quantity + amount } : i)
      })),

      deductStemsFromInventory: (stems) => set((state) => ({
        inventory: state.inventory.map(i => {
          const deductAmount = stems[i.sku] || 0;
          return deductAmount > 0 ? { ...i, quantity: Math.max(0, i.quantity - deductAmount) } : i;
        })
      })),

      updateInventoryItem: (id, updates) => set((state) => ({
        inventory: state.inventory.map(i => i.id === id ? { ...i, ...updates } : i)
      })),

      deleteInventoryItem: (id) => set((state) => ({
        inventory: state.inventory.filter(i => i.id !== id)
      })),

      addProduct: (product) => set((state) => ({
        products: [product, ...state.products]
      })),

      updateProductDetails: (id, updates) => set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      deleteProduct: (id) => set((state) => ({
        products: state.products.filter(p => p.id !== id)
      })),

      adjustRosePrices: () => set((state) => ({
        products: state.products.map(p => {
          const isRose = p.name.toLowerCase().includes('rose') || 
                         p.category.toLowerCase().includes('rose') || 
                         p.tags.some(t => t.toLowerCase().includes('rose'));
          if (isRose) {
            return { ...p, price: Math.round(p.price * 1.15) };
          }
          return p;
        })
      })),

      addCustomer: (customer) => set((state) => ({
        customers: [customer, ...state.customers]
      })),

      updateCustomerDetails: (id, updates) => set((state) => ({
        customers: state.customers.map(c => c.id === id ? { ...c, ...updates } : c)
      })),

      deleteCustomer: (id) => set((state) => ({
        customers: state.customers.filter(c => c.id !== id)
      })),

      addEvent: (event) => set((state) => ({
        events: [event, ...state.events]
      })),

      addSubscription: (subscription) => set((state) => ({
        subscriptions: [subscription, ...state.subscriptions]
      })),

      resetToDemo: () => set({
        orders: (DEMO_ORDERS || []).map(normalizeOrder),
        inventory: (DEMO_INVENTORY || []).map(normalizeInventoryItem),
        customers: (DEMO_CUSTOMERS || []).map(normalizeCustomer),
        events: (DEMO_EVENTS || []).map(normalizeEvent),
        subscriptions: (DEMO_SUBSCRIPTIONS || []).map(normalizeSubscription),
        products: (PRODUCTS || []).map(normalizeProduct),
        activeModal: null,
        modalPayload: null,
      }),

      setActiveModal: (modal, payload: Record<string, any> | null = null) => set({ activeModal: modal, modalPayload: payload }),
      closeModal: () => set({ activeModal: null, modalPayload: null }),
      
      toggleSubscriptionStatus: (id) => set((state) => ({
        subscriptions: state.subscriptions.map(s => 
          s.id === id ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s
        )
      })),

      updateSubscriptionDetails: (id, updates) => set((state) => ({
        subscriptions: state.subscriptions.map(s => s.id === id ? { ...s, ...updates } : s)
      })),

      deleteSubscription: (id) => set((state) => ({
        subscriptions: state.subscriptions.filter(s => s.id !== id)
      })),

      updateEventDetails: (id, updates) => set((state) => ({
        events: state.events.map(e => e.id === id ? { ...e, ...updates } : e)
      })),

      deleteEvent: (id) => set((state) => ({
        events: state.events.filter(e => e.id !== id)
      })),

      fetchPayments: async () => {
        set({ paymentsLoading: true });
        try {
          const snap = await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc')));
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRecord));
          set({ payments: list });
        } catch (e) {
          console.error("Failed to fetch payments:", e);
        } finally {
          set({ paymentsLoading: false });
        }
      },
      addPayment: (payment: PaymentRecord) => set((state) => ({
        payments: [payment, ...state.payments]
      })),
      updatePaymentDetails: (id: string, updates: Partial<PaymentRecord>) => set((state) => ({
        payments: state.payments.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      fetchCustomerStatements: async () => {
        set({ statementsLoading: true });
        try {
          const snap = await getDocs(query(collection(db, 'customerStatements'), orderBy('createdAt', 'desc')));
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          set({ statements: list });
        } catch (e) {
          console.error("Failed to fetch customer statements:", e);
        } finally {
          set({ statementsLoading: false });
        }
      },
      addCustomerStatement: (statement: any) => set((state) => ({
        statements: [statement, ...state.statements]
      })),

      fetchVendors: async () => {
        set({ vendorsLoading: true });
        try {
          const snap = await getDocs(query(collection(db, 'vendors'), orderBy('createdAt', 'desc')));
          set({ vendors: snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)) });
        } catch (e) {
          console.error("Failed to fetch vendors:", e);
        } finally {
          set({ vendorsLoading: false });
        }
      },
      addVendor: (vendor: Vendor) => set((state) => ({
        vendors: [vendor, ...state.vendors]
      })),
      updateVendorDetails: (id: string, updates: Partial<Vendor>) => set((state) => ({
        vendors: state.vendors.map(v => v.id === id ? { ...v, ...updates } : v)
      })),

      fetchPurchaseOrders: async () => {
        set({ purchaseOrdersLoading: true });
        try {
          const snap = await getDocs(query(collection(db, 'purchaseOrders'), orderBy('createdAt', 'desc')));
          set({ purchaseOrders: snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)) });
        } catch (e) {
          console.error("Failed to fetch purchase orders:", e);
        } finally {
          set({ purchaseOrdersLoading: false });
        }
      },
      addPurchaseOrder: (po: PurchaseOrder) => set((state) => ({
        purchaseOrders: [po, ...state.purchaseOrders]
      })),
      updatePurchaseOrderDetails: (id: string, updates: Partial<PurchaseOrder>) => set((state) => ({
        purchaseOrders: state.purchaseOrders.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      fetchInventoryReceipts: async () => {
        set({ inventoryReceiptsLoading: true });
        try {
          const snap = await getDocs(query(collection(db, 'inventoryReceipts'), orderBy('createdAt', 'desc')));
          set({ inventoryReceipts: snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryReceipt)) });
        } catch (e) {
          console.error("Failed to fetch inventory receipts:", e);
        } finally {
          set({ inventoryReceiptsLoading: false });
        }
      },
      addInventoryReceipt: (rec: InventoryReceipt) => set((state) => ({
        inventoryReceipts: [rec, ...state.inventoryReceipts]
      })),

      fetchVendorBills: async () => {
        set({ vendorBillsLoading: true });
        try {
          const snap = await getDocs(query(collection(db, 'vendorBills'), orderBy('createdAt', 'desc')));
          set({ vendorBills: snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorBill)) });
        } catch (e) {
          console.error("Failed to fetch vendor bills:", e);
        } finally {
          set({ vendorBillsLoading: false });
        }
      },
      addVendorBill: (bill: VendorBill) => set((state) => ({
        vendorBills: [bill, ...state.vendorBills]
      })),
      updateVendorBillDetails: (id: string, updates: Partial<VendorBill>) => set((state) => ({
        vendorBills: state.vendorBills.map(b => b.id === id ? { ...b, ...updates } : b)
      })),

      fetchVendorPayments: async () => {
        set({ vendorPaymentsLoading: true });
        try {
          const snap = await getDocs(query(collection(db, 'vendorPayments'), orderBy('createdAt', 'desc')));
          set({ vendorPayments: snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPayment)) });
        } catch (e) {
          console.error("Failed to fetch vendor payments:", e);
        } finally {
          set({ vendorPaymentsLoading: false });
        }
      },
      addVendorPayment: (payment: VendorPayment) => set((state) => ({
        vendorPayments: [payment, ...state.vendorPayments]
      })),
      updateVendorPaymentDetails: (id: string, updates: Partial<VendorPayment>) => set((state) => ({
        vendorPayments: state.vendorPayments.map(vp => vp.id === id ? { ...vp, ...updates } : vp)
      })),
    }),
    {
      name: 'bloompro-admin-store',
      partialize: (state) => {
        const rest = { ...state } as Partial<AdminState>;
        delete rest.activeModal;
        delete rest.modalPayload;
        delete rest.ordersLoading;
        delete rest.ordersError;
        return rest as AdminState;
      }
    }
  )
);
