import { 
  type DeliveryProviderAdapter, 
  type DeliveryQuoteInput, 
  type DeliveryQuoteResult, 
  type CreateDeliveryInput, 
  type CreateDeliveryResult, 
  type CancelDeliveryInput, 
  type CancelDeliveryResult, 
  type DeliveryStatusInput, 
  type DeliveryStatusResult, 
  type DeliveryWebhookResult 
} from '../deliveryTypes';

export class MockDeliveryAdapter implements DeliveryProviderAdapter {
  provider = 'mock' as const;

  async getQuote(input: DeliveryQuoteInput): Promise<DeliveryQuoteResult> {
    const isUnserviceable = input.dropoffAddress.toLowerCase().includes('fail') || 
                           input.dropoffAddress.toLowerCase().includes('unserviceable');
    
    if (isUnserviceable) {
      return {
        provider: 'mock',
        serviceable: false,
        estimatedCost: 0,
        currency: 'USD',
        reasonUnavailable: 'Address is out of mock delivery service zone range.',
        rawResponse: { error: 'UNSERVICEABLE_ADDRESS' }
      };
    }

    // Default mock quote values
    const providerCost = 9.80; // Standard mock cost
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry
    const pickupTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const dropoffTime = new Date(Date.now() + 75 * 60 * 1000).toISOString();

    return {
      provider: 'mock',
      serviceable: true,
      estimatedCost: providerCost,
      currency: 'USD',
      expiresAt,
      externalQuoteId: `q_mock_${Math.random().toString(36).substring(2, 9)}`,
      estimatedPickupAt: pickupTime,
      estimatedDropoffAt: dropoffTime,
      rawResponse: { service_level: 'standard', base_fee: 9.80 }
    };
  }

  async createDelivery(_input: CreateDeliveryInput): Promise<CreateDeliveryResult> {
    const providerDeliveryId = `del_mock_${Math.random().toString(36).substring(2, 9)}`;
    const trackingUrl = `https://mock-delivery.track/orders/${providerDeliveryId}`;
    
    const pickupTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const dropoffTime = new Date(Date.now() + 75 * 60 * 1000).toISOString();

    return {
      providerDeliveryId,
      status: 'dispatch_requested',
      estimatedCost: 9.80,
      estimatedPickupAt: pickupTime,
      estimatedDropoffAt: dropoffTime,
      providerTrackingUrl: trackingUrl,
      rawResponse: { created_at: new Date().toISOString(), courier_assigned: false }
    };
  }

  async cancelDelivery(_input: CancelDeliveryInput): Promise<CancelDeliveryResult> {
    return {
      success: true,
      status: 'cancelled',
      rawResponse: { cancellation_fee: 0, cancelled_by: 'user' }
    };
  }

  async getDeliveryStatus(input: DeliveryStatusInput): Promise<DeliveryStatusResult> {
    return {
      status: 'courier_assigned',
      courierName: 'Julian V.',
      courierPhone: '555-0199',
      providerTrackingUrl: `https://mock-delivery.track/orders/${input.providerDeliveryId}`,
      estimatedDropoffAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      rawResponse: { driver_assigned: true, vehicle_type: 'car' }
    };
  }

  async handleWebhook(payload: any): Promise<DeliveryWebhookResult> {
    const statusMap: Record<string, any> = {
      'courier_assigned': 'courier_assigned',
      'pickup_ready': 'pickup_ready',
      'picked_up': 'picked_up',
      'in_transit': 'in_transit',
      'delivered': 'delivered',
      'failed': 'failed',
      'cancelled': 'cancelled'
    };

    const payloadStatus = payload?.status || 'delivered';
    const status = statusMap[payloadStatus] || 'delivered';

    return {
      deliveryId: payload?.deliveryId || 'unknown',
      status,
      courierName: payload?.courierName || 'Clara M.',
      courierPhone: payload?.courierPhone || '555-0211',
      providerTrackingUrl: payload?.trackingUrl || 'https://mock-delivery.track/orders/unknown',
      estimatedDropoffAt: payload?.estimatedDropoffAt || new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      photoUrl: payload?.photoUrl || null,
      signatureUrl: payload?.signatureUrl || null,
      rawPayload: payload
    };
  }
}
