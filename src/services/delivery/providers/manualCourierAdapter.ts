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

export class ManualCourierAdapter implements DeliveryProviderAdapter {
  provider = 'manual' as const;

  async getQuote(input: DeliveryQuoteInput): Promise<DeliveryQuoteResult> {
    const cost = input.customerDeliveryFeeCollected !== undefined ? input.customerDeliveryFeeCollected : 12.00;
    
    return {
      provider: 'manual',
      serviceable: true,
      estimatedCost: cost,
      currency: 'USD',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24hr validity
      externalQuoteId: `q_manual_${Date.now().toString(36)}`,
      estimatedPickupAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      estimatedDropoffAt: new Date(Date.now() + 180 * 60 * 1000).toISOString(),
      rawResponse: { type: 'manual_quote', amount: cost }
    };
  }

  async createDelivery(_input: CreateDeliveryInput): Promise<CreateDeliveryResult> {
    const providerDeliveryId = `del_man_${Date.now().toString(36)}`;
    
    return {
      providerDeliveryId,
      status: 'courier_assigned',
      estimatedCost: 12.00,
      estimatedPickupAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      estimatedDropoffAt: new Date(Date.now() + 180 * 60 * 1000).toISOString(),
      providerTrackingUrl: '',
      rawResponse: { assigned_at: new Date().toISOString() }
    };
  }

  async cancelDelivery(input: CancelDeliveryInput): Promise<CancelDeliveryResult> {
    return {
      success: true,
      status: 'cancelled',
      rawResponse: { reason: input.reason || 'user_request' }
    };
  }

  async getDeliveryStatus(_input: DeliveryStatusInput): Promise<DeliveryStatusResult> {
    return {
      status: 'delivered',
      courierName: 'Manual Courier Services',
      providerTrackingUrl: '',
      rawResponse: { status: 'delivered' }
    };
  }

  async handleWebhook(payload: any): Promise<DeliveryWebhookResult> {
    return {
      deliveryId: payload?.deliveryId || 'unknown',
      status: payload?.status || 'delivered',
      courierName: payload?.courierName || 'Local Delivery Agent',
      courierPhone: payload?.courierPhone || '',
      providerTrackingUrl: payload?.trackingUrl || '',
      estimatedDropoffAt: payload?.estimatedDropoffAt || new Date().toISOString(),
      photoUrl: payload?.photoUrl || null,
      signatureUrl: payload?.signatureUrl || null,
      rawPayload: payload
    };
  }
}
