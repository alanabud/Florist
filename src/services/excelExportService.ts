import * as XLSX from 'xlsx-js-style';
import { type Order, type InventoryItem, type Customer, type SubscriptionItem, type EventItem } from '../store/adminStore';
import { type Product } from '../data/products';

export type ReportRow = Array<string | number | boolean | null | undefined>;
export type ReportTable = ReportRow[];

export interface ExportOptions {
  companyName?: string;
  currencyCode?: string;
  locale?: string;
  reportFooterText?: string;
}

// ═══════════════════════════════════════════════════
// Premium Cell Style Definitions
// ═══════════════════════════════════════════════════
const SAGE_RGB = '6C8271';
const SAGE_DARK_RGB = '4A6B50';
const CREAM_RGB = 'F5F1E7';
const BG_LIGHT_RGB = 'FAFAF8';
const BORDER_RGB = 'E8EAE6';
const TEXT_DARK = '2C302E';
const TEXT_MUTED = '6b7280';

const headerStyle: XLSX.CellStyle = {
  fill: { fgColor: { rgb: SAGE_RGB } },
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
  border: {
    bottom: { style: 'thin', color: { rgb: SAGE_DARK_RGB } },
  },
};

const titleStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 18, color: { rgb: TEXT_DARK }, name: 'Calibri' },
  alignment: { vertical: 'center' },
};

const subtitleStyle: XLSX.CellStyle = {
  font: { sz: 10, color: { rgb: TEXT_MUTED }, name: 'Calibri' },
  alignment: { vertical: 'center' },
};

const metaLabelStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 9, color: { rgb: TEXT_MUTED }, name: 'Calibri' },
};

const metaValueStyle: XLSX.CellStyle = {
  font: { sz: 9, color: { rgb: TEXT_DARK }, name: 'Calibri' },
};

const sectionHeaderStyle: XLSX.CellStyle = {
  fill: { fgColor: { rgb: CREAM_RGB } },
  font: { bold: true, sz: 11, color: { rgb: SAGE_DARK_RGB }, name: 'Calibri' },
  alignment: { vertical: 'center' },
  border: { bottom: { style: 'thin', color: { rgb: BORDER_RGB } } },
};

const totalRowStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 10, color: { rgb: TEXT_DARK }, name: 'Calibri' },
  fill: { fgColor: { rgb: CREAM_RGB } },
  border: {
    top: { style: 'thin', color: { rgb: TEXT_DARK } },
    bottom: { style: 'double' as any, color: { rgb: TEXT_DARK } },
  },
};

const grandTotalStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 11, color: { rgb: TEXT_DARK }, name: 'Calibri' },
  fill: { fgColor: { rgb: 'E8EAE6' } },
  border: {
    top: { style: 'medium', color: { rgb: TEXT_DARK } },
    bottom: { style: 'double' as any, color: { rgb: TEXT_DARK } },
  },
};

const dataStyle: XLSX.CellStyle = {
  font: { sz: 10, color: { rgb: TEXT_DARK }, name: 'Calibri' },
  alignment: { vertical: 'center' },
  border: {
    bottom: { style: 'hair', color: { rgb: BORDER_RGB } },
  },
};

const altRowStyle: XLSX.CellStyle = {
  ...dataStyle,
  fill: { fgColor: { rgb: BG_LIGHT_RGB } },
};

const badgePassStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 10, color: { rgb: '065F46' }, name: 'Calibri' },
  fill: { fgColor: { rgb: 'ECFDF5' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

const badgeFailStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 10, color: { rgb: '991B1B' }, name: 'Calibri' },
  fill: { fgColor: { rgb: 'FEF2F2' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

// ═══════════════════════════════════════════════════
// Localized Translation Map
// ═══════════════════════════════════════════════════
const LABELS: Record<string, Record<string, string>> = {
  'en-US': {
    reportingPeriod: 'Reporting Period:',
    generated: 'Generated:',
    preparedBy: 'Prepared By:',
    metric: 'Metric',
    value: 'Value',
    context: 'Context',
    orderId: 'Order ID',
    customer: 'Customer Name',
    status: 'Status',
    total: 'Total',
    paymentStatus: 'Payment Status',
    dueDate: 'Due Date',
    createdDate: 'Created Date',
    sku: 'SKU Code',
    itemName: 'Item Name',
    category: 'Category',
    onHand: 'Quantity On Hand',
    available: 'Quantity Available',
    unitCost: 'Unit Material Cost',
    totalStockVal: 'Total Stock Value',
    supplier: 'Preferred Supplier',
    name: 'Customer Name',
    email: 'Email Address',
    phone: 'Phone Number',
    loyaltyTier: 'Loyalty Tier',
    lifetimeValue: 'Lifetime Value',
    openBalance: 'Open Balance',
    price: 'Price',
    featured: 'Featured',
    seasonal: 'Seasonal',
    rating: 'Rating',
    frequency: 'Frequency',
    nextDelivery: 'Next Delivery',
    monthlyValue: 'Monthly Value',
    budget: 'Budget',
    glAccount: 'GL Account Name',
    balance: 'Current Balance',
    classification: 'Account Classification'
  },
  'es-US': {
    reportingPeriod: 'Período del informe:',
    generated: 'Generado:',
    preparedBy: 'Preparado por:',
    metric: 'Métrica',
    value: 'Valor',
    context: 'Contexto',
    orderId: 'ID del Pedido',
    customer: 'Nombre del Cliente',
    status: 'Estado',
    total: 'Total',
    paymentStatus: 'Estado del Pago',
    dueDate: 'Fecha de Vencimiento',
    createdDate: 'Fecha de Creación',
    sku: 'Código SKU',
    itemName: 'Nombre del Artículo',
    category: 'Categoría',
    onHand: 'Cantidad Disponible',
    available: 'Cantidad Disponible',
    unitCost: 'Costo Unitario de Material',
    totalStockVal: 'Valor Total del Stock',
    supplier: 'Proveedor Preferido',
    name: 'Nombre del Cliente',
    email: 'Correo Electrónico',
    phone: 'Número de Teléfono',
    loyaltyTier: 'Nivel de Lealtad',
    lifetimeValue: 'Valor de por Vida (LTV)',
    openBalance: 'Saldo Pendiente',
    price: 'Precio',
    featured: 'Destacado',
    seasonal: 'Estacional',
    rating: 'Calificación',
    frequency: 'Frecuencia',
    nextDelivery: 'Próxima Entrega',
    monthlyValue: 'Valor Mensual',
    budget: 'Presupuesto',
    glAccount: 'Nombre de Cuenta del Mayor',
    balance: 'Saldo Actual',
    classification: 'Clasificación de Cuenta'
  },
  'fr-FR': {
    reportingPeriod: 'Période de rapport:',
    generated: 'Généré:',
    preparedBy: 'Préparé par:',
    metric: 'Indicateur',
    value: 'Valeur',
    context: 'Contexte',
    orderId: 'ID Commande',
    customer: 'Nom du Client',
    status: 'Statut',
    total: 'Total',
    paymentStatus: 'Statut du Paiement',
    dueDate: 'Date d\'Échéance',
    createdDate: 'Date de Création',
    sku: 'Code SKU',
    itemName: 'Nom de l\'Article',
    category: 'Catégorie',
    onHand: 'Quantité en Stock',
    available: 'Quantité Disponible',
    unitCost: 'Coût Unitaire du Matériel',
    totalStockVal: 'Valeur Totale du Stock',
    supplier: 'Fournisseur Privilégié',
    name: 'Nom du Client',
    email: 'Adresse E-mail',
    phone: 'Numéro de Téléphone',
    loyaltyTier: 'Niveau de Fidélité',
    lifetimeValue: 'Valeur à Vie (LTV)',
    openBalance: 'Solde Ouvert',
    price: 'Prix',
    featured: 'Vedette',
    seasonal: 'Saisonnier',
    rating: 'Note',
    frequency: 'Fréquence',
    nextDelivery: 'Prochaine Livraison',
    monthlyValue: 'Valeur Mensuelle',
    budget: 'Budget',
    glAccount: 'Nom du Compte GL',
    balance: 'Solde Actuel',
    classification: 'Classification du Compte'
  },
  'nl-NL': {
    reportingPeriod: 'Rapportageperiode:',
    generated: 'Gegenereerd:',
    preparedBy: 'Voorbereid door:',
    metric: 'Statistiek',
    value: 'Waarde',
    context: 'Context',
    orderId: 'Bestel-ID',
    customer: 'Klantnaam',
    status: 'Status',
    total: 'Totaal',
    paymentStatus: 'Betalingsstatus',
    dueDate: 'Vervaldatum',
    createdDate: 'Aanmaakdatum',
    sku: 'SKU Code',
    itemName: 'Artikelnaam',
    category: 'Categorie',
    onHand: 'Aantal Op Voorraad',
    available: 'Aantal Beschikbaar',
    unitCost: 'Kostprijs per eenheid',
    totalStockVal: 'Totale voorraadwaarde',
    supplier: 'Voorkeursleverancier',
    name: 'Klantnaam',
    email: 'E-mailadres',
    phone: 'Telefoonnummer',
    loyaltyTier: 'Loyalty Niveau',
    lifetimeValue: 'Klantwaarde (LTV)',
    openBalance: 'Openstaand Saldo',
    price: 'Prijs',
    featured: 'Aanbevolen',
    seasonal: 'Seizoensgebonden',
    rating: 'Beoordeling',
    frequency: 'Frequentie',
    nextDelivery: 'Volgende Levering',
    monthlyValue: 'Maandelijkse Waarde',
    budget: 'Budget',
    glAccount: 'Rekeningnaam Grootboek',
    balance: 'Actueel Saldo',
    classification: 'Rekening Classificatie'
  }
};

// ═══════════════════════════════════════════════════
// Formatters
// ═══════════════════════════════════════════════════
function getFormattedCurrency(amount: number, currencyCode = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

function getExcelCurrencyFormat(currencyCode = 'USD') {
  if (currencyCode === 'EUR') return '[$€-2] #,##0.00;([$€-2] #,##0.00);"—"';
  if (currencyCode === 'GBP') return '[$£-2] #,##0.00;([$£-2] #,##0.00);"—"';
  return '[$$-409] #,##0.00;([$$-409] #,##0.00);"—"';
}

function getFormattedDate(value: any, locale = 'en-US') {
  if (!value) return 'N/A';
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function getFormattedDateTime(value: any, locale = 'en-US') {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(d);
}

function setCell(ws: XLSX.WorkSheet, row: number, col: number, value: any, style?: XLSX.CellStyle, numFmt?: string) {
  const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
  const cell: XLSX.CellObject = { v: value, t: typeof value === 'number' ? 'n' : 's' };
  if (style) cell.s = style;
  if (numFmt) cell.z = numFmt;
  ws[cellRef] = cell;
}

function ensureRange(ws: XLSX.WorkSheet, maxRow: number, maxCol: number) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  if (maxRow > range.e.r) range.e.r = maxRow;
  if (maxCol > range.e.c) range.e.c = maxCol;
  ws['!ref'] = XLSX.utils.encode_range(range);
}

function createStyledWorkbook(options?: ExportOptions): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: 'BloomPro Report',
    Company: options?.companyName || 'BloomPro Studio',
    Author: 'BloomPro Enterprise ERP'
  };
  return wb;
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

// Cover/Branding header applied to a worksheet
function addBrandingHeader(ws: XLSX.WorkSheet, title: string, period: string, startRow: number = 0, options?: ExportOptions): number {
  const brandName = options?.companyName || 'BloomPro Studio';
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  setCell(ws, startRow, 0, brandName, titleStyle);
  setCell(ws, startRow + 1, 0, title, { font: { bold: true, sz: 14, color: { rgb: SAGE_DARK_RGB }, name: 'Calibri' } });
  setCell(ws, startRow + 2, 0, '', subtitleStyle);
  setCell(ws, startRow + 3, 0, langLabels.reportingPeriod, metaLabelStyle);
  setCell(ws, startRow + 3, 1, period, metaValueStyle);
  setCell(ws, startRow + 4, 0, langLabels.generated, metaLabelStyle);
  setCell(ws, startRow + 4, 1, getFormattedDateTime(new Date(), locale), metaValueStyle);
  setCell(ws, startRow + 5, 0, langLabels.preparedBy, metaLabelStyle);
  setCell(ws, startRow + 5, 1, `${brandName} Finance`, metaValueStyle);

  // Merge title cells
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: 3 } });
  ws['!merges'].push({ s: { r: startRow + 1, c: 0 }, e: { r: startRow + 1, c: 3 } });

  return startRow + 7;
}

function addSheet(wb: XLSX.WorkBook, data: ReportTable, name: string, _options?: ExportOptions) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const cols = data[0]?.map((_, index) => ({ wch: index === 0 ? 25 : 18 })) || [];
  ws['!cols'] = cols;

  // Style header row
  if (data.length > 0) {
    data[0].forEach((_, ci) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (ws[ref]) ws[ref].s = headerStyle;
    });
  }

  // Freeze top row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Auto-filter
  if (data.length > 0) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: (data[0]?.length || 1) - 1 } }) };
  }

  XLSX.utils.book_append_sheet(wb, ws, name);
}

// ═══════════════════════════════════════════════════
// Excel Export Functions
// ═══════════════════════════════════════════════════

export function exportDashboardExcel(data: {
  revenue: number; ordersToday: number; deliveries: number; lowStock: number; orders: Order[]; inventory: InventoryItem[];
}, options?: ExportOptions) {
  const wb = createStyledWorkbook(options);
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];
  const dateStr = new Date().toISOString().split('T')[0];

  addSheet(wb, [
    [`${options?.companyName || 'BloomPro Studio'} — Dashboard Summary`],
    [`Generated: ${getFormattedDateTime(new Date(), locale)}`], [],
    [langLabels.metric, langLabels.value],
    ['Revenue Today', getFormattedCurrency(data.revenue, currency, locale)],
    ['Orders Today', data.ordersToday],
    ['Active Deliveries', data.deliveries],
    ['Low Stock Alerts', data.lowStock],
  ], 'Summary', options);

  addSheet(wb, [
    [langLabels.orderId, langLabels.customer, langLabels.status, langLabels.total, langLabels.paymentStatus, langLabels.dueDate, langLabels.createdDate],
    ...data.orders.map(o => [
      o.id, o.customerName, (o.status || 'draft').replace('_', ' ').toUpperCase(), o.total,
      (o.paymentStatus || 'unpaid').toUpperCase(),
      getFormattedDate(o.dueDate || o.deliveryDate, locale),
      getFormattedDate(o.createdAt, locale)
    ])
  ], 'Orders', options);

  downloadWorkbook(wb, `BloomPro_Dashboard_${dateStr}.xlsx`);
}

export function exportDetailedExcel(data: {
  revenue: number; ordersCount: number; aov: number; taxCollected: number; cashBalance: number;
  accountsReceivable: number; inventoryValue: number;
  ledger: { account: string; balance: number; type: string }[];
  orders: Order[]; inventory: InventoryItem[]; products: Product[]; customers: Customer[];
}, options?: ExportOptions) {
  const wb = createStyledWorkbook(options);
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];
  const dateStr = new Date().toISOString().split('T')[0];
  const brandName = options?.companyName || 'BloomPro Studio';

  addSheet(wb, [
    [`${brandName.toUpperCase()} — EXECUTIVE BUSINESS SUMMARY`],
    [`Report Date: ${getFormattedDate(new Date(), locale)}`],
    [`Generated: ${getFormattedDateTime(new Date(), locale)}`], [],
    [langLabels.metric, langLabels.value, langLabels.context],
    ['Total Sales Revenue', getFormattedCurrency(data.revenue, currency, locale), 'Sales & delivery fee revenues'],
    ['Total Orders Processed', data.ordersCount, 'Cumulative database order volume'],
    ['Average Order Value (AOV)', getFormattedCurrency(data.aov, currency, locale), 'Revenue per transaction'],
    ['Sales Tax Liability', getFormattedCurrency(data.taxCollected, currency, locale), 'Sales tax payable to states'],
    ['Cash Balance', getFormattedCurrency(data.cashBalance, currency, locale), 'Total general ledger cash'],
    ['Accounts Receivable', getFormattedCurrency(data.accountsReceivable, currency, locale), 'Unpaid credit balances'],
    ['Inventory Valuation', getFormattedCurrency(data.inventoryValue, currency, locale), 'Total unit cost value of stock'],
  ], 'Executive Summary', options);

  addSheet(wb, [
    [langLabels.glAccount, langLabels.balance, langLabels.classification],
    ...data.ledger.map(acc => [acc.account, acc.balance, acc.type])
  ], 'General Ledger', options);

  addSheet(wb, [
    [langLabels.orderId, 'Customer Name', 'Customer Email', langLabels.status, 'Total Price', 'Subtotal',
      'Taxes', 'Delivery Fee', 'Discount', langLabels.paymentStatus, 'Payment Method', 'Amount Paid',
      'Balance Due', langLabels.dueDate, 'Delivery Date', 'Delivery Window', 'Fulfillment Status',
      'Assigned Courier', 'Route Number', 'Priority', 'Store Location', 'Sales Channel', 'Occasion'],
    ...data.orders.map(o => [
      o.id, o.customerName, o.customerEmail || '',
      (o.status || 'draft').toUpperCase().replace('_', ' '), o.total, o.subtotal || 0,
      o.taxes || 0, o.deliveryFee || 0, o.discount || 0,
      (o.paymentStatus || 'unpaid').toUpperCase(), o.paymentMethod || 'N/A',
      o.amountPaid || 0, o.balanceDue || 0,
      getFormattedDate(o.dueDate, locale),
      getFormattedDate(o.deliveryDate, locale),
      o.deliveryWindow || 'N/A', o.fulfillmentStatus || 'unfulfilled',
      o.courier || o.driver || 'N/A', o.routeNumber || 'N/A',
      o.priority || 'normal', o.storeLocation || 'N/A', o.salesChannel || 'N/A', o.occasion || 'N/A'
    ])
  ], 'Orders', options);

  addSheet(wb, [
    [langLabels.sku, langLabels.itemName, langLabels.category, 'Quantity On Hand', 'Quantity Reserved', 'Quantity Available',
      'Reorder Level', 'Reorder Qty', 'Unit Material Cost', 'Total Stock Value',
      'Preferred Supplier', 'Storage Location', 'Shelf Life (Days)', 'Stem Condition', 'Waste Qty', 'Waste Reason'],
    ...data.inventory.map(i => [
      i.sku, i.name, i.category, i.quantity, i.quantityReserved || 0, i.quantityAvailable || 0,
      i.reorderPoint, i.reorderQuantity || 0, i.unitCost, i.quantity * i.unitCost,
      i.supplier, i.storageLocation || 'N/A', i.shelfLifeDays || 'N/A', i.condition || 'N/A',
      i.wasteQuantity || 0, i.wasteReason || 'N/A'
    ])
  ], 'Inventory Valuation', options);

  addSheet(wb, [
    ['Product ID', 'SKU', 'Name', langLabels.category, 'Base Price', 'Sale Price', 'Cost',
      'Margin %', 'In Stock', 'Featured', 'Seasonal', 'Stock Qty', 'Reorder Point',
      'Preferred Supplier', 'Same-Day Eligible', 'Rating Score'],
    ...data.products.map(p => [
      p.id, p.sku || 'N/A', p.name, p.category, p.basePrice || p.price, p.salePrice || 0,
      p.cost || 0, p.marginPercent || 0, p.inStock ? 'YES' : 'NO', p.featuredProduct ? 'YES' : 'NO',
      p.seasonalProduct ? 'YES' : 'NO', p.stockQuantity || 0, p.reorderPoint || 0,
      p.preferredSupplier || 'N/A', p.isSameDay ? 'YES' : 'NO', p.rating
    ])
  ], 'Products', options);

  addSheet(wb, [
    ['Customer ID', 'Customer Name', 'Customer Type', 'Email Address', 'Phone Number',
      'Loyalty Tier', 'Billing Address', 'Delivery Address', 'City', 'State', 'ZIP',
      'Orders Placed', 'Lifetime Value', 'Open Balance', 'Credit Limit', 'Preferred Payment'],
    ...data.customers.map(c => [
      c.id, c.name, c.customerType || 'retail', c.email, c.phone,
      c.loyaltyTier || 'bronze', c.billingAddress || 'N/A', c.deliveryAddress || 'N/A',
      c.city || 'N/A', c.state || 'N/A', c.zipCode || 'N/A',
      c.totalOrders, c.lifetimeValue, c.openBalance || 0, c.creditLimit || 0, c.preferredPaymentMethod || 'N/A'
    ])
  ], 'Customers', options);

  downloadWorkbook(wb, `BloomPro_Detailed_Report_${dateStr}.xlsx`);
}

export function exportOrdersExcel(orders: Order[], filename?: string, options?: ExportOptions) {
  const wb = createStyledWorkbook(options);
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addSheet(wb, [
    [langLabels.orderId, langLabels.customer, 'Items', langLabels.status, langLabels.total, langLabels.paymentStatus, langLabels.dueDate, langLabels.createdDate],
    ...orders.map(o => [
      o.id, o.customerName, (o.items !== undefined ? o.items : 1),
      (o.status || 'draft').replace('_', ' ').toUpperCase(), o.total,
      (o.paymentStatus || 'unpaid').toUpperCase(),
      getFormattedDate(o.dueDate || o.deliveryDate, locale),
      getFormattedDate(o.createdAt, locale)
    ])
  ], 'Orders', options);

  downloadWorkbook(wb, filename || `BloomPro_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportInventoryExcel(inventory: InventoryItem[], filename?: string, options?: ExportOptions) {
  const wb = createStyledWorkbook(options);
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addSheet(wb, [
    [langLabels.sku, langLabels.item, langLabels.category, langLabels.onHand, 'Reserved', langLabels.available, 'Reorder Point', langLabels.unitCost, langLabels.supplier, 'Status'],
    ...inventory.map(i => [
      i.sku, i.name, i.category, i.quantity, i.quantityReserved || 0, i.quantityAvailable || 0, i.reorderPoint,
      i.unitCost, i.supplier,
      i.quantity <= i.reorderPoint ? (i.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK') : 'HEALTHY'
    ])
  ], 'Inventory', options);

  downloadWorkbook(wb, filename || `BloomPro_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportCustomersExcel(customers: Customer[], options?: ExportOptions) {
  const wb = createStyledWorkbook(options);
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addSheet(wb, [
    [langLabels.name, langLabels.email, langLabels.phone, 'Type', langLabels.tier, 'Total Orders', langLabels.lifetimeValue, langLabels.openBalance],
    ...customers.map(c => [
      c.name, c.email, c.phone, c.customerType || 'retail', c.loyaltyTier || 'bronze',
      c.totalOrders, c.lifetimeValue, c.openBalance || 0
    ])
  ], 'Customers', options);

  downloadWorkbook(wb, `BloomPro_Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportProductsExcel(products: Product[], filename?: string, options?: ExportOptions) {
  const wb = createStyledWorkbook(options);
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addSheet(wb, [
    [langLabels.sku, 'Product Name', langLabels.category, langLabels.price, 'Stock Status', 'Product Status', 'Cost', 'Margin %', langLabels.supplier],
    ...products.map(p => [
      p.sku || 'N/A', p.name, p.category, p.basePrice || p.price,
      p.inStock ? 'IN STOCK' : 'OUT OF STOCK',
      (p.productStatus || 'active').toUpperCase(),
      p.cost || 0, p.marginPercent || 0, p.preferredSupplier || 'N/A'
    ])
  ], 'Products', options);

  downloadWorkbook(wb, filename || `BloomPro_Products_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportSubscriptionsExcel(subscriptions: SubscriptionItem[], filename?: string, options?: ExportOptions) {
  const wb = createStyledWorkbook(options);
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addSheet(wb, [
    ['Customer Name', 'Product Name', langLabels.frequency, langLabels.nextDelivery, langLabels.monthlyValue, langLabels.status, 'Failed Payment Count', 'Preferred Colors'],
    ...subscriptions.map(s => [
      s.customerName, s.product, s.frequency.toUpperCase(),
      getFormattedDate(s.nextDelivery, locale),
      s.value, s.status.toUpperCase(), s.failedPaymentCount || 0, (s.preferredColors || []).join(', ')
    ])
  ], 'Subscriptions', options);

  downloadWorkbook(wb, filename || `BloomPro_Subscriptions_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportEventsExcel(events: EventItem[], filename?: string, options?: ExportOptions) {
  const wb = createStyledWorkbook(options);
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addSheet(wb, [
    ['Event Name', 'Type', 'Event Date', 'Client Name', 'Total Budget', langLabels.status, 'Venue', 'Coordinator', 'Centerpiece Count'],
    ...events.map(e => [
      e.name, e.type, getFormattedDate(e.date, locale),
      e.client, e.budget, e.status.toUpperCase(), e.venue || 'N/A', e.coordinator || 'N/A', e.centerpieceCount || 0
    ])
  ], 'Events', options);

  downloadWorkbook(wb, filename || `BloomPro_Events_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════
// PREMIUM FINANCIAL WORKBOOK EXPORT
// ═══════════════════════════════════════════════════════════════

export function exportFinancialsExcel(data: {
  trialBalance: any;
  incomeStatement: any;
  balanceSheet: any;
  chartOfAccounts: any[];
  journalEntries: any[];
}, filename?: string, options?: ExportOptions) {
  const wb = createStyledWorkbook(options);
  const period = (filename || '').replace(/BloomPro_Financial_Workbook_/g, '').replace('.xlsx', '').replace(/_/g, ' ') || 'All Time';

  // ─── Sheet 1: Executive Summary ───
  buildExecutiveSummarySheet(wb, data, period, options);

  // ─── Sheet 2: Income Statement ───
  buildIncomeStatementSheet(wb, data, period, options);

  // ─── Sheet 3: Balance Sheet ───
  buildBalanceSheetSheet(wb, data, period, options);

  // ─── Sheet 4: Trial Balance ───
  buildTrialBalanceSheet(wb, data, period, options);

  // ─── Sheet 5: Chart of Accounts ───
  buildChartOfAccountsSheet(wb, data, period, options);

  // ─── Sheet 6: Journal Entries Log ───
  buildJournalEntriesSheet(wb, data, period, options);

  downloadWorkbook(wb, filename || `BloomPro_Financial_Workbook_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function buildExecutiveSummarySheet(wb: XLSX.WorkBook, data: any, period: string, options?: ExportOptions) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Executive Financial Summary', period, 0, options);
  const currencyFormat = getExcelCurrencyFormat(options?.currencyCode);

  // KPI Table
  const kpis = [
    ['Total Revenue', data.incomeStatement.totalRevenue],
    ['Total Expenses', data.incomeStatement.totalExpense],
    ['Net Income', data.incomeStatement.netIncome],
    ['Net Margin', data.incomeStatement.netMarginPercent.toFixed(1) + '%'],
    ['Total Assets', data.balanceSheet.totalAssets],
    ['Total Liabilities', data.balanceSheet.totalLiabilities],
    ['Total Equity', data.balanceSheet.totalEquity],
    ['Trial Balance', data.trialBalance.isBalanced ? 'BALANCED' : 'OUT OF BALANCE'],
    ['Total Journal Entries', data.journalEntries.length],
    ['Active GL Accounts', data.chartOfAccounts.filter((a: any) => a.active !== false).length],
  ];

  // Headers
  setCell(ws, r, 0, 'Key Financial Metric', headerStyle);
  setCell(ws, r, 1, 'Value', headerStyle);
  r++;

  kpis.forEach(([label, value], i) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, label, style);
    if (typeof value === 'number') {
      setCell(ws, r, 1, value, { ...style, alignment: { horizontal: 'right' } }, currencyFormat);
    } else {
      const isBalanced = value === 'BALANCED';
      setCell(ws, r, 1, value, typeof value === 'string' && (value === 'BALANCED' || value === 'OUT OF BALANCE')
        ? (isBalanced ? badgePassStyle : badgeFailStyle)
        : { ...style, alignment: { horizontal: 'right' } });
    }
    r++;
  });

  // Footer note
  r++;
  setCell(ws, r, 0, options?.reportFooterText || 'Unaudited — For Management Use Only', { font: { italic: true, sz: 8, color: { rgb: TEXT_MUTED } } });

  ensureRange(ws, r, 1);
  ws['!cols'] = [{ wch: 35 }, { wch: 22 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };

  XLSX.utils.book_append_sheet(wb, ws, 'Executive Summary');
}

function buildIncomeStatementSheet(wb: XLSX.WorkBook, data: any, period: string, options?: ExportOptions) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Income Statement (Profit & Loss)', period, 0, options);
  const currencyFormat = getExcelCurrencyFormat(options?.currencyCode);

  // Revenue Header
  setCell(ws, r, 0, 'OPERATING REVENUES', sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.incomeStatement.revenues.forEach((rev: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + rev.name, style);
    setCell(ws, r, 1, rev.balance, { ...style, alignment: { horizontal: 'right' } }, currencyFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Operating Revenue', totalRowStyle);
  setCell(ws, r, 1, data.incomeStatement.totalRevenue, { ...totalRowStyle, alignment: { horizontal: 'right' } }, currencyFormat);
  r++;
  r++; // spacing

  // Expense Header
  setCell(ws, r, 0, 'COST & OPERATING EXPENSES', sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.incomeStatement.expenses.forEach((exp: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + exp.name, style);
    setCell(ws, r, 1, exp.balance, { ...style, alignment: { horizontal: 'right' } }, currencyFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Operating Expenses', totalRowStyle);
  setCell(ws, r, 1, data.incomeStatement.totalExpense, { ...totalRowStyle, alignment: { horizontal: 'right' } }, currencyFormat);
  r++;
  r++; // spacing

  // Net Income
  setCell(ws, r, 0, 'NET OPERATING INCOME', grandTotalStyle);
  setCell(ws, r, 1, data.incomeStatement.netIncome, { ...grandTotalStyle, alignment: { horizontal: 'right' } }, currencyFormat);
  r++;

  // Margin note
  r++;
  setCell(ws, r, 0, `Net Margin: ${data.incomeStatement.netMarginPercent.toFixed(1)}%`, { font: { italic: true, sz: 9, color: { rgb: TEXT_MUTED } } });
  r++;
  setCell(ws, r, 0, options?.reportFooterText || 'Unaudited — For Management Use Only', { font: { italic: true, sz: 8, color: { rgb: TEXT_MUTED } } });

  ensureRange(ws, r, 1);
  ws['!cols'] = [{ wch: 45 }, { wch: 22 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Income Statement');
}

function buildBalanceSheetSheet(wb: XLSX.WorkBook, data: any, period: string, options?: ExportOptions) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Balance Sheet', period, 0, options);
  const currencyFormat = getExcelCurrencyFormat(options?.currencyCode);
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  // Assets
  setCell(ws, r, 0, langLabels.assets, sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.balanceSheet.assets.forEach((a: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + a.name, style);
    setCell(ws, r, 1, a.balance, { ...style, alignment: { horizontal: 'right' } }, currencyFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Assets', totalRowStyle);
  setCell(ws, r, 1, data.balanceSheet.totalAssets, { ...totalRowStyle, alignment: { horizontal: 'right' } }, currencyFormat);
  r++;
  r++;

  // Liabilities
  setCell(ws, r, 0, langLabels.liabilities, sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.balanceSheet.liabilities.forEach((l: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + l.name, style);
    setCell(ws, r, 1, l.balance, { ...style, alignment: { horizontal: 'right' } }, currencyFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Liabilities', totalRowStyle);
  setCell(ws, r, 1, data.balanceSheet.totalLiabilities, { ...totalRowStyle, alignment: { horizontal: 'right' } }, currencyFormat);
  r++;
  r++;

  // Equity
  setCell(ws, r, 0, langLabels.equity, sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.balanceSheet.equity.forEach((e: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + e.name, style);
    setCell(ws, r, 1, e.balance, { ...style, alignment: { horizontal: 'right' } }, currencyFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Owner Equity', totalRowStyle);
  setCell(ws, r, 1, data.balanceSheet.totalEquity, { ...totalRowStyle, alignment: { horizontal: 'right' } }, currencyFormat);
  r++;
  r++;

  // Grand total
  setCell(ws, r, 0, langLabels.totalLiabilitiesAndEquity, grandTotalStyle);
  setCell(ws, r, 1, data.balanceSheet.totalLiabilitiesAndEquity, { ...grandTotalStyle, alignment: { horizontal: 'right' } }, currencyFormat);
  r++;

  // Balanced verification
  r++;
  const isBalanced = data.balanceSheet.isBalanced;
  setCell(ws, r, 0, 'Balance Verification:', metaLabelStyle);
  setCell(ws, r, 1, isBalanced ? '✓ BALANCED — Assets = Liabilities + Equity' : '✗ OUT OF BALANCE',
    isBalanced ? badgePassStyle : badgeFailStyle);
  r++;
  setCell(ws, r, 0, options?.reportFooterText || 'Unaudited — For Management Use Only', { font: { italic: true, sz: 8, color: { rgb: TEXT_MUTED } } });

  ensureRange(ws, r, 1);
  ws['!cols'] = [{ wch: 45 }, { wch: 22 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
}

function buildTrialBalanceSheet(wb: XLSX.WorkBook, data: any, period: string, options?: ExportOptions) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'General Ledger Trial Balance', period, 0, options);
  const currencyFormat = getExcelCurrencyFormat(options?.currencyCode);
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  // Headers
  const headers = [langLabels.sku || 'Account Code', langLabels.glAccount || 'Account Name', langLabels.classification || 'Classification', 'Debit', 'Credit', 'Net Balance'];
  headers.forEach((h, ci) => {
    setCell(ws, r, ci, h, headerStyle);
  });
  r++;

  data.trialBalance.lines.forEach((line: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, line.code, { ...style, font: { ...style.font, name: 'Consolas' } });
    setCell(ws, r, 1, line.name, style);
    setCell(ws, r, 2, line.type.toUpperCase(), { ...style, font: { ...style.font, sz: 9 } });
    setCell(ws, r, 3, line.debit > 0 ? line.debit : '', { ...style, alignment: { horizontal: 'right' } }, currencyFormat);
    setCell(ws, r, 4, line.credit > 0 ? line.credit : '', { ...style, alignment: { horizontal: 'right' } }, currencyFormat);
    setCell(ws, r, 5, line.netBalance, { ...style, alignment: { horizontal: 'right' } }, currencyFormat);
    r++;
  });

  // Totals row
  setCell(ws, r, 0, '', totalRowStyle);
  setCell(ws, r, 1, 'TOTALS', totalRowStyle);
  setCell(ws, r, 2, '', totalRowStyle);
  setCell(ws, r, 3, data.trialBalance.totalDebits, { ...totalRowStyle, alignment: { horizontal: 'right' } }, currencyFormat);
  setCell(ws, r, 4, data.trialBalance.totalCredits, { ...totalRowStyle, alignment: { horizontal: 'right' } }, currencyFormat);
  setCell(ws, r, 5, '', totalRowStyle);
  r++;

  // Status
  r++;
  const isBalanced = data.trialBalance.isBalanced;
  setCell(ws, r, 0, 'Double-Entry Verification:', metaLabelStyle);
  setCell(ws, r, 1, isBalanced ? '✓ BALANCED (Diff: $0.00)' : `✗ Out of Balance`,
    isBalanced ? badgePassStyle : badgeFailStyle);

  ensureRange(ws, r, 5);
  ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 7, c: 0 }, e: { r: 7 + data.trialBalance.lines.length, c: 5 } }) };

  XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
}

function buildChartOfAccountsSheet(wb: XLSX.WorkBook, data: any, period: string, options?: ExportOptions) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Chart of Accounts Registry', period, 0, options);

  const headers = ['GL Code', 'Account Name', 'Account Type', 'Normal Balance', 'Status', 'Description'];
  headers.forEach((h, ci) => {
    setCell(ws, r, ci, h, headerStyle);
  });
  r++;

  data.chartOfAccounts.forEach((a: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, a.code, { ...style, font: { ...style.font, name: 'Consolas' } });
    setCell(ws, r, 1, a.name, { ...style, font: { ...style.font, bold: true } });
    setCell(ws, r, 2, (a.type || '').toUpperCase(), style);
    setCell(ws, r, 3, (a.normalBalance || '').toUpperCase(), style);
    setCell(ws, r, 4, a.active !== false ? 'ACTIVE' : 'INACTIVE',
      a.active !== false ? badgePassStyle : badgeFailStyle);
    setCell(ws, r, 5, a.description || '', { ...style, alignment: { wrapText: true } });
    r++;
  });

  ensureRange(ws, r, 5);
  ws['!cols'] = [{ wch: 12 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 50 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 7, c: 0 }, e: { r: 7 + data.chartOfAccounts.length, c: 5 } }) };

  XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');
}

function buildJournalEntriesSheet(wb: XLSX.WorkBook, data: any, period: string, options?: ExportOptions) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Journal Entries Log', period, 0, options);
  const currencyFormat = getExcelCurrencyFormat(options?.currencyCode);
  const locale = options?.locale || 'en-US';

  const headers = ['Date', 'Entry Ref', 'Description', 'GL Account', 'Debit', 'Credit', 'Status', 'Created By'];
  headers.forEach((h, ci) => {
    setCell(ws, r, ci, h, headerStyle);
  });
  r++;

  let rowIdx = 0;
  data.journalEntries.forEach((je: any) => {
    const dateStr = je.createdAt ? getFormattedDate(je.createdAt.seconds ? je.createdAt.seconds * 1000 : je.createdAt, locale) : 'N/A';
    const entryRef = je.orderId?.substring(0, 12) || '';
    const status = (je.status || 'posted').toUpperCase();

    // Entry header row (description spans)
    const entryStyle: XLSX.CellStyle = {
      fill: { fgColor: { rgb: je.status === 'reversed' ? 'FEF2F2' : CREAM_RGB } },
      font: { bold: true, sz: 10, color: { rgb: TEXT_DARK }, name: 'Calibri' },
      border: { top: { style: 'thin', color: { rgb: BORDER_RGB } } },
    };
    setCell(ws, r, 0, dateStr, entryStyle);
    setCell(ws, r, 1, entryRef, { ...entryStyle, font: { ...entryStyle.font, name: 'Consolas' } });
    setCell(ws, r, 2, je.description, entryStyle);
    setCell(ws, r, 3, '', entryStyle);
    setCell(ws, r, 4, '', entryStyle);
    setCell(ws, r, 5, '', entryStyle);
    setCell(ws, r, 6, status, je.status === 'reversed' ? badgeFailStyle : badgePassStyle);
    setCell(ws, r, 7, je.createdBy || '', entryStyle);
    r++;

    // Line detail rows
    je.lines.forEach((l: any) => {
      const lineStyle = rowIdx % 2 === 0 ? dataStyle : altRowStyle;
      setCell(ws, r, 0, '', lineStyle);
      setCell(ws, r, 1, '', lineStyle);
      setCell(ws, r, 2, '', lineStyle);
      setCell(ws, r, 3, (l.credit > 0 ? '    ' : '') + l.account, lineStyle);
      setCell(ws, r, 4, l.debit > 0 ? l.debit : '', { ...lineStyle, alignment: { horizontal: 'right' } }, currencyFormat);
      setCell(ws, r, 5, l.credit > 0 ? l.credit : '', { ...lineStyle, alignment: { horizontal: 'right' } }, currencyFormat);
      setCell(ws, r, 6, '', lineStyle);
      setCell(ws, r, 7, '', lineStyle);
      r++;
      rowIdx++;
    });
  });

  // Footer note
  r++;
  setCell(ws, r, 0, `Total entries: ${data.journalEntries.length}`, metaLabelStyle);
  r++;
  setCell(ws, r, 0, options?.reportFooterText || 'Unaudited — For Management Use Only', { font: { italic: true, sz: 8, color: { rgb: TEXT_MUTED } } });

  ensureRange(ws, r, 7);
  ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 36 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };

  XLSX.utils.book_append_sheet(wb, ws, 'Journal Entries');
}
