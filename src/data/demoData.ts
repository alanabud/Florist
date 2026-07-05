export const DEMO_CUSTOMERS = [
  { id: 'c1', name: 'Eleanor Vance', email: 'eleanor@example.com', phone: '555-0101', lifetimeValue: 1250.00, totalOrders: 8 },
  { id: 'c2', name: 'James Sterling', email: 'james.s@example.com', phone: '555-0102', lifetimeValue: 450.00, totalOrders: 3 },
  { id: 'c3', name: 'Maria Rodriguez', email: 'maria.r@example.com', phone: '555-0103', lifetimeValue: 3200.00, totalOrders: 15 },
  { id: 'c4', name: 'David Chen', email: 'd.chen@example.com', phone: '555-0104', lifetimeValue: 85.00, totalOrders: 1 },
  { id: 'c5', name: 'Sarah Jenkins', email: 'sarahj@example.com', phone: '555-0105', lifetimeValue: 890.00, totalOrders: 6 },
];

export const DEMO_INVENTORY = [
  { id: 'i1', name: 'White Roses (Stem)', sku: 'WR-001', category: 'Flowers', quantity: 450, reorderPoint: 200, unitCost: 1.25, supplier: 'Dutch Blooms Wholesale' },
  { id: 'i2', name: 'Red Roses (Stem)', sku: 'RR-001', category: 'Flowers', quantity: 85, reorderPoint: 300, unitCost: 1.50, supplier: 'Dutch Blooms Wholesale' },
  { id: 'i3', name: 'Pink Peonies (Stem)', sku: 'PP-001', category: 'Flowers', quantity: 40, reorderPoint: 100, unitCost: 4.50, supplier: 'Springfield Farms' },
  { id: 'i4', name: 'Eucalyptus (Bunch)', sku: 'EU-001', category: 'Greens', quantity: 120, reorderPoint: 50, unitCost: 3.00, supplier: 'Green Valley' },
  { id: 'i5', name: 'Glass Cylinder Vase', sku: 'VS-001', category: 'Supplies', quantity: 200, reorderPoint: 50, unitCost: 4.00, supplier: 'VaseCo' },
];

const generateRecentOrders = () => {
  // 'in_design' (not 'preparing') — must stay inside the OrderStatus vocabulary.
  const statuses = ['draft', 'confirmed', 'in_design', 'out_for_delivery', 'delivered', 'cancelled'];
  const orders = [];
  const now = new Date();
  
  for (let i = 1; i <= 50; i++) {
    const isToday = i <= 15;
    const date = new Date(now);
    if (!isToday) {
      date.setDate(date.getDate() - Math.floor(Math.random() * 7)); // Last 7 days
    }
    date.setHours(Math.floor(Math.random() * 10) + 8); // 8 AM to 6 PM

    let status = statuses[Math.floor(Math.random() * statuses.length)];
    if (i <= 5) status = 'out_for_delivery';
    if (i > 5 && i <= 10) status = 'in_design';
    
    const total = Math.floor(Math.random() * 150) + 50;
    const subtotal = Math.round(total * 0.85 * 100) / 100;
    const taxes = Math.round(subtotal * 0.08875 * 100) / 100;
    const deliveryFee = Math.round((total - subtotal - taxes) * 100) / 100;
    
    orders.push({
      id: `ord-${1000 + i}`,
      customerId: `c${Math.floor(Math.random() * 5) + 1}`,
      customerName: DEMO_CUSTOMERS[Math.floor(Math.random() * 5)].name,
      status: status,
      fulfillmentStatus: status === 'delivered' ? 'fulfilled' : 'unfulfilled',
      total: total,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      taxes: taxes,
      items: Math.floor(Math.random() * 3) + 1,
      createdAt: date.toISOString(),
      deliveryDate: isToday ? now.toISOString() : date.toISOString()
    });
  }
  
  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const DEMO_ORDERS = generateRecentOrders();

export const DEMO_EVENTS = [
  { id: 'e1', name: 'Sterling-Chen Wedding', type: 'Wedding', date: new Date(Date.now() + 86400000 * 5).toISOString(), budget: 4500, status: 'planning', client: 'James Sterling' },
  { id: 'e2', name: 'TechCorp Gala', type: 'Corporate', date: new Date(Date.now() + 86400000 * 12).toISOString(), budget: 2200, status: 'confirmed', client: 'TechCorp Inc.' },
  { id: 'e3', name: 'Vance Anniversary', type: 'Private', date: new Date(Date.now() + 86400000 * 2).toISOString(), budget: 850, status: 'preparing', client: 'Eleanor Vance' },
];

export const DEMO_SUBSCRIPTIONS = [
  { id: 's1', customerName: 'Maria Rodriguez', frequency: 'Weekly', nextDelivery: new Date(Date.now() + 86400000 * 3).toISOString(), value: 85, status: 'active', product: 'Seasonal Designer Mix' },
  { id: 's2', customerName: 'Eleanor Vance', frequency: 'Monthly', nextDelivery: new Date(Date.now() + 86400000 * 15).toISOString(), value: 120, status: 'active', product: 'Luxury Orchid Renewal' },
  { id: 's3', customerName: 'David Chen', frequency: 'Bi-weekly', nextDelivery: new Date(Date.now() + 86400000 * 7).toISOString(), value: 65, status: 'paused', product: 'Fresh Cut Tulips' },
];
