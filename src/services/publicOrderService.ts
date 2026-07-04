import { collection, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface GuestOrderLineItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  isCustom: boolean;
}

export interface GuestOrderData {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity: string;
  recipientState: string;
  recipientZip: string;
  deliveryType: string;
  deliveryDate: string;
  senderName: string;
  senderEmail: string;
  cardMessage?: string;
  items: GuestOrderLineItem[];
  subtotal: number;
  deliveryFee: number;
  taxes: number;
  total: number;
}

export const createGuestOrder = async (orderData: GuestOrderData) => {
  try {
    // 1. Generate unique order tracking number
    const generatedNum = Math.floor(Math.random() * 90000) + 10000;
    const orderNumber = `BLM-${generatedNum}`;

    // 2. Normalize tracking number and sender email
    const orderNumberNormalized = orderNumber.toLowerCase().trim();
    const senderEmailNormalized = orderData.senderEmail.toLowerCase().trim();
    const trackingLookupId = `${orderNumberNormalized}_${senderEmailNormalized}`;

    // 3. Write protected full order to 'orders' collection. Pre-allocate the
    // doc ref so the stored id equals the Firestore document id — admin-side
    // mutations (edit/delete/status/GL post) key off order.id, and a fabricated
    // 'ord-…' id would make them target a nonexistent document. Note: the
    // guest-create rules allowlist 'id' but not 'documentId', so only id is set.
    const orderRef = doc(collection(db, 'orders'));
    const fullOrderPayload = {
      ...orderData,
      id: orderRef.id,
      orderNumber,
      orderNumberNormalized,
      senderEmailNormalized,
      customerId: 'guest',
      customerName: orderData.senderName || 'Guest Customer',
      status: 'confirmed', // checkout directly confirms the order
      paymentStatus: 'paid', // guest checkout is pre-paid in this flow
      glPostingStatus: 'unposted', // GL postings isolated for admin execution
      createdAt: new Date().toISOString(), // Use ISO string to match existing model structure
      deliveryDate: orderData.deliveryDate,
    };

    await setDoc(orderRef, fullOrderPayload);
    const orderId = orderRef.id;

    // 4. Create timeline array
    const timeline = [
      {
        status: 'placed',
        label: 'Order Placed',
        timestamp: new Date().toISOString(),
      }
    ];

    // 5. Create items summary description
    const itemsSummary = orderData.items
      .map(item => `${item.quantity}x ${item.name}`)
      .join(', ');

    // 6. Write sanitized customer-safe tracking document to 'publicOrderTracking'
    const trackingRef = doc(db, 'publicOrderTracking', trackingLookupId);
    const trackingPayload = {
      orderNumber,
      orderNumberNormalized,
      senderEmailNormalized,
      status: 'placed', // placed, preparing, out_for_delivery, delivered, cancelled
      deliveryDate: orderData.deliveryDate,
      recipientFirstName: orderData.recipientName.split(' ')[0], // Sanitized name
      city: orderData.recipientCity,
      state: orderData.recipientState,
      itemsSummary,
      timeline,
      updatedAt: new Date().toISOString()
    };

    await setDoc(trackingRef, trackingPayload);

    return {
      orderId, // full order Firestore ID
      trackingLookupId, // sanitized lookup ID
      orderNumber, // readable BLM-XXXXX tracking code
    };
  } catch (error) {
    console.error('Failed to create guest order & tracking record:', error);
    throw error;
  }
};
