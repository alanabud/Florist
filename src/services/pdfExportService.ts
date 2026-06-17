import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { type Order, type InventoryItem, type Customer, type SubscriptionItem, type EventItem } from '../store/adminStore';
import { type Product } from '../data/products';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

const SAGE = [108, 130, 113];

export interface ExportOptions {
  companyName?: string;
  currencyCode?: string;
  locale?: string;
  reportFooterText?: string;
}

// ═══════════════════════════════════════════════════
// Dynamic Dictionary Translation
// ═══════════════════════════════════════════════════
const LABELS: Record<string, Record<string, string>> = {
  'en-US': {
    generated: 'Generated',
    period: 'Period',
    page: 'Page',
    of: 'of',
    orderId: 'Order ID',
    customer: 'Customer',
    status: 'Status',
    total: 'Total',
    date: 'Date',
    sku: 'SKU',
    item: 'Item',
    category: 'Category',
    onHand: 'On Hand',
    available: 'Available',
    unitCost: 'Unit Cost',
    supplier: 'Supplier',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    type: 'Type',
    tier: 'Tier',
    orders: 'Orders',
    lifetimeValue: 'Lifetime Value',
    openBalance: 'Open Balance',
    featured: 'Featured',
    seasonal: 'Seasonal',
    rating: 'Rating',
    frequency: 'Frequency',
    nextDelivery: 'Next Delivery',
    monthlyValue: 'Monthly Value',
    budget: 'Budget',
    recentTransactions: 'Recent Transactions Log',
    criticalInventory: 'Critical Inventory & Valuation',
    generalLedger: 'General Ledger Accounts Summary',
    accountName: 'Account Name',
    balance: 'Balance',
    totals: 'TOTALS',
    balanced: 'BALANCED',
    outOfBalance: 'OUT OF BALANCE',
    debit: 'Debit',
    credit: 'Credit',
    code: 'Code',
    assets: 'ASSETS',
    liabilities: 'LIABILITIES',
    equity: 'OWNER EQUITY',
    totalLiabilitiesAndEquity: 'TOTAL LIABILITIES & EQUITY'
  },
  'es-US': {
    generated: 'Generado',
    period: 'Periodo',
    page: 'Página',
    of: 'de',
    orderId: 'ID Pedido',
    customer: 'Cliente',
    status: 'Estado',
    total: 'Total',
    date: 'Fecha',
    sku: 'SKU',
    item: 'Artículo',
    category: 'Categoría',
    onHand: 'Disponible',
    available: 'Disponible',
    unitCost: 'Costo Unitario',
    supplier: 'Proveedor',
    name: 'Nombre',
    email: 'Correo',
    phone: 'Teléfono',
    type: 'Tipo',
    tier: 'Nivel',
    orders: 'Pedidos',
    lifetimeValue: 'LTV',
    openBalance: 'Saldo Abierto',
    featured: 'Destacado',
    seasonal: 'Estacional',
    rating: 'Calificación',
    frequency: 'Frecuencia',
    nextDelivery: 'Siguiente Entrega',
    monthlyValue: 'Valor Mensual',
    budget: 'Presupuesto',
    recentTransactions: 'Registro de Transacciones Recientes',
    criticalInventory: 'Inventario Crítico y Valoración',
    generalLedger: 'Resumen de Cuentas del Mayor General',
    accountName: 'Nombre de Cuenta',
    balance: 'Saldo',
    totals: 'TOTALES',
    balanced: 'CUADRADO',
    outOfBalance: 'DESCUADRADO',
    debit: 'Débito',
    credit: 'Crédito',
    code: 'Código',
    assets: 'ACTIVOS',
    liabilities: 'PASIVOS',
    equity: 'PATRIMONIO NETO',
    totalLiabilitiesAndEquity: 'TOTAL PASIVO Y PATRIMONIO'
  },
  'fr-FR': {
    generated: 'Généré le',
    period: 'Période',
    page: 'Page',
    of: 'sur',
    orderId: 'ID Commande',
    customer: 'Client',
    status: 'Statut',
    total: 'Total',
    date: 'Date',
    sku: 'SKU',
    item: 'Article',
    category: 'Catégorie',
    onHand: 'En Stock',
    available: 'Disponible',
    unitCost: 'Coût Unitaire',
    supplier: 'Fournisseur',
    name: 'Nom',
    email: 'E-mail',
    phone: 'Téléphone',
    type: 'Type',
    tier: 'Niveau',
    orders: 'Commandes',
    lifetimeValue: 'Valeur à Vie',
    openBalance: 'Solde Ouvert',
    featured: 'Vedette',
    seasonal: 'Saisonnier',
    rating: 'Note',
    frequency: 'Fréquence',
    nextDelivery: 'Prochaine Livraison',
    monthlyValue: 'Valeur Mensuelle',
    budget: 'Budget',
    recentTransactions: 'Journal des Transactions Récentes',
    criticalInventory: 'Inventaire Critique & Valorisation',
    generalLedger: 'Résumé des Comptes du Grand Livre',
    accountName: 'Nom du Compte',
    balance: 'Solde',
    totals: 'TOTAUX',
    balanced: 'ÉQUILIBRÉ',
    outOfBalance: 'NON ÉQUILIBRÉ',
    debit: 'Débit',
    credit: 'Crédit',
    code: 'Code',
    assets: 'ACTIFS',
    liabilities: 'PASSIFS',
    equity: 'CAPITAUX PROPRES',
    totalLiabilitiesAndEquity: 'TOTAL PASSIFS ET CAPITAUX PROPRES'
  },
  'nl-NL': {
    generated: 'Gegenereerd',
    period: 'Periode',
    page: 'Pagina',
    of: 'van',
    orderId: 'Bestel-ID',
    customer: 'Klant',
    status: 'Status',
    total: 'Totaal',
    date: 'Datum',
    sku: 'SKU',
    item: 'Artikel',
    category: 'Categorie',
    onHand: 'Op Voorraad',
    available: 'Beschikbaar',
    unitCost: 'Kostprijs',
    supplier: 'Leverancier',
    name: 'Naam',
    email: 'E-mail',
    phone: 'Telefoon',
    type: 'Type',
    tier: 'Niveau',
    orders: 'Bestellingen',
    lifetimeValue: 'LTV Waarde',
    openBalance: 'Openstaand Saldo',
    featured: 'Aanbevolen',
    seasonal: 'Seizoensgebonden',
    rating: 'Beoordeling',
    frequency: 'Frequentie',
    nextDelivery: 'Volgende Levering',
    monthlyValue: 'Maandelijkse Waarde',
    budget: 'Budget',
    recentTransactions: 'Recente Transacties',
    criticalInventory: 'Kritieke Voorraad & Waardering',
    generalLedger: 'Samenvatting Grootboekrekeningen',
    accountName: 'Rekeningnaam',
    balance: 'Saldo',
    totals: 'TOTALEN',
    balanced: 'IN BALANS',
    outOfBalance: 'UIT BALANS',
    debit: 'Debet',
    credit: 'Credit',
    code: 'Code',
    assets: 'ACTIVA',
    liabilities: 'PASSIVA',
    equity: 'EIGEN VERMOGEN',
    totalLiabilitiesAndEquity: 'TOTAAL PASSIVA & EIGEN VERMOGEN'
  }
};

// ═══════════════════════════════════════════════════
// Localized formatting helpers
// ═══════════════════════════════════════════════════
function getFormattedCurrency(amount: number, currencyCode = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
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

function addHeader(doc: jsPDF, title: string, dateRange?: string, options?: ExportOptions) {
  const brandName = options?.companyName || 'BloomPro Studio';
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  // Brand bar
  doc.setFillColor(SAGE[0], SAGE[1], SAGE[2]);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(brandName, 14, 12);

  // Title
  doc.setTextColor(44, 48, 46);
  doc.setFontSize(18);
  doc.text(title, 14, 32);

  // Metadata line
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const generated = `${langLabels.generated}: ${getFormattedDateTime(new Date(), locale)}`;
  doc.text(generated, 14, 39);
  if (dateRange) {
    doc.text(`${langLabels.period}: ${dateRange}`, 14, 44);
  }

  // Divider
  doc.setDrawColor(232, 234, 230);
  doc.setLineWidth(0.5);
  doc.line(14, dateRange ? 48 : 43, 196, dateRange ? 48 : 43);
}

function addFooter(doc: jsPDF, options?: ExportOptions) {
  const brandName = options?.companyName || 'BloomPro Studio';
  const footerText = options?.reportFooterText || 'Unaudited — For Management Use Only';
  const locale = options?.locale || 'en-US';
  const langLabels = LABELS[locale] || LABELS['en-US'];
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Divider line
    doc.setDrawColor(232, 234, 230);
    doc.setLineWidth(0.3);
    doc.line(14, 280, 196, 280);
    // Left: Brand + Custom Footer Text
    doc.setFontSize(7);
    doc.setTextColor(163, 170, 160);
    doc.text(`${brandName}  •  ${footerText}`, 14, 284);
    doc.text(`${langLabels.generated}: ${getFormattedDateTime(new Date(), locale)}`, 14, 288);
    // Right: Page numbers
    doc.text(`${langLabels.page} ${i} ${langLabels.of} ${pageCount}`, 196, 286, { align: 'right' });
  }
}

function addSummaryCards(doc: jsPDF, cards: { label: string; value: string }[], startY: number): number {
  const cardWidth = 42;
  const cardHeight = 18;
  const gap = 4;
  const startX = 14;

  cards.forEach((card, i) => {
    const x = startX + i * (cardWidth + gap);
    // Card bg
    doc.setFillColor(245, 241, 231);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'F');
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(44, 48, 46);
    doc.text(card.value, x + 4, startY + 8);
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(card.label, x + 4, startY + 14);
  });

  return startY + cardHeight + 8;
}

// ═══════════════════════════════════════════════════
// Export Functions
// ═══════════════════════════════════════════════════

export function exportDashboardPDF(data: {
  revenue: number;
  ordersToday: number;
  deliveries: number;
  lowStock: number;
  orders: Order[];
}, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'Dashboard Summary', undefined, options);

  const tableY = addSummaryCards(doc, [
    { label: 'Revenue Today', value: getFormattedCurrency(data.revenue, currency, locale) },
    { label: 'Orders Today', value: data.ordersToday.toString() },
    { label: 'Active Deliveries', value: data.deliveries.toString() },
    { label: 'Low Stock Alerts', value: data.lowStock.toString() },
  ], 52);

  doc.autoTable({
    startY: tableY,
    head: [[langLabels.orderId, langLabels.customer, langLabels.status, langLabels.total, langLabels.date]],
    body: data.orders.slice(0, 20).map(o => [
      o.id.substring(0, 10),
      o.customerName,
      o.status.replace('_', ' ').toUpperCase(),
      getFormattedCurrency(o.total, currency, locale),
      getFormattedDate(o.createdAt, locale)
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, options);
  doc.save(`BloomPro_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportExecutivePDF(data: {
  revenue: number;
  ordersCount: number;
  aov: number;
  taxCollected: number;
  cashBalance: number;
  accountsReceivable: number;
  inventoryValue: number;
  ledger: { account: string; balance: number; type: string }[];
  orders: Order[];
  inventory: InventoryItem[];
  products: Product[];
}, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];
  const dateStr = new Date().toISOString().split('T')[0];

  addHeader(doc, 'Executive Business Report', `Cumulative Data to ${getFormattedDate(new Date(), locale)}`, options);

  // 1. KPI Cards
  const cardsY = addSummaryCards(doc, [
    { label: langLabels.revenue, value: getFormattedCurrency(data.revenue, currency, locale) },
    { label: langLabels.ordersCount, value: data.ordersCount.toString() },
    { label: langLabels.aov, value: getFormattedCurrency(data.aov, currency, locale) },
    { label: langLabels.cashBalance, value: getFormattedCurrency(data.cashBalance, currency, locale) },
  ], 52);

  // 2. Chart of Accounts General Ledger
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(44, 48, 46);
  doc.text(langLabels.generalLedger, 14, cardsY);

  doc.autoTable({
    startY: cardsY + 4,
    head: [[langLabels.accountName, langLabels.balance, langLabels.type]],
    body: data.ledger.map(acc => [
      acc.account,
      getFormattedCurrency(acc.balance, currency, locale),
      acc.type
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  let nextY = doc.lastAutoTable.finalY + 12;

  // Add Page Break if needed, or place next tables
  if (nextY > 230) {
    doc.addPage();
    nextY = 24;
  }

  // 3. Operational Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(44, 48, 46);
  doc.text(langLabels.recentTransactions, 14, nextY);

  doc.autoTable({
    startY: nextY + 4,
    head: [[langLabels.orderId, langLabels.customer, langLabels.date, langLabels.total, langLabels.status]],
    body: data.orders.slice(0, 10).map(o => [
      o.id.substring(0, 10),
      o.customerName,
      getFormattedDate(o.createdAt, locale),
      getFormattedCurrency(o.total, currency, locale),
      o.status.toUpperCase().replace('_', ' ')
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  let nextY2 = doc.lastAutoTable.finalY + 12;
  if (nextY2 > 230) {
    doc.addPage();
    nextY2 = 24;
  }

  // 4. Inventory Valuation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(44, 48, 46);
  doc.text(langLabels.criticalInventory, 14, nextY2);

  doc.autoTable({
    startY: nextY2 + 4,
    head: [[langLabels.sku, langLabels.item, langLabels.category, langLabels.onHand, langLabels.unitCost, langLabels.valuation]],
    body: data.inventory.map(i => [
      i.sku,
      i.name,
      i.category,
      `${i.quantity} units`,
      getFormattedCurrency(i.unitCost, currency, locale),
      getFormattedCurrency(i.quantity * i.unitCost, currency, locale)
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, options);
  doc.save(`BloomPro_Executive_Report_${dateStr}.pdf`);
}

export function exportOrdersPDF(orders: Order[], filename?: string, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'Orders Report', undefined, options);

  const total = orders.reduce((s, o) => s + o.total, 0);
  const tableY = addSummaryCards(doc, [
    { label: 'Total Orders', value: orders.length.toString() },
    { label: 'Gross Revenue', value: getFormattedCurrency(total, currency, locale) },
    { label: 'Delivered', value: orders.filter(o => o.status === 'delivered').length.toString() },
    { label: 'Avg Value', value: getFormattedCurrency(orders.length > 0 ? (total / orders.length) : 0, currency, locale) },
  ], 48);

  doc.autoTable({
    startY: tableY,
    head: [[langLabels.orderId, langLabels.customer, langLabels.status, langLabels.total, 'Payment Status', 'Due Date']],
    body: orders.map(o => [
      o.id.substring(0, 10), o.customerName,
      o.status.replace('_', ' ').toUpperCase(), 
      getFormattedCurrency(o.total, currency, locale),
      (o.paymentStatus || 'unpaid').toUpperCase(),
      getFormattedDate(o.dueDate || o.deliveryDate, locale)
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, options);
  doc.save(filename || `BloomPro_Orders_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportInventoryPDF(inventory: InventoryItem[], filename?: string, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'Inventory Report', undefined, options);

  doc.autoTable({
    startY: 48,
    head: [[langLabels.sku, langLabels.item, langLabels.category, langLabels.onHand, langLabels.available, langLabels.unitCost, langLabels.supplier, 'Status']],
    body: inventory.map(i => [
      i.sku, i.name, i.category, i.quantity.toString(), 
      (i.quantityAvailable !== undefined ? i.quantityAvailable : i.quantity).toString(),
      getFormattedCurrency(i.unitCost, currency, locale), i.supplier,
      i.quantity <= i.reorderPoint ? (i.quantity === 0 ? 'OUT' : 'LOW') : 'OK'
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, options);
  doc.save(filename || `BloomPro_Inventory_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportCustomersPDF(customers: Customer[], options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'Customers Report', undefined, options);

  doc.autoTable({
    startY: 48,
    head: [[langLabels.name, langLabels.email, langLabels.phone, langLabels.type, langLabels.tier, langLabels.orders, langLabels.lifetimeValue, langLabels.openBalance]],
    body: customers.map(c => [
      c.name, c.email, c.phone, 
      (c.customerType || 'retail').toUpperCase(),
      (c.loyaltyTier || 'bronze').toUpperCase(),
      c.totalOrders.toString(), 
      getFormattedCurrency(c.lifetimeValue, currency, locale),
      getFormattedCurrency(c.openBalance || 0, currency, locale)
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, options);
  doc.save(`BloomPro_Customers_${new Date().toISOString().split('T')[0]}.pdf`);
}

export interface QAResultForExport {
  id: string;
  label: string;
  category: string;
  passed: boolean;
  expected?: string | number;
  actual?: string | number;
}

export function exportQAEvidencePDF(results: QAResultForExport[], evidenceId?: string, options?: ExportOptions) {
  const doc = new jsPDF();

  addHeader(doc, 'QA Verification Evidence Report', `Run ID: ${evidenceId || 'Ad-Hoc'}`, options);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  const tableY = addSummaryCards(doc, [
    { label: 'Total Checks', value: results.length.toString() },
    { label: 'Checks Passed', value: passed.toString() },
    { label: 'Checks Failed', value: failed.toString() },
    { label: 'Lockdown Status', value: failed === 0 ? 'SECURED' : 'RISK DETECTED' },
  ], 48);

  doc.autoTable({
    startY: tableY,
    head: [['ID', 'Verification Check', 'Category', 'Result', 'Expected / Actual']],
    body: results.map(r => [
      r.id,
      r.label,
      r.category.toUpperCase(),
      r.passed ? 'PASS' : 'FAIL',
      r.passed ? 'Matched' : `Expected: ${r.expected} | Actual: ${r.actual}`
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, options);
  doc.save(`BloomPro_QA_Evidence_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportProductsPDF(products: Product[], filename?: string, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'Products Catalog Report', undefined, options);

  const totalProducts = products.length;
  const inStock = products.filter(p => p.inStock).length;
  const outOfStock = totalProducts - inStock;
  const avgPrice = products.reduce((sum, p) => sum + (p.basePrice || p.price || 0), 0) / (totalProducts || 1);

  const tableY = addSummaryCards(doc, [
    { label: 'Total Catalog', value: totalProducts.toString() },
    { label: 'In Stock', value: inStock.toString() },
    { label: 'Out of Stock', value: outOfStock.toString() },
    { label: 'Avg Price', value: getFormattedCurrency(avgPrice, currency, locale) },
  ], 48);

  doc.autoTable({
    startY: tableY,
    head: [[langLabels.sku, 'Product Name', langLabels.category, 'Price', 'Stock Status', 'Product Status']],
    body: products.map(p => [
      p.sku || 'N/A', p.name, p.category, 
      getFormattedCurrency(p.basePrice || p.price || 0, currency, locale),
      p.inStock ? 'In Stock' : 'Out of Stock',
      (p.productStatus || 'active').toUpperCase()
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, options);
  doc.save(filename || `BloomPro_Products_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportSubscriptionsPDF(subscriptions: SubscriptionItem[], filename?: string, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'Subscriptions Report', undefined, options);

  const total = subscriptions.length;
  const active = subscriptions.filter(s => s.status === 'active').length;
  const paused = subscriptions.filter(s => s.status === 'paused').length;
  const mrr = subscriptions.reduce((sum, s) => sum + (s.value || 0), 0);

  const tableY = addSummaryCards(doc, [
    { label: 'Total Accounts', value: total.toString() },
    { label: 'Active', value: active.toString() },
    { label: 'Paused', value: paused.toString() },
    { label: 'MRR Value', value: getFormattedCurrency(mrr, currency, locale) },
  ], 48);

  doc.autoTable({
    startY: tableY,
    head: [[langLabels.customer, 'Product', langLabels.frequency, langLabels.nextDelivery, langLabels.monthlyValue, langLabels.status]],
    body: subscriptions.map(s => [
      s.customerName, s.product, s.frequency.toUpperCase(),
      getFormattedDate(s.nextDelivery, locale),
      getFormattedCurrency(s.value, currency, locale),
      s.status.toUpperCase()
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, options);
  doc.save(filename || `BloomPro_Subscriptions_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportEventsPDF(events: EventItem[], filename?: string, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'Events & Weddings Report', undefined, options);

  const total = events.length;
  const budgetSum = events.reduce((sum, e) => sum + (e.budget || 0), 0);
  const planning = events.filter(e => e.status === 'planning').length;
  const confirmed = events.filter(e => e.status === 'confirmed').length;

  const tableY = addSummaryCards(doc, [
    { label: 'Total Events', value: total.toString() },
    { label: 'Gross Budget', value: getFormattedCurrency(budgetSum, currency, locale) },
    { label: 'Planning', value: planning.toString() },
    { label: 'Confirmed', value: confirmed.toString() },
  ], 48);

  doc.autoTable({
    startY: tableY,
    head: [['Event Name', 'Type', langLabels.date, langLabels.customer, langLabels.budget, langLabels.status]],
    body: events.map(e => [
      e.name, e.type, getFormattedDate(e.date, locale), e.client,
      getFormattedCurrency(e.budget, currency, locale),
      e.status.toUpperCase()
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, options);
  doc.save(filename || `BloomPro_Events_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportBalanceSheetPDF(result: any, periodName: string, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'Balance Sheet', `${langLabels.period}: ${periodName}`, options);

  const fmt = (n: number) => getFormattedCurrency(n, currency, locale);
  const totalAssets = result.totalAssets;
  const totalLiabilities = result.totalLiabilities;
  const totalEquity = result.totalEquity;
  const totalLiabilitiesAndEquity = result.totalLiabilitiesAndEquity;

  const tableY = addSummaryCards(doc, [
    { label: 'Total Assets', value: fmt(totalAssets) },
    { label: 'Total Liabilities', value: fmt(totalLiabilities) },
    { label: 'Total Equity', value: fmt(totalEquity) },
    { label: 'Balanced', value: result.isBalanced ? '✓ YES' : '✗ NO' },
  ], 52);

  // Prepared by line
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`Prepared by: ${options?.companyName || 'BloomPro Studio'} Finance  •  Unaudited — For Management Use Only`, 14, tableY - 2);

  // Assets section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(74, 107, 80);
  doc.text(langLabels.assets, 14, tableY + 4);

  const assetsRows = result.assets.map((a: any) => ['    ' + a.name, fmt(a.balance)]);
  assetsRows.push([{ content: 'Total Assets', styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }, { content: fmt(totalAssets), styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }]);

  doc.autoTable({
    startY: tableY + 8,
    head: [['Asset Account', langLabels.balance]],
    body: assetsRows,
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 105 },
    tableWidth: 87,
  });

  // Liabilities section (right column or below)
  let nextY = tableY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(74, 107, 80);
  doc.text(langLabels.liabilities, 110, tableY + 4);

  const liabRows = result.liabilities.map((l: any) => ['    ' + l.name, fmt(l.balance)]);
  liabRows.push([{ content: 'Total Liabilities', styles: { fontStyle: 'bold' } }, { content: fmt(totalLiabilities), styles: { fontStyle: 'bold' } }]);

  doc.autoTable({
    startY: nextY,
    head: [['Liability Account', langLabels.balance]],
    body: liabRows,
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 110, right: 14 },
    tableWidth: 87,
  });

  nextY = doc.lastAutoTable.finalY + 6;

  // Equity section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(74, 107, 80);
  doc.text(langLabels.equity, 110, nextY);

  const equityRows = result.equity.map((e: any) => ['    ' + e.name, fmt(e.balance)]);
  equityRows.push([{ content: 'Total Equity', styles: { fontStyle: 'bold' } }, { content: fmt(totalEquity), styles: { fontStyle: 'bold' } }]);

  doc.autoTable({
    startY: nextY + 4,
    head: [['Equity Account', langLabels.balance]],
    body: equityRows,
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 110, right: 14 },
    tableWidth: 87,
  });

  nextY = doc.lastAutoTable.finalY + 8;

  // Grand total bar
  doc.setFillColor(232, 234, 230);
  doc.roundedRect(14, nextY, 182, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(44, 48, 46);
  doc.text(langLabels.totalLiabilitiesAndEquity, 18, nextY + 8);
  doc.text(fmt(totalLiabilitiesAndEquity), 192, nextY + 8, { align: 'right' });

  nextY += 18;

  // Verification badge
  if (result.isBalanced) {
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, nextY, 182, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(6, 95, 70);
    doc.text('✓  Balance Sheet Verified: Assets = Liabilities + Equity', 18, nextY + 7);
  } else {
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14, nextY, 182, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    doc.text('✗  Balance Sheet Out of Balance — Review Trial Balance', 18, nextY + 7);
  }

  addFooter(doc, options);
  doc.save(`BloomPro_Balance_Sheet_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportIncomeStatementPDF(result: any, periodName: string, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'Income Statement (Profit & Loss)', `${langLabels.period}: ${periodName}`, options);

  const fmt = (n: number) => getFormattedCurrency(n, currency, locale);
  const totalRevenue = result.totalRevenue;
  const totalExpense = result.totalExpense;
  const netIncome = result.netIncome;

  const tableY = addSummaryCards(doc, [
    { label: 'Gross Revenue', value: fmt(totalRevenue) },
    { label: 'Total Expenses', value: fmt(totalExpense) },
    { label: 'Net Income', value: fmt(netIncome) },
    { label: 'Net Margin', value: `${result.netMarginPercent.toFixed(1)}%` },
  ], 52);

  // Prepared by line
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`Prepared by: ${options?.companyName || 'BloomPro Studio'} Finance  •  Unaudited — For Management Use Only`, 14, tableY - 2);

  // Revenue Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(74, 107, 80);
  doc.text('OPERATING REVENUES', 14, tableY + 4);

  const revRows = result.revenues.map((r: any) => ['    ' + r.name, fmt(r.balance), 'Revenue']);
  revRows.push([{ content: 'Total Operating Revenue', styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }, { content: fmt(totalRevenue), styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }, '']);

  doc.autoTable({
    startY: tableY + 8,
    head: [['Account', langLabels.balance, 'Type']],
    body: revRows,
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center', fontSize: 7, textColor: [107, 114, 128] } },
  });

  let nextY = doc.lastAutoTable.finalY + 8;

  // Expense Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(74, 107, 80);
  doc.text('COST & OPERATING EXPENSES', 14, nextY);

  const expRows = result.expenses.map((e: any) => ['    ' + e.name, fmt(e.balance), 'Expense']);
  expRows.push([{ content: 'Total Operating Expenses', styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }, { content: fmt(totalExpense), styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }, '']);

  doc.autoTable({
    startY: nextY + 4,
    head: [['Account', langLabels.balance, 'Type']],
    body: expRows,
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center', fontSize: 7, textColor: [107, 114, 128] } },
  });

  nextY = doc.lastAutoTable.finalY + 10;

  // Net Income bar with double underline treatment
  doc.setFillColor(245, 241, 231);
  doc.roundedRect(14, nextY, 182, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(44, 48, 46);
  doc.text('NET OPERATING INCOME', 18, nextY + 7);
  doc.setFontSize(14);
  doc.setTextColor(netIncome >= 0 ? 16 : 220, netIncome >= 0 ? 185 : 38, netIncome >= 0 ? 129 : 38);
  doc.text(fmt(netIncome), 192, nextY + 10, { align: 'right' });
  // Double underline
  doc.setDrawColor(44, 48, 46);
  doc.setLineWidth(0.5);
  doc.line(140, nextY + 13, 192, nextY + 13);
  doc.setLineWidth(0.3);
  doc.line(140, nextY + 14.5, 192, nextY + 14.5);
  // Margin note
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text(`Net margin for the period is ${result.netMarginPercent.toFixed(1)}%`, 18, nextY + 13);

  addFooter(doc, options);
  doc.save(`BloomPro_Income_Statement_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportTrialBalancePDF(result: any, periodName: string, options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  addHeader(doc, 'General Ledger Trial Balance', `${langLabels.period}: ${periodName}`, options);

  const fmt = (n: number) => n > 0 ? getFormattedCurrency(n, currency, locale) : '—';

  const tableY = addSummaryCards(doc, [
    { label: 'Total Debits', value: getFormattedCurrency(result.totalDebits, currency, locale) },
    { label: 'Total Credits', value: getFormattedCurrency(result.totalCredits, currency, locale) },
    { label: 'Difference', value: getFormattedCurrency(result.difference, currency, locale) },
    { label: 'Status', value: result.isBalanced ? `✓ ${langLabels.balanced}` : `✗ ${langLabels.outOfBalance}` },
  ], 52);

  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`Prepared by: ${options?.companyName || 'BloomPro Studio'} Finance  •  Unaudited — For Management Use Only`, 14, tableY - 2);

  const rows = result.lines.map((l: any) => [
    l.code,
    l.name,
    l.type.toUpperCase(),
    fmt(l.debit),
    fmt(l.credit),
  ]);

  rows.push([
    { content: '', styles: {} },
    { content: langLabels.totals, styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } },
    { content: '', styles: { fillColor: [245, 241, 231] } },
    { content: getFormattedCurrency(result.totalDebits, currency, locale), styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } },
    { content: getFormattedCurrency(result.totalCredits, currency, locale), styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } },
  ]);

  doc.autoTable({
    startY: tableY + 2,
    head: [[langLabels.code, langLabels.accountName, 'Type', `${langLabels.debit}`, `${langLabels.credit}`]],
    body: rows,
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
    columnStyles: { 0: { fontStyle: 'bold', font: 'courier' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });

  const nextY = doc.lastAutoTable.finalY + 8;

  // Verification badge
  if (result.isBalanced) {
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, nextY, 182, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(6, 95, 70);
    doc.text('✓  Double-Entry Verification Passed: Total Debits = Total Credits', 18, nextY + 7);
  } else {
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14, nextY, 182, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    doc.text(`✗  Out of Balance by ${getFormattedCurrency(result.difference, currency, locale)} — Review journal entries`, 18, nextY + 7);
  }

  addFooter(doc, options);
  doc.save(`BloomPro_Trial_Balance_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportDeliveriesPDF(deliveries: any[], options?: ExportOptions) {
  const doc = new jsPDF();
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';

  addHeader(doc, 'Delivery Dispatch Manifest Report', `Date: ${new Date().toLocaleDateString()}`, options);

  // Compute metrics
  const total = deliveries.length;
  const totalRevenue = deliveries.reduce((acc, d) => acc + (d.financials?.customerChargeFinal || 0), 0);
  const totalCost = deliveries.reduce((acc, d) => acc + (d.financials?.providerCostFinal || 0), 0);
  const margin = totalRevenue - totalCost;

  const tableY = addSummaryCards(doc, [
    { label: 'Total Deliveries', value: total.toString() },
    { label: 'Delivery Revenue', value: getFormattedCurrency(totalRevenue, currency, locale) },
    { label: 'Provider Cost', value: getFormattedCurrency(totalCost, currency, locale) },
    { label: 'Net Margin', value: getFormattedCurrency(margin, currency, locale) },
  ], 52);

  const rows = deliveries.map((d: any) => [
    d.id.substring(0, 8).toUpperCase(),
    new Date(d.audit?.createdAt || Date.now()).toLocaleDateString(),
    d.dropoff?.recipientName || '—',
    d.dropoff?.addressLine1 || '—',
    d.provider ? d.provider.toUpperCase() : 'MANUAL',
    d.status.toUpperCase(),
    getFormattedCurrency(d.financials?.providerCostFinal || 0, currency, locale),
    getFormattedCurrency(d.financials?.customerChargeFinal || 0, currency, locale),
    getFormattedCurrency(d.financials?.marginFinal || 0, currency, locale),
  ]);

  doc.autoTable({
    startY: tableY + 2,
    head: [['ID', 'Date', 'Recipient', 'Address', 'Provider', 'Status', 'Cost', 'Charge', 'Margin']],
    body: rows,
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { fontStyle: 'bold', font: 'courier' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' }
    },
  });

  addFooter(doc, options);
  doc.save(`BloomPro_Delivery_Manifest_${new Date().toISOString().split('T')[0]}.pdf`);
}

