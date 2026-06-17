import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, writeBatch 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { postJournalEntry } from '../financeService';
import { writeAuditLog } from '../auditService';
import { MockDeliveryAdapter } from './providers/mockDeliveryAdapter';
import { ManualCourierAdapter } from './providers/manualCourierAdapter';
import { 
  type DeliveryRecord, 
  type DeliveryQuoteRecord, 
  type DeliveryProviderConfig, 
  type DeliveryQuoteInput, 
  type DeliveryQuoteResult, 
  type CreateDeliveryInput, 
  type CancelDeliveryInput, 
  type CancelDeliveryResult, 
  type DeliveryStatusInput, 
  type DeliveryStatusResult, 
  type DeliveryProvider
} from './deliveryTypes';

// Initialise adapters
const adapters = {
  mock: new MockDeliveryAdapter(),
  manual: new ManualCourierAdapter()
};

/**
 * Seed default configs for a company if they do not exist.
 */
export async function ensureProviderConfigs(companyId: string): Promise<void> {
  const providers: DeliveryProvider[] = ['mock', 'manual', 'uber_direct', 'doordash_drive', 'roadie'];
  
  for (const provider of providers) {
    const configId = `${companyId}_${provider}`;
    const docRef = doc(db, 'deliveryProviderConfigs', configId);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) {
      const defaultMarkupType = 'flat';
      const defaultMarkupValue = 5.00;
      const minimumMarkupAmount = 5.00;
      
      const displayName = provider === 'mock' 
        ? 'Standard Mock Courier' 
        : (provider === 'manual' ? 'Manual Local Courier' : `${provider.replace('_', ' ').toUpperCase()}`);

      const config: DeliveryProviderConfig = {
        id: configId,
        companyId,
        provider,
        enabled: provider === 'mock' || provider === 'manual',
        environment: 'sandbox',
        displayName,
        defaultMarkupType,
        defaultMarkupValue,
        minimumMarkupAmount,
        autoDispatchEnabled: false,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(docRef, config);
    }
  }
}

/**
 * Request delivery quotes from all active providers.
 */
export async function requestDeliveryQuotes(input: DeliveryQuoteInput): Promise<DeliveryQuoteResult[]> {
  const companyId = input.companyId || 'DEFAULT_COMPANY';
  await ensureProviderConfigs(companyId);

  // Fetch enabled provider configurations
  const configsRef = collection(db, 'deliveryProviderConfigs');
  const q = query(configsRef, where('companyId', '==', companyId), where('enabled', '==', true));
  const configsSnap = await getDocs(q);
  const activeConfigs = configsSnap.docs.map(d => d.data() as DeliveryProviderConfig);

  const results: DeliveryQuoteResult[] = [];

  for (const config of activeConfigs) {
    const provider = config.provider;
    
    // In Phase 1, only mock and manual adapters are supported
    const adapter = (adapters as any)[provider];
    if (!adapter) {
      // Simulate failure / unserviceability for other providers
      results.push({
        provider,
        serviceable: false,
        estimatedCost: 0,
        currency: 'USD',
        reasonUnavailable: 'Provider API adapter integration pending deployment in Phase 2.',
        rawResponse: null
      });
      continue;
    }

    try {
      const quoteRes = await adapter.getQuote(input);
      
      if (quoteRes.serviceable) {
        // Calculate customer charge based on provider markup configuration
        let markup = config.defaultMarkupValue;
        if (config.defaultMarkupType === 'percentage') {
          markup = quoteRes.estimatedCost * (config.defaultMarkupValue / 100);
          if (config.minimumMarkupAmount && markup < config.minimumMarkupAmount) {
            markup = config.minimumMarkupAmount;
          }
        } else {
          // Flat markup
          if (config.minimumMarkupAmount && markup < config.minimumMarkupAmount) {
            markup = config.minimumMarkupAmount;
          }
        }
        
        const customerCharge = quoteRes.estimatedCost + markup;
        
        // Write the quote record to Firestore
        const quoteId = `q_${provider}_${Math.random().toString(36).substring(2, 9)}`;
        const quoteRecord: DeliveryQuoteRecord = {
          id: quoteId,
          companyId,
          orderId: input.orderId,
          provider,
          status: 'available',
          currency: quoteRes.currency,
          estimatedCost: quoteRes.estimatedCost,
          estimatedPickupAt: quoteRes.estimatedPickupAt,
          estimatedDropoffAt: quoteRes.estimatedDropoffAt,
          expiresAt: quoteRes.expiresAt,
          serviceable: true,
          externalQuoteId: quoteRes.externalQuoteId || quoteId,
          rawProviderResponseRef: JSON.stringify(quoteRes.rawResponse),
          createdAt: new Date().toISOString(),
          createdBy: 'Logistics'
        };

        await setDoc(doc(db, 'deliveryQuotes', quoteId), quoteRecord);
        
        results.push({
          ...quoteRes,
          estimatedCost: customerCharge, // Expose final customer-facing cost
          rawResponse: { ...quoteRes.rawResponse, base_cost: quoteRes.estimatedCost, final_charge: customerCharge, quoteId }
        });
      } else {
        results.push(quoteRes);
      }
    } catch (err: any) {
      console.error(`Error requesting quote from provider ${provider}:`, err);
      results.push({
        provider,
        serviceable: false,
        estimatedCost: 0,
        currency: 'USD',
        reasonUnavailable: err.message || 'Unknown provider query error',
        rawResponse: null
      });
    }
  }

  return results;
}

/**
 * Dispatch a delivery request using a selected quote.
 */
export async function dispatchDelivery(
  deliveryId: string, 
  provider: DeliveryProvider, 
  quoteId: string,
  userRole: string = 'dispatcher',
  actorEmail: string = 'Logistics'
): Promise<DeliveryRecord> {
  const quoteRef = doc(db, 'deliveryQuotes', quoteId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) {
    throw new Error('Quote details not found.');
  }

  const quoteData = quoteSnap.data() as DeliveryQuoteRecord;
  const companyId = quoteData.companyId;

  // Retrieve linked order doc
  const orderRef = doc(db, 'orders', quoteData.orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) {
    throw new Error('Associated order not found.');
  }

  const orderData = orderSnap.data()!;
  
  // Guard: Compare collected delivery fee with actual provider cost
  const collectedFee = orderData.deliveryFee || 0;
  const isNegativeMargin = collectedFee < quoteData.estimatedCost;
  const isManager = ['owner', 'admin', 'manager'].includes(userRole);

  if (isNegativeMargin && !isManager) {
    throw new Error('Existing order delivery fee is lower than provider cost. Manager approval required.');
  }

  const adapter = (adapters as any)[provider];
  if (!adapter) {
    throw new Error(`Provider adapter for ${provider} not available in this phase.`);
  }

  // Request provider delivery creation
  const createInput: CreateDeliveryInput = {
    deliveryId,
    companyId,
    orderId: quoteData.orderId,
    quoteId: quoteData.id,
    externalQuoteId: quoteData.externalQuoteId,
    pickupAddress: orderData.storeLocationAddress || '123 Flower Lane',
    pickupCity: 'New York',
    pickupState: 'NY',
    pickupZip: '10001',
    pickupCountry: 'US',
    dropoffAddress: orderData.addressLine1 || '',
    dropoffCity: orderData.city || '',
    dropoffState: orderData.state || '',
    dropoffZip: orderData.zipCode || '',
    dropoffCountry: 'US',
    recipientName: orderData.recipientName || orderData.customerName,
    recipientPhone: orderData.recipientPhone || ''
  };

  const dispatchRes = await adapter.createDelivery(createInput);

  // Generate public tracking token
  const publicTrackingToken = `track_${Math.random().toString(36).substring(2, 15)}`;

  // Construct primary delivery record
  const deliveryRecord: DeliveryRecord = {
    id: deliveryId,
    companyId,
    orderId: quoteData.orderId,
    customerId: orderData.customerId || 'guest',
    deliveryMethod: 'third_party',
    provider,
    status: dispatchRes.status,
    pickup: {
      companyLocationId: orderData.storeLocation || 'default',
      name: 'BloomPro Studio Store',
      addressLine1: createInput.pickupAddress,
      city: createInput.pickupCity,
      state: createInput.pickupState,
      postalCode: createInput.pickupZip,
      country: createInput.pickupCountry
    },
    dropoff: {
      recipientName: createInput.recipientName,
      recipientPhone: createInput.recipientPhone,
      addressLine1: createInput.dropoffAddress,
      addressLine2: orderData.addressLine2 || '',
      city: createInput.dropoffCity,
      state: createInput.dropoffState,
      postalCode: createInput.dropoffZip,
      country: createInput.dropoffCountry,
      instructions: orderData.deliveryInstructions || ''
    },
    quote: {
      providerQuoteId: quoteData.externalQuoteId,
      currency: quoteData.currency,
      estimatedProviderCost: quoteData.estimatedCost,
      customerDeliveryCharge: collectedFee,
      estimatedMargin: collectedFee - quoteData.estimatedCost,
      estimatedPickupAt: quoteData.estimatedPickupAt,
      estimatedDropoffAt: quoteData.estimatedDropoffAt,
      expiresAt: quoteData.expiresAt
    },
    dispatch: {
      providerDeliveryId: dispatchRes.providerDeliveryId,
      providerTrackingUrl: dispatchRes.providerTrackingUrl || '',
      vehicleType: 'Car'
    },
    financials: {
      deliveryRevenueAccountId: '4100', // Standard Delivery Revenue Account
      deliveryExpenseAccountId: '5600', // Standard Delivery Expense Account
      providerCostFinal: quoteData.estimatedCost,
      customerChargeFinal: collectedFee,
      marginFinal: collectedFee - quoteData.estimatedCost
    },
    audit: {
      createdBy: actorEmail,
      createdAt: new Date().toISOString(),
      dispatchedBy: actorEmail,
      dispatchedAt: new Date().toISOString()
    },
    providerMetadata: {
      publicTrackingToken
    }
  };

  // Construct sanitized public tracking document
  const publicTrackingRecord = {
    companyId,
    companyDisplayName: 'BloomPro Studio',
    orderDisplayNumber: orderData.orderNumber || orderData.id.substring(0, 8).toUpperCase(),
    recipientFirstName: (orderData.recipientName || orderData.customerName).split(' ')[0],
    status: dispatchRes.status,
    etaWindowStart: quoteData.estimatedPickupAt || '',
    etaWindowEnd: quoteData.estimatedDropoffAt || '',
    courierFirstName: 'Assigned Courier',
    courierVehicleLabel: 'Car',
    trackingUrl: `/track-delivery/${publicTrackingToken}`,
    lastKnownLocationApprox: null,
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // Valid 48hrs
  };

  // Perform Firestore writes inside a batch
  const batch = writeBatch(db);
  batch.set(doc(db, 'deliveries', deliveryId), deliveryRecord);
  batch.set(doc(db, 'publicDeliveryTracking', publicTrackingToken), publicTrackingRecord);
  
  // Update order status to out_for_delivery
  batch.update(orderRef, {
    status: 'out_for_delivery',
    courier: provider === 'mock' ? 'Julian V.' : 'Local Courier',
    routeNumber: 'Third-Party Dispatch',
    dispatchTime: new Date().toISOString(),
    lastUpdatedBy: actorEmail,
    lastUpdatedDate: new Date().toISOString()
  });

  await batch.commit();

  // Post Double-Entry accounting records for third-party courier cost
  // Debit: 5600 Delivery Expense
  // Credit: 2300 Third-Party Courier Payable
  try {
    const coaSnapshot = await getDocs(collection(db, 'chartOfAccounts'));
    const coaList = coaSnapshot.docs.map(d => d.data());
    
    const expenseAcct = coaList.find(a => a.code === '5600') || { id: '5600_default', name: 'Delivery Expense' };
    const payableAcct = coaList.find(a => a.code === '2300') || { id: '2300_default', name: 'Third-Party Courier Payable' };

    const jeId = await postJournalEntry({
      orderId: deliveryId,
      companyId,
      createdBy: actorEmail,
      description: `Recognize third-party courier delivery cost for Order #${orderData.orderNumber || deliveryId.substring(0, 8)}`,
      lines: [
        {
          account: 'Delivery Expense',
          debit: quoteData.estimatedCost,
          credit: 0,
          accountId: expenseAcct.id || '',
          accountName: expenseAcct.name || 'Delivery Expense'
        },
        {
          account: 'Third-Party Courier Payable',
          debit: 0,
          credit: quoteData.estimatedCost,
          accountId: payableAcct.id || '',
          accountName: payableAcct.name || 'Third-Party Courier Payable'
        }
      ],
      sourceType: 'delivery',
      sourceId: deliveryId,
      sourceLabel: 'Delivery Cost',
      createdAt: new Date()
    });

    await updateDoc(doc(db, 'deliveries', deliveryId), {
      'financials.journalEntryId': jeId
    });

    deliveryRecord.financials.journalEntryId = jeId;
  } catch (accountingErr) {
    console.error('Failed to post delivery cost journal entry:', accountingErr);
  }

  // Log audit timeline
  await writeAuditLog({
    companyId,
    actor: actorEmail,
    action: 'DELIVERY_STATUS_CHANGE',
    entityType: 'order',
    entityId: quoteData.orderId,
    before: { status: orderData.status },
    after: { status: 'out_for_delivery', provider, cost: quoteData.estimatedCost }
  });

  return deliveryRecord;
}

/**
 * Cancel a dispatched delivery.
 */
export async function cancelDelivery(deliveryId: string, actorEmail: string = 'Logistics'): Promise<CancelDeliveryResult> {
  const deliveryRef = doc(db, 'deliveries', deliveryId);
  const deliverySnap = await getDoc(deliveryRef);
  if (!deliverySnap.exists()) {
    throw new Error('Delivery record not found.');
  }

  const deliveryData = deliverySnap.data() as DeliveryRecord;
  const provider = deliveryData.provider;
  const companyId = deliveryData.companyId;

  const adapter = (adapters as any)[provider];
  if (!adapter) {
    throw new Error(`Provider adapter for ${provider} not available in this phase.`);
  }

  const cancelInput: CancelDeliveryInput = {
    deliveryId,
    companyId,
    providerDeliveryId: deliveryData.dispatch.providerDeliveryId || ''
  };

  const cancelRes = await adapter.cancelDelivery(cancelInput);

  if (cancelRes.success) {
    const batch = writeBatch(db);
    batch.update(deliveryRef, {
      status: 'cancelled',
      'audit.cancelledBy': actorEmail,
      'audit.cancelledAt': new Date().toISOString()
    });

    // Update public tracking status if token exists
    const token = deliveryData.providerMetadata?.publicTrackingToken as string;
    if (token) {
      batch.update(doc(db, 'publicDeliveryTracking', token), {
        status: 'cancelled',
        updatedAt: new Date().toISOString()
      });
    }

    // Set order status to delivery_cancelled (not full cancel of order unless manager does it)
    batch.update(doc(db, 'orders', deliveryData.orderId), {
      status: 'delivery_cancelled',
      lastUpdatedBy: actorEmail,
      lastUpdatedDate: new Date().toISOString()
    });

    await batch.commit();

    await writeAuditLog({
      companyId,
      actor: actorEmail,
      action: 'DELIVERY_STATUS_CHANGE',
      entityType: 'order',
      entityId: deliveryData.orderId,
      before: { status: deliveryData.status },
      after: { status: 'cancelled' }
    });
  }

  return cancelRes;
}

/**
 * Pull delivery status updates.
 */
export async function trackDeliveryStatus(deliveryId: string): Promise<DeliveryStatusResult> {
  const deliveryRef = doc(db, 'deliveries', deliveryId);
  const deliverySnap = await getDoc(deliveryRef);
  if (!deliverySnap.exists()) {
    throw new Error('Delivery record not found.');
  }

  const deliveryData = deliverySnap.data() as DeliveryRecord;
  const adapter = (adapters as any)[deliveryData.provider];
  if (!adapter) {
    throw new Error(`Provider adapter for ${deliveryData.provider} not available.`);
  }

  const statusInput: DeliveryStatusInput = {
    deliveryId,
    companyId: deliveryData.companyId,
    providerDeliveryId: deliveryData.dispatch.providerDeliveryId || ''
  };

  const statusRes = await adapter.getDeliveryStatus(statusInput);

  // Update Firestore delivery document
  await updateDoc(deliveryRef, {
    status: statusRes.status,
    'dispatch.courierName': statusRes.courierName || deliveryData.dispatch.courierName,
    'dispatch.courierPhone': statusRes.courierPhone || deliveryData.dispatch.courierPhone,
    'dispatch.providerTrackingUrl': statusRes.providerTrackingUrl || deliveryData.dispatch.providerTrackingUrl,
    'dispatch.photoUrl': statusRes.photoUrl || deliveryData.dispatch.photoUrl,
    'dispatch.signatureUrl': statusRes.signatureUrl || deliveryData.dispatch.signatureUrl
  });

  return statusRes;
}

/**
 * Handle incoming third-party webhooks with strict IDEMPOTENCY check.
 */
export async function handleWebhookNotification(provider: DeliveryProvider, payload: any): Promise<void> {
  const providerDeliveryId = payload?.providerDeliveryId || payload?.delivery_id || 'unknown';
  const eventName = payload?.event_name || payload?.event_type || 'status_update';
  const eventCreatedAt = payload?.created_at || new Date().toISOString();

  // Enforce idempotency key mapping
  const eventId = `${provider}_${providerDeliveryId}_${eventName}_${eventCreatedAt}`.replace(/\s+/g, '_');
  const eventRef = doc(db, 'deliveryEvents', eventId);
  
  const eventSnap = await getDoc(eventRef);
  if (eventSnap.exists()) {
    console.log(`[Idempotent webhook] Event already processed: ${eventId}`);
    return;
  }

  // Resolve matching delivery in Firestore
  const deliveriesRef = collection(db, 'deliveries');
  const q = query(deliveriesRef, where('dispatch.providerDeliveryId', '==', providerDeliveryId));
  const deliverySnap = await getDocs(q);

  if (deliverySnap.empty) {
    console.warn(`No active delivery found matching providerDeliveryId: ${providerDeliveryId}`);
    return;
  }

  const deliveryDoc = deliverySnap.docs[0];
  const deliveryData = deliveryDoc.data() as DeliveryRecord;
  const companyId = deliveryData.companyId;

  // Insert event record first to lock execution block
  await setDoc(eventRef, {
    id: eventId,
    companyId,
    deliveryId: deliveryData.id,
    orderId: deliveryData.orderId,
    provider,
    eventType: eventName,
    receivedAt: new Date().toISOString(),
    processedAt: new Date().toISOString()
  });

  const adapter = (adapters as any)[provider];
  if (!adapter) return;

  const normalized = await adapter.handleWebhook(payload);
  const newStatus = normalized.status;

  const batch = writeBatch(db);
  batch.update(doc(db, 'deliveries', deliveryData.id), {
    status: newStatus,
    'dispatch.courierName': normalized.courierName || deliveryData.dispatch.courierName,
    'dispatch.courierPhone': normalized.courierPhone || deliveryData.dispatch.courierPhone,
    'dispatch.providerTrackingUrl': normalized.providerTrackingUrl || deliveryData.dispatch.providerTrackingUrl,
    'dispatch.photoUrl': normalized.photoUrl || deliveryData.dispatch.photoUrl,
    'dispatch.signatureUrl': normalized.signatureUrl || deliveryData.dispatch.signatureUrl
  });

  // Update public tracking status
  const token = deliveryData.providerMetadata?.publicTrackingToken as string;
  if (token) {
    batch.update(doc(db, 'publicDeliveryTracking', token), {
      status: newStatus,
      courierFirstName: (normalized.courierName || 'Courier').split(' ')[0],
      updatedAt: new Date().toISOString()
    });
  }

  // Map delivery status to order status
  let orderStatus: any = null;
  if (newStatus === 'delivered') {
    orderStatus = 'delivered';
  } else if (newStatus === 'failed') {
    orderStatus = 'delivery_exception';
  } else if (newStatus === 'cancelled') {
    orderStatus = 'delivery_cancelled';
  } else if (['courier_assigned', 'picked_up', 'in_transit'].includes(newStatus)) {
    orderStatus = 'out_for_delivery';
  }

  if (orderStatus) {
    batch.update(doc(db, 'orders', deliveryData.orderId), {
      status: orderStatus,
      lastUpdatedBy: 'Webhook-Agent',
      lastUpdatedDate: new Date().toISOString()
    });
  }

  await batch.commit();

  await writeAuditLog({
    companyId,
    actor: 'Webhook-Agent',
    action: 'DELIVERY_STATUS_CHANGE',
    entityType: 'order',
    entityId: deliveryData.orderId,
    before: { status: deliveryData.status },
    after: { status: newStatus }
  });
}
