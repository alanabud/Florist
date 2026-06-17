import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_ORDERS, DEMO_INVENTORY, DEMO_CUSTOMERS, DEMO_EVENTS, DEMO_SUBSCRIPTIONS } from '../data/demoData';
import { PRODUCTS, type Product } from '../data/products';
import { normalizeOrder, normalizeProduct, normalizeCustomer, normalizeInventoryItem, normalizeSubscription, normalizeEvent } from '../services/normalizers';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, setDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { postOrderFinancials, reverseJournalEntry, postCOGSForDeliveredOrder } from '../services/financeService';
import { calculateOrderTotals } from '../services/orderCalculationService';

export type OrderStatus = 'draft' | 'confirmed' | 'scheduled' | 'in_design' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded' | 'delivery_exception' | 'delivery_cancelled';

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
  companyId: string;
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
  isCustom?: boolean;
  customDetails?: any;
}

export interface Order {
  id: string;
  companyId: string;
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

  cogsPosted?: boolean;
  cogsJournalEntryId?: string;
  cogsPostedAt?: any;
  cogsAmount?: number;
  cogsSnapshot?: any[];
  cogsReversed?: boolean;
  cogsReversalJournalEntryId?: string;
  cogsReversalReason?: string;
  cogsReversedAt?: any;
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
  companyId: string;
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
  companyId: string;
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
  
  arBalance?: number;
  lastPaymentDate?: string;
  lastStatementDate?: string;
  collectionStatus?: CollectionStatus;
  creditBalance?: number;
}

export interface EventItem {
  id: string;
  companyId: string;
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
  companyId: string;
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
  id: string;
  companyId: string;
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
  id: string;
  companyId: string;
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
  id: string;
  companyId: string;
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
  id: string;
  companyId: string;
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
  id: string;
  companyId: string;
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
  companyId: string;
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
  
  inventoryLoading: boolean;
  customersLoading: boolean;
  productsLoading: boolean;
  eventsLoading: boolean;
  subscriptionsLoading: boolean;

  fetchInventory: () => Promise<void>;
  fetchCustomers: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchEvents: () => Promise<void>;
  fetchSubscriptions: () => Promise<void>;

  // Actions
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  updateOrderDetails: (id: string, updates: Partial<Order>) => Promise<void>;
  addOrder: (order: any) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  adjustInventory: (id: string, newQuantity: number) => void;
  restockInventoryItem: (sku: string, amount: number) => void;
  deductStemsFromInventory: (stems: { [sku: string]: number }) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProductDetails: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustRosePrices: () => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomerDetails: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addEvent: (event: EventItem) => Promise<void>;
  updateEventDetails: (id: string, updates: Partial<EventItem>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addSubscription: (subscription: SubscriptionItem) => Promise<void>;
  updateSubscriptionDetails: (id: string, updates: Partial<SubscriptionItem>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  resetToDemo: () => void;
  
  setActiveModal: (modal: AdminModal, payload?: Record<string, any>) => void;
  closeModal: () => void;
  toggleSubscriptionStatus: (id: string) => Promise<void>;

  payments: PaymentRecord[];
  paymentsLoading: boolean;
  fetchPayments: () => Promise<void>;
  addPayment: (payment: PaymentRecord) => void;
  updatePaymentDetails: (id: string, updates: Partial<PaymentRecord>) => void;

  statements: any[];
  statementsLoading: boolean;
  fetchCustomerStatements: () => Promise<void>;
  addCustomerStatement: (statement: any) => void;

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
      inventoryLoading: false,
      customersLoading: false,
      productsLoading: false,
      eventsLoading: false,
      subscriptionsLoading: false,

      fetchOrders: async () => {
        if (useAdminStore.getState().ordersLoading) return;
        set({ ordersLoading: true, ordersError: null });
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const seedDocRef = doc(db, 'systemSeeds', `ordersDemoSeed_${companyId}`);
          const seedDocSnap = await getDoc(seedDocRef);
          
          const ordersRef = collection(db, 'orders');
          const q = query(ordersRef, where('companyId', '==', companyId), orderBy('createdAt', 'desc'));
          let snapshot = await getDocs(q);

          if (!seedDocSnap.exists() && snapshot.empty) {
            for (const order of DEMO_ORDERS) {
              const deterministicId = `demo-order-${companyId}-${order.id.replace('ord-', '')}`;
              await setDoc(doc(db, 'orders', deterministicId), {
                ...order,
                id: deterministicId,
                documentId: deterministicId,
                companyId,
                orderNumber: order.id.toUpperCase(),
                orderNumberNormalized: order.id.toLowerCase().trim(),
                senderEmailNormalized: (DEMO_CUSTOMERS[0].email).toLowerCase().trim(),
                glPostingStatus: 'posted',
              });

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
                updatedAt: order.createdAt,
                companyId
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

      fetchInventory: async () => {
        if (useAdminStore.getState().inventoryLoading) return;
        set({ inventoryLoading: true });
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const seedDocRef = doc(db, 'systemSeeds', `inventoryDemoSeed_${companyId}`);
          const seedDocSnap = await getDoc(seedDocRef);
          
          const ref = collection(db, 'inventory');
          const q = query(ref, where('companyId', '==', companyId));
          let snapshot = await getDocs(q);

          if (!seedDocSnap.exists() && snapshot.empty) {
            for (const item of DEMO_INVENTORY) {
              const deterministicId = `demo-inv-${companyId}-${item.sku}`;
              await setDoc(doc(db, 'inventory', deterministicId), {
                ...item,
                id: deterministicId,
                companyId,
                createdAt: new Date().toISOString()
              });
            }
            await setDoc(seedDocRef, { seededAt: new Date().toISOString(), version: 1 });
            snapshot = await getDocs(q);
          }

          const parsed = snapshot.docs.map(doc => normalizeInventoryItem({ id: doc.id, ...doc.data() }));
          set({ inventory: parsed });
        } catch (e) {
          console.error("Failed to fetch inventory:", e);
        } finally {
          set({ inventoryLoading: false });
        }
      },

      fetchCustomers: async () => {
        if (useAdminStore.getState().customersLoading) return;
        set({ customersLoading: true });
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const seedDocRef = doc(db, 'systemSeeds', `customersDemoSeed_${companyId}`);
          const seedDocSnap = await getDoc(seedDocRef);
          
          const ref = collection(db, 'customers');
          const q = query(ref, where('companyId', '==', companyId));
          let snapshot = await getDocs(q);

          if (!seedDocSnap.exists() && snapshot.empty) {
            for (const cust of DEMO_CUSTOMERS) {
              const deterministicId = `demo-cust-${companyId}-${cust.email.replace(/[@.]/g, '_')}`;
              await setDoc(doc(db, 'customers', deterministicId), {
                ...cust,
                id: deterministicId,
                companyId,
                createdAt: new Date().toISOString()
              });
            }
            await setDoc(seedDocRef, { seededAt: new Date().toISOString(), version: 1 });
            snapshot = await getDocs(q);
          }

          const parsed = snapshot.docs.map(doc => normalizeCustomer({ id: doc.id, ...doc.data() }));
          set({ customers: parsed });
        } catch (e) {
          console.error("Failed to fetch customers:", e);
        } finally {
          set({ customersLoading: false });
        }
      },

      fetchProducts: async () => {
        if (useAdminStore.getState().productsLoading) return;
        set({ productsLoading: true });
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const seedDocRef = doc(db, 'systemSeeds', `productsDemoSeed_${companyId}`);
          const seedDocSnap = await getDoc(seedDocRef);
          
          const ref = collection(db, 'products_admin');
          const q = query(ref, where('companyId', '==', companyId));
          let snapshot = await getDocs(q);

          if (!seedDocSnap.exists() && snapshot.empty) {
            for (const prod of PRODUCTS) {
              const deterministicId = `demo-prod-${companyId}-${prod.id}`;
              await setDoc(doc(db, 'products_admin', deterministicId), {
                ...prod,
                id: deterministicId,
                companyId,
                productStatus: 'active',
                createdAt: new Date().toISOString()
              });
            }
            await setDoc(seedDocRef, { seededAt: new Date().toISOString(), version: 1 });
            snapshot = await getDocs(q);
          }

          const parsed = snapshot.docs.map(doc => normalizeProduct({ id: doc.id, ...doc.data() }));
          set({ products: parsed });
        } catch (e) {
          console.error("Failed to fetch products:", e);
        } finally {
          set({ productsLoading: false });
        }
      },

      fetchEvents: async () => {
        if (useAdminStore.getState().eventsLoading) return;
        set({ eventsLoading: true });
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const seedDocRef = doc(db, 'systemSeeds', `eventsDemoSeed_${companyId}`);
          const seedDocSnap = await getDoc(seedDocRef);
          
          const ref = collection(db, 'events');
          const q = query(ref, where('companyId', '==', companyId));
          let snapshot = await getDocs(q);

          if (!seedDocSnap.exists() && snapshot.empty) {
            for (const ev of DEMO_EVENTS) {
              const deterministicId = `demo-event-${companyId}-${ev.id}`;
              await setDoc(doc(db, 'events', deterministicId), {
                ...ev,
                id: deterministicId,
                companyId,
                createdAt: new Date().toISOString()
              });
            }
            await setDoc(seedDocRef, { seededAt: new Date().toISOString(), version: 1 });
            snapshot = await getDocs(q);
          }

          const parsed = snapshot.docs.map(doc => normalizeEvent({ id: doc.id, ...doc.data() }));
          set({ events: parsed });
        } catch (e) {
          console.error("Failed to fetch events:", e);
        } finally {
          set({ eventsLoading: false });
        }
      },

      fetchSubscriptions: async () => {
        if (useAdminStore.getState().subscriptionsLoading) return;
        set({ subscriptionsLoading: true });
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const seedDocRef = doc(db, 'systemSeeds', `subscriptionsDemoSeed_${companyId}`);
          const seedDocSnap = await getDoc(seedDocRef);
          
          const ref = collection(db, 'subscriptions');
          const q = query(ref, where('companyId', '==', companyId));
          let snapshot = await getDocs(q);

          if (!seedDocSnap.exists() && snapshot.empty) {
            for (const sub of DEMO_SUBSCRIPTIONS) {
              const deterministicId = `demo-sub-${companyId}-${sub.id}`;
              await setDoc(doc(db, 'subscriptions', deterministicId), {
                ...sub,
                id: deterministicId,
                companyId,
                createdAt: new Date().toISOString()
              });
            }
            await setDoc(seedDocRef, { seededAt: new Date().toISOString(), version: 1 });
            snapshot = await getDocs(q);
          }

          const parsed = snapshot.docs.map(doc => normalizeSubscription({ id: doc.id, ...doc.data() }));
          set({ subscriptions: parsed });
        } catch (e) {
          console.error("Failed to fetch subscriptions:", e);
        } finally {
          set({ subscriptionsLoading: false });
        }
      },

      postOrderFinancialsAction: async (orderId: string) => {
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const jeId = await postOrderFinancials(orderId, companyId, 'Admin');
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

          if (status === 'delivered') {
            await postCOGSForDeliveredOrder(id, 'Admin');
          }

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
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const docRef = await addDoc(collection(db, 'orders'), {
            ...order,
            companyId,
            createdAt: new Date().toISOString()
          });
          const normalized = normalizeOrder({ ...order, id: docRef.id, documentId: docRef.id, companyId });
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

      updateInventoryItem: async (id, updates) => {
        try {
          const ref = doc(db, 'inventory', id);
          await updateDoc(ref, updates);
          set((state) => ({
            inventory: state.inventory.map(i => i.id === id ? { ...i, ...updates } : i)
          }));
        } catch (e) {
          console.error("Failed to update inventory item:", e);
        }
      },

      deleteInventoryItem: async (id) => {
        try {
          const ref = doc(db, 'inventory', id);
          await deleteDoc(ref);
          set((state) => ({
            inventory: state.inventory.filter(i => i.id !== id)
          }));
        } catch (e) {
          console.error("Failed to delete inventory item:", e);
        }
      },

      addProduct: async (product) => {
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const docRef = await addDoc(collection(db, 'products_admin'), {
            ...product,
            companyId,
            productStatus: 'active',
            createdAt: new Date().toISOString()
          });
          const normalized = normalizeProduct({ ...product, id: docRef.id });
          set((state) => ({
            products: [normalized, ...state.products]
          }));
        } catch (e) {
          console.error("Failed to add product:", e);
        }
      },

      updateProductDetails: async (id, updates) => {
        try {
          const ref = doc(db, 'products_admin', id);
          await updateDoc(ref, updates);
          set((state) => ({
            products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
          }));
        } catch (e) {
          console.error("Failed to update product details:", e);
        }
      },

      deleteProduct: async (id) => {
        try {
          const ref = doc(db, 'products_admin', id);
          await deleteDoc(ref);
          set((state) => ({
            products: state.products.filter(p => p.id !== id)
          }));
        } catch (e) {
          console.error("Failed to delete product:", e);
        }
      },

      adjustRosePrices: async () => {
        const roses = get().products.filter(p => 
          p.name.toLowerCase().includes('rose') || 
          (p.category && p.category.toLowerCase().includes('rose')) || 
          (p.tags && p.tags.some(t => t.toLowerCase().includes('rose')))
        );
        for (const rose of roses) {
          const newPrice = Math.round(rose.price * 1.15);
          await updateDoc(doc(db, 'products_admin', rose.id), { price: newPrice });
        }
        set((state) => ({
          products: state.products.map(p => {
            const isRose = p.name.toLowerCase().includes('rose') || 
                           p.category.toLowerCase().includes('rose') || 
                           p.tags.some(t => t.toLowerCase().includes('rose'));
            if (isRose) {
              return { ...p, price: Math.round(p.price * 1.15) };
            }
            return p;
          })
        }));
      },

      addCustomer: async (customer) => {
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const docRef = await addDoc(collection(db, 'customers'), {
            ...customer,
            companyId,
            createdAt: new Date().toISOString()
          });
          const normalized = normalizeCustomer({ ...customer, id: docRef.id });
          set((state) => ({
            customers: [normalized, ...state.customers]
          }));
        } catch (e) {
          console.error("Failed to add customer:", e);
          throw e;
        }
      },

      updateCustomerDetails: async (id, updates) => {
        try {
          const ref = doc(db, 'customers', id);
          await updateDoc(ref, updates);
          set((state) => ({
            customers: state.customers.map(c => c.id === id ? { ...c, ...updates } : c)
          }));
        } catch (e) {
          console.error("Failed to update customer details:", e);
        }
      },

      deleteCustomer: async (id) => {
        try {
          const ref = doc(db, 'customers', id);
          await deleteDoc(ref);
          set((state) => ({
            customers: state.customers.filter(c => c.id !== id)
          }));
        } catch (e) {
          console.error("Failed to delete customer:", e);
        }
      },

      addEvent: async (event) => {
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const docRef = await addDoc(collection(db, 'events'), {
            ...event,
            companyId,
            createdAt: new Date().toISOString()
          });
          const normalized = normalizeEvent({ ...event, id: docRef.id });
          set((state) => ({
            events: [normalized, ...state.events]
          }));
        } catch (e) {
          console.error("Failed to add event:", e);
        }
      },

      addSubscription: async (subscription) => {
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const docRef = await addDoc(collection(db, 'subscriptions'), {
            ...subscription,
            companyId,
            createdAt: new Date().toISOString()
          });
          const normalized = normalizeSubscription({ ...subscription, id: docRef.id });
          set((state) => ({
            subscriptions: [normalized, ...state.subscriptions]
          }));
        } catch (e) {
          console.error("Failed to add subscription:", e);
        }
      },

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
      
      toggleSubscriptionStatus: async (id) => {
        const sub = get().subscriptions.find(s => s.id === id);
        if (!sub) return;
        const newStatus = sub.status === 'active' ? 'paused' : 'active';
        try {
          await updateDoc(doc(db, 'subscriptions', id), { status: newStatus });
          set((state) => ({
            subscriptions: state.subscriptions.map(s => 
              s.id === id ? { ...s, status: newStatus } : s
            )
          }));
        } catch (e) {
          console.error("Failed to toggle subscription status:", e);
        }
      },

      updateSubscriptionDetails: async (id, updates) => {
        try {
          const ref = doc(db, 'subscriptions', id);
          await updateDoc(ref, updates);
          set((state) => ({
            subscriptions: state.subscriptions.map(s => s.id === id ? { ...s, ...updates } : s)
          }));
        } catch (e) {
          console.error("Failed to update subscription details:", e);
        }
      },

      deleteSubscription: async (id) => {
        try {
          const ref = doc(db, 'subscriptions', id);
          await deleteDoc(ref);
          set((state) => ({
            subscriptions: state.subscriptions.filter(s => s.id !== id)
          }));
        } catch (e) {
          console.error("Failed to delete subscription:", e);
        }
      },

      updateEventDetails: async (id, updates) => {
        try {
          const ref = doc(db, 'events', id);
          await updateDoc(ref, updates);
          set((state) => ({
            events: state.events.map(e => e.id === id ? { ...e, ...updates } : e)
          }));
        } catch (e) {
          console.error("Failed to update event details:", e);
        }
      },

      deleteEvent: async (id) => {
        try {
          const ref = doc(db, 'events', id);
          await deleteDoc(ref);
          set((state) => ({
            events: state.events.filter(e => e.id !== id)
          }));
        } catch (e) {
          console.error("Failed to delete event:", e);
        }
      },

      fetchPayments: async () => {
        set({ paymentsLoading: true });
        try {
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const snap = await getDocs(query(
            collection(db, 'payments'), 
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc')
          ));
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
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const snap = await getDocs(query(
            collection(db, 'customerStatements'), 
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc')
          ));
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
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const snap = await getDocs(query(
            collection(db, 'vendors'), 
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc')
          ));
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
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const snap = await getDocs(query(
            collection(db, 'purchaseOrders'), 
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc')
          ));
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
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const snap = await getDocs(query(
            collection(db, 'inventoryReceipts'), 
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc')
          ));
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
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const snap = await getDocs(query(
            collection(db, 'vendorBills'), 
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc')
          ));
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
          const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
          const snap = await getDocs(query(
            collection(db, 'vendorPayments'), 
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc')
          ));
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
        delete rest.inventoryLoading;
        delete rest.customersLoading;
        delete rest.productsLoading;
        delete rest.eventsLoading;
        delete rest.subscriptionsLoading;
        return rest as AdminState;
      }
    }
  )
);
