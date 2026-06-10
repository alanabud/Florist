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

const BRAND = 'BloomPro Studio';
const SAGE = [108, 130, 113];

function addHeader(doc: jsPDF, title: string, dateRange?: string) {
  // Brand bar
  doc.setFillColor(SAGE[0], SAGE[1], SAGE[2]);
  doc.rect(0, 0, 210, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(BRAND, 14, 12);

  // Title
  doc.setTextColor(44, 48, 46);
  doc.setFontSize(18);
  doc.text(title, 14, 32);

  // Metadata line
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const generated = `Generated: ${new Date().toLocaleString()}`;
  doc.text(generated, 14, 39);
  if (dateRange) {
    doc.text(`Period: ${dateRange}`, 14, 44);
  }

  // Divider
  doc.setDrawColor(232, 234, 230);
  doc.setLineWidth(0.5);
  doc.line(14, dateRange ? 48 : 43, 196, dateRange ? 48 : 43);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Divider line
    doc.setDrawColor(232, 234, 230);
    doc.setLineWidth(0.3);
    doc.line(14, 280, 196, 280);
    // Left: Brand + Unaudited note
    doc.setFontSize(7);
    doc.setTextColor(163, 170, 160);
    doc.text(`${BRAND}  •  Unaudited — For Management Use Only`, 14, 284);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 288);
    // Right: Page numbers
    doc.text(`Page ${i} of ${pageCount}`, 196, 286, { align: 'right' });
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
    doc.setFontSize(11);
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

export function exportDashboardPDF(data: {
  revenue: number;
  ordersToday: number;
  deliveries: number;
  lowStock: number;
  orders: Order[];
}) {
  const doc = new jsPDF();
  addHeader(doc, 'Dashboard Summary');

  const tableY = addSummaryCards(doc, [
    { label: 'Revenue Today', value: `$${data.revenue.toLocaleString()}` },
    { label: 'Orders Today', value: data.ordersToday.toString() },
    { label: 'Active Deliveries', value: data.deliveries.toString() },
    { label: 'Low Stock Alerts', value: data.lowStock.toString() },
  ], 52);

  doc.autoTable({
    startY: tableY,
    head: [['Order ID', 'Customer', 'Status', 'Total', 'Date']],
    body: data.orders.slice(0, 20).map(o => [
      o.id.substring(0, 10),
      o.customerName,
      o.status.replace('_', ' '),
      `$${o.total.toFixed(2)}`,
      new Date(o.createdAt).toLocaleDateString()
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
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
}) {
  const doc = new jsPDF();
  const dateStr = new Date().toISOString().split('T')[0];

  addHeader(doc, 'Executive Business Report', `Cumulative Data to ${new Date().toLocaleDateString()}`);

  // 1. KPI Cards
  const cardsY = addSummaryCards(doc, [
    { label: 'Total Revenue', value: `$${data.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
    { label: 'Total Orders', value: data.ordersCount.toString() },
    { label: 'Avg Value (AOV)', value: `$${data.aov.toFixed(2)}` },
    { label: 'Cash Balance', value: `$${data.cashBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
  ], 52);

  // 2. Chart of Accounts General Ledger
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(44, 48, 46);
  doc.text('General Ledger Accounts Summary', 14, cardsY);

  doc.autoTable({
    startY: cardsY + 4,
    head: [['Account Name', 'Balance', 'Type']],
    body: data.ledger.map(acc => [
      acc.account,
      `$${acc.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
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
  doc.text('Recent Transactions Log', 14, nextY);

  doc.autoTable({
    startY: nextY + 4,
    head: [['Order ID', 'Customer', 'Date', 'Total', 'Status']],
    body: data.orders.slice(0, 10).map(o => [
      o.id.substring(0, 10),
      o.customerName,
      new Date(o.createdAt).toLocaleDateString(),
      `$${o.total.toFixed(2)}`,
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
  doc.text('Critical Inventory & Valuation', 14, nextY2);

  doc.autoTable({
    startY: nextY2 + 4,
    head: [['SKU', 'Item Name', 'Category', 'Stock Level', 'Unit Cost', 'Valuation']],
    body: data.inventory.map(i => [
      i.sku,
      i.name,
      i.category,
      `${i.quantity} units`,
      `$${i.unitCost.toFixed(2)}`,
      `$${(i.quantity * i.unitCost).toFixed(2)}`
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`BloomPro_Executive_Report_${dateStr}.pdf`);
}

export function exportOrdersPDF(orders: Order[], filename?: string) {
  const doc = new jsPDF();
  addHeader(doc, 'Orders Report');

  const total = orders.reduce((s, o) => s + o.total, 0);
  const tableY = addSummaryCards(doc, [
    { label: 'Total Orders', value: orders.length.toString() },
    { label: 'Gross Revenue', value: `$${total.toLocaleString()}` },
    { label: 'Delivered', value: orders.filter(o => o.status === 'delivered').length.toString() },
    { label: 'Avg Value', value: `$${orders.length > 0 ? (total / orders.length).toFixed(0) : '0'}` },
  ], 48);

  doc.autoTable({
    startY: tableY,
    head: [['Order ID', 'Customer', 'Status', 'Total', 'Payment', 'Due Date']],
    body: orders.map(o => [
      o.id.substring(0, 10), o.customerName,
      o.status.replace('_', ' '), `$${o.total.toFixed(2)}`,
      (o.paymentStatus || 'unpaid').toUpperCase(),
      o.dueDate ? new Date(o.dueDate).toLocaleDateString() : new Date(o.deliveryDate).toLocaleDateString()
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(filename || `BloomPro_Orders_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportInventoryPDF(inventory: InventoryItem[], filename?: string) {
  const doc = new jsPDF();
  addHeader(doc, 'Inventory Report');

  doc.autoTable({
    startY: 48,
    head: [['SKU', 'Item', 'Category', 'On Hand', 'Available', 'Unit Cost', 'Supplier', 'Status']],
    body: inventory.map(i => [
      i.sku, i.name, i.category, i.quantity.toString(), 
      (i.quantityAvailable !== undefined ? i.quantityAvailable : i.quantity).toString(),
      `$${i.unitCost.toFixed(2)}`, i.supplier,
      i.quantity <= i.reorderPoint ? (i.quantity === 0 ? 'OUT' : 'LOW') : 'OK'
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(filename || `BloomPro_Inventory_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportCustomersPDF(customers: Customer[]) {
  const doc = new jsPDF();
  addHeader(doc, 'Customers Report');

  doc.autoTable({
    startY: 48,
    head: [['Name', 'Email', 'Phone', 'Type', 'Tier', 'Orders', 'Lifetime Value', 'Open Balance']],
    body: customers.map(c => [
      c.name, c.email, c.phone, 
      (c.customerType || 'retail').toUpperCase(),
      (c.loyaltyTier || 'bronze').toUpperCase(),
      c.totalOrders.toString(), `$${c.lifetimeValue.toFixed(2)}`,
      `$${(c.openBalance || 0).toFixed(2)}`
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
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

export function exportQAEvidencePDF(results: QAResultForExport[], evidenceId?: string) {
  const doc = new jsPDF();
  addHeader(doc, 'QA Verification Evidence Report', `Run ID: ${evidenceId || 'Ad-Hoc'}`);

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

  addFooter(doc);
  doc.save(`BloomPro_QA_Evidence_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportProductsPDF(products: Product[], filename?: string) {
  const doc = new jsPDF();
  addHeader(doc, 'Products Catalog Report');

  const totalProducts = products.length;
  const inStock = products.filter(p => p.inStock).length;
  const outOfStock = totalProducts - inStock;
  const avgPrice = products.reduce((sum, p) => sum + (p.basePrice || p.price || 0), 0) / (totalProducts || 1);

  const tableY = addSummaryCards(doc, [
    { label: 'Total Catalog', value: totalProducts.toString() },
    { label: 'In Stock', value: inStock.toString() },
    { label: 'Out of Stock', value: outOfStock.toString() },
    { label: 'Avg Price', value: `$${avgPrice.toFixed(2)}` },
  ], 48);

  doc.autoTable({
    startY: tableY,
    head: [['SKU', 'Product Name', 'Category', 'Price', 'Stock Status', 'Product Status']],
    body: products.map(p => [
      p.sku || 'N/A', p.name, p.category, `$${(p.basePrice || p.price || 0).toFixed(2)}`,
      p.inStock ? 'In Stock' : 'Out of Stock',
      (p.productStatus || 'active').toUpperCase()
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(filename || `BloomPro_Products_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportSubscriptionsPDF(subscriptions: SubscriptionItem[], filename?: string) {
  const doc = new jsPDF();
  addHeader(doc, 'Subscriptions Report');

  const total = subscriptions.length;
  const active = subscriptions.filter(s => s.status === 'active').length;
  const paused = subscriptions.filter(s => s.status === 'paused').length;
  const mrr = subscriptions.reduce((sum, s) => sum + (s.value || 0), 0);

  const tableY = addSummaryCards(doc, [
    { label: 'Total Accounts', value: total.toString() },
    { label: 'Active', value: active.toString() },
    { label: 'Paused', value: paused.toString() },
    { label: 'MRR Value', value: `$${mrr.toLocaleString(undefined, {minimumFractionDigits: 2})}` },
  ], 48);

  doc.autoTable({
    startY: tableY,
    head: [['Customer', 'Product', 'Frequency', 'Next Delivery', 'Monthly Value', 'Status']],
    body: subscriptions.map(s => [
      s.customerName, s.product, s.frequency.toUpperCase(),
      new Date(s.nextDelivery).toLocaleDateString(),
      `$${s.value.toFixed(2)}`,
      s.status.toUpperCase()
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(filename || `BloomPro_Subscriptions_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportEventsPDF(events: EventItem[], filename?: string) {
  const doc = new jsPDF();
  addHeader(doc, 'Events & Weddings Report');

  const total = events.length;
  const budgetSum = events.reduce((sum, e) => sum + (e.budget || 0), 0);
  const planning = events.filter(e => e.status === 'planning').length;
  const confirmed = events.filter(e => e.status === 'confirmed').length;

  const tableY = addSummaryCards(doc, [
    { label: 'Total Events', value: total.toString() },
    { label: 'Gross Budget', value: `$${budgetSum.toLocaleString()}` },
    { label: 'Planning', value: planning.toString() },
    { label: 'Confirmed', value: confirmed.toString() },
  ], 48);

  doc.autoTable({
    startY: tableY,
    head: [['Event Name', 'Type', 'Date', 'Client', 'Budget', 'Status']],
    body: events.map(e => [
      e.name, e.type, new Date(e.date).toLocaleDateString(), e.client,
      `$${e.budget.toFixed(2)}`,
      e.status.toUpperCase()
    ]),
    headStyles: { fillColor: SAGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(filename || `BloomPro_Events_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportBalanceSheetPDF(result: any, periodName: string) {
  const doc = new jsPDF();
  addHeader(doc, 'Balance Sheet', `As of ${periodName}`);

  const fmt = (n: number) => n < 0 ? `(${Math.abs(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})})` : `$${n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
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
  doc.text('Prepared by: BloomPro Studio Finance  •  Unaudited — For Management Use Only', 14, tableY - 2);

  // Assets section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(74, 107, 80);
  doc.text('ASSETS', 14, tableY + 4);

  const assetsRows = result.assets.map((a: any) => ['    ' + a.name, fmt(a.balance)]);
  assetsRows.push([{ content: 'Total Assets', styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }, { content: fmt(totalAssets), styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }]);

  doc.autoTable({
    startY: tableY + 8,
    head: [['Asset Account', 'Balance']],
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
  doc.text('LIABILITIES', 110, tableY + 4);

  const liabRows = result.liabilities.map((l: any) => ['    ' + l.name, fmt(l.balance)]);
  liabRows.push([{ content: 'Total Liabilities', styles: { fontStyle: 'bold' } }, { content: fmt(totalLiabilities), styles: { fontStyle: 'bold' } }]);

  doc.autoTable({
    startY: nextY,
    head: [['Liability Account', 'Balance']],
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
  doc.text('OWNER EQUITY', 110, nextY);

  const equityRows = result.equity.map((e: any) => ['    ' + e.name, fmt(e.balance)]);
  equityRows.push([{ content: 'Total Equity', styles: { fontStyle: 'bold' } }, { content: fmt(totalEquity), styles: { fontStyle: 'bold' } }]);

  doc.autoTable({
    startY: nextY + 4,
    head: [['Equity Account', 'Balance']],
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
  doc.text('TOTAL LIABILITIES & EQUITY', 18, nextY + 8);
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

  addFooter(doc);
  doc.save(`BloomPro_Balance_Sheet_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportIncomeStatementPDF(result: any, periodName: string) {
  const doc = new jsPDF();
  addHeader(doc, 'Income Statement (Profit & Loss)', `Period: ${periodName}`);

  const fmt = (n: number) => n < 0 ? `(${Math.abs(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})})` : `$${n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
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
  doc.text('Prepared by: BloomPro Studio Finance  •  Unaudited — For Management Use Only', 14, tableY - 2);

  // Revenue Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(74, 107, 80);
  doc.text('OPERATING REVENUES', 14, tableY + 4);

  const revRows = result.revenues.map((r: any) => ['    ' + r.name, fmt(r.balance), 'Revenue']);
  revRows.push([{ content: 'Total Operating Revenue', styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }, { content: fmt(totalRevenue), styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } }, '']);

  doc.autoTable({
    startY: tableY + 8,
    head: [['Account', 'Balance', 'Type']],
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
    head: [['Account', 'Balance', 'Type']],
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

  addFooter(doc);
  doc.save(`BloomPro_Income_Statement_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportTrialBalancePDF(result: any, periodName: string) {
  const doc = new jsPDF();
  addHeader(doc, 'General Ledger Trial Balance', `Period: ${periodName}`);

  const fmt = (n: number) => n > 0 ? `$${n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—';

  const tableY = addSummaryCards(doc, [
    { label: 'Total Debits', value: `$${result.totalDebits.toLocaleString(undefined, {minimumFractionDigits: 2})}` },
    { label: 'Total Credits', value: `$${result.totalCredits.toLocaleString(undefined, {minimumFractionDigits: 2})}` },
    { label: 'Difference', value: `$${result.difference.toFixed(2)}` },
    { label: 'Status', value: result.isBalanced ? '✓ Balanced' : '✗ Unbalanced' },
  ], 52);

  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Prepared by: BloomPro Studio Finance  •  Unaudited — For Management Use Only', 14, tableY - 2);

  const rows = result.lines.map((l: any) => [
    l.code,
    l.name,
    l.type.toUpperCase(),
    fmt(l.debit),
    fmt(l.credit),
  ]);

  rows.push([
    { content: '', styles: {} },
    { content: 'TOTALS', styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } },
    { content: '', styles: { fillColor: [245, 241, 231] } },
    { content: `$${result.totalDebits.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } },
    { content: `$${result.totalCredits.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [245, 241, 231] } },
  ]);

  doc.autoTable({
    startY: tableY + 2,
    head: [['Code', 'Account Name', 'Type', 'Debit ($)', 'Credit ($)']],
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
    doc.text(`✗  Out of Balance by $${result.difference.toFixed(2)} — Review journal entries`, 18, nextY + 7);
  }

  addFooter(doc);
  doc.save(`BloomPro_Trial_Balance_${new Date().toISOString().split('T')[0]}.pdf`);
}
