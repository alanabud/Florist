export type DeliveryMethod = 'pickup' | 'in_house' | 'third_party' | 'manual_courier';
export type DeliveryProvider = 'uber_direct' | 'doordash_drive' | 'roadie' | 'manual' | 'mock';

export type DeliveryStatus =
  | 'draft'
  | 'quote_requested'
  | 'quoted'
  | 'dispatch_requested'
  | 'courier_assigned'
  | 'pickup_ready'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export interface DeliveryRecord {
  id: string; // Typically matches orderId
  companyId: string;
  orderId: string;
  customerId?: string;

  deliveryMethod: DeliveryMethod;
  provider: DeliveryProvider;
  status: DeliveryStatus;

  pickup: {
    companyLocationId: string;
    name: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
    instructions?: string;
    earliestPickupAt?: string;
    latestPickupAt?: string;
  };

  dropoff: {
    recipientName: string;
    recipientPhone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
    instructions?: string;
    earliestDropoffAt?: string;
    latestDropoffAt?: string;
  };

  quote: {
    providerQuoteId?: string;
    currency: string;
    estimatedProviderCost: number;
    customerDeliveryCharge: number;
    estimatedMargin: number;
    estimatedPickupAt?: string;
    estimatedDropoffAt?: string;
    expiresAt?: string;
    rawProviderResponseRef?: string;
  };

  dispatch: {
    providerDeliveryId?: string;
    providerTrackingUrl?: string;
    courierName?: string;
    courierPhone?: string;
    vehicleType?: string;
    proofOfDeliveryUrl?: string;
    signatureUrl?: string;
    photoUrl?: string;
    pinCode?: string;
    rawProviderResponseRef?: string;
  };

  financials: {
    deliveryRevenueAccountId?: string;
    deliveryExpenseAccountId?: string;
    providerCostFinal?: number;
    customerChargeFinal?: number;
    marginFinal?: number;
    journalEntryId?: string;
  };

  audit: {
    createdBy: string;
    createdAt: string;
    updatedBy?: string;
    updatedAt?: string;
    dispatchedBy?: string;
    dispatchedAt?: string;
    cancelledBy?: string;
    cancelledAt?: string;
    deliveredAt?: string;
  };

  providerMetadata?: Record<string, unknown>;
}

export interface DeliveryQuoteRecord {
  id: string;
  companyId: string;
  orderId: string;
  deliveryId?: string;

  provider: DeliveryProvider;
  status: 'requested' | 'available' | 'unavailable' | 'expired' | 'error';

  currency: string;
  estimatedCost: number;
  estimatedPickupAt?: string;
  estimatedDropoffAt?: string;
  expiresAt?: string;

  serviceable: boolean;
  reasonUnavailable?: string;

  externalQuoteId?: string;
  rawProviderResponseRef?: string;

  createdAt: string;
  createdBy: string;
}

export interface DeliveryEventRecord {
  id: string;
  companyId: string;
  deliveryId: string;
  orderId: string;

  provider: DeliveryProvider;
  eventType: string;

  previousStatus?: string;
  newStatus?: string;

  message?: string;
  rawPayloadRef?: string;

  receivedAt: string;
  processedAt?: string;
}

export interface DeliveryProviderConfig {
  id: string;
  companyId: string;
  provider: DeliveryProvider;

  enabled: boolean;
  environment: 'sandbox' | 'production';

  displayName: string;
  defaultMarkupType: 'flat' | 'percentage';
  defaultMarkupValue: number;
  minimumMarkupAmount?: number;

  maxDeliveryRadiusMiles?: number;
  minOrderValue?: number;

  autoDispatchEnabled: boolean;
  requireManagerApprovalOverAmount?: number;

  createdAt: string;
  updatedAt?: string;
}

// Adapters input/output signatures
export interface DeliveryQuoteInput {
  companyId: string;
  orderId: string;
  pickupAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupZip: string;
  pickupCountry: string;
  dropoffAddress: string;
  dropoffCity: string;
  dropoffState: string;
  dropoffZip: string;
  dropoffCountry: string;
  recipientName: string;
  recipientPhone?: string;
  customerDeliveryFeeCollected?: number;
}

export interface DeliveryQuoteResult {
  provider: DeliveryProvider;
  serviceable: boolean;
  estimatedCost: number;
  currency: string;
  expiresAt?: string;
  externalQuoteId?: string;
  estimatedPickupAt?: string;
  estimatedDropoffAt?: string;
  reasonUnavailable?: string;
  rawResponse?: any;
}

export interface CreateDeliveryInput {
  deliveryId: string;
  companyId: string;
  orderId: string;
  quoteId?: string;
  externalQuoteId?: string;
  pickupAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupZip: string;
  pickupCountry: string;
  dropoffAddress: string;
  dropoffCity: string;
  dropoffState: string;
  dropoffZip: string;
  dropoffCountry: string;
  recipientName: string;
  recipientPhone?: string;
  instructions?: string;
}

export interface CreateDeliveryResult {
  providerDeliveryId: string;
  status: DeliveryStatus;
  estimatedCost?: number;
  estimatedPickupAt?: string;
  estimatedDropoffAt?: string;
  providerTrackingUrl?: string;
  rawResponse?: any;
}

export interface CancelDeliveryInput {
  deliveryId: string;
  companyId: string;
  providerDeliveryId: string;
  reason?: string;
}

export interface CancelDeliveryResult {
  success: boolean;
  status: DeliveryStatus;
  rawResponse?: any;
}

export interface DeliveryStatusInput {
  deliveryId: string;
  companyId: string;
  providerDeliveryId: string;
}

export interface DeliveryStatusResult {
  status: DeliveryStatus;
  courierName?: string;
  courierPhone?: string;
  providerTrackingUrl?: string;
  estimatedDropoffAt?: string;
  photoUrl?: string;
  signatureUrl?: string;
  rawResponse?: any;
}

export interface DeliveryWebhookResult {
  deliveryId: string;
  status: DeliveryStatus;
  courierName?: string;
  courierPhone?: string;
  providerTrackingUrl?: string;
  estimatedDropoffAt?: string;
  photoUrl?: string;
  signatureUrl?: string;
  rawPayload?: any;
}

export interface DeliveryProviderAdapter {
  provider: DeliveryProvider;
  getQuote(input: DeliveryQuoteInput): Promise<DeliveryQuoteResult>;
  createDelivery(input: CreateDeliveryInput): Promise<CreateDeliveryResult>;
  cancelDelivery(input: CancelDeliveryInput): Promise<CancelDeliveryResult>;
  getDeliveryStatus(input: DeliveryStatusInput): Promise<DeliveryStatusResult>;
  handleWebhook(payload: unknown): Promise<DeliveryWebhookResult>;
}
