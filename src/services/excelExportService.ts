import * as XLSX from 'xlsx-js-style';
import { type Order, type InventoryItem, type Customer, type SubscriptionItem, type EventItem } from '../store/adminStore';
import { type Product } from '../data/products';

export type ReportRow = Array<string | number | boolean | null | undefined>;
export type ReportTable = ReportRow[];

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

const accountingFormat = '#,##0.00;(#,##0.00);"—"';

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
// Helpers
// ═══════════════════════════════════════════════════
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

function createStyledWorkbook(): XLSX.WorkBook {
  return XLSX.utils.book_new();
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

// Cover/Branding header applied to a worksheet
function addBrandingHeader(ws: XLSX.WorkSheet, title: string, period: string, startRow: number = 0): number {
  const now = new Date();
  setCell(ws, startRow, 0, 'BloomPro Studio', titleStyle);
  setCell(ws, startRow + 1, 0, title, { font: { bold: true, sz: 14, color: { rgb: SAGE_DARK_RGB }, name: 'Calibri' } });
  setCell(ws, startRow + 2, 0, '', subtitleStyle);
  setCell(ws, startRow + 3, 0, 'Reporting Period:', metaLabelStyle);
  setCell(ws, startRow + 3, 1, period, metaValueStyle);
  setCell(ws, startRow + 4, 0, 'Generated:', metaLabelStyle);
  setCell(ws, startRow + 4, 1, now.toLocaleString(), metaValueStyle);
  setCell(ws, startRow + 5, 0, 'Prepared By:', metaLabelStyle);
  setCell(ws, startRow + 5, 1, 'BloomPro Studio Finance', metaValueStyle);

  // Merge title cells
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: 3 } });
  ws['!merges'].push({ s: { r: startRow + 1, c: 0 }, e: { r: startRow + 1, c: 3 } });

  return startRow + 7;
}

// ═══════════════════════════════════════════════════
// Non-financial exports (legacy, with basic styling upgrade)
// ═══════════════════════════════════════════════════

function addSheet(wb: XLSX.WorkBook, data: ReportTable, name: string) {
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

export function exportDashboardExcel(data: {
  revenue: number; ordersToday: number; deliveries: number; lowStock: number; orders: Order[]; inventory: InventoryItem[];
}) {
  const wb = createStyledWorkbook();
  const dateStr = new Date().toISOString().split('T')[0];
  addSheet(wb, [
    ['BloomPro Studio — Dashboard Summary'],
    [`Generated: ${new Date().toLocaleString()}`], [],
    ['Metric', 'Value'],
    ['Revenue Today', `$${data.revenue.toLocaleString()}`],
    ['Orders Today', data.ordersToday],
    ['Active Deliveries', data.deliveries],
    ['Low Stock Alerts', data.lowStock],
  ], 'Summary');
  addSheet(wb, [
    ['Order ID', 'Customer', 'Status', 'Total', 'Payment Status', 'Due Date', 'Created Date'],
    ...data.orders.map(o => [
      o.id, o.customerName, (o.status || 'draft').replace('_', ' ').toUpperCase(), o.total,
      (o.paymentStatus || 'unpaid').toUpperCase(),
      o.dueDate ? new Date(o.dueDate).toLocaleDateString() : 'N/A',
      o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'
    ])
  ], 'Orders');
  downloadWorkbook(wb, `BloomPro_Dashboard_${dateStr}.xlsx`);
}

export function exportDetailedExcel(data: {
  revenue: number; ordersCount: number; aov: number; taxCollected: number; cashBalance: number;
  accountsReceivable: number; inventoryValue: number;
  ledger: { account: string; balance: number; type: string }[];
  orders: Order[]; inventory: InventoryItem[]; products: Product[]; customers: Customer[];
}) {
  const wb = createStyledWorkbook();
  const dateStr = new Date().toISOString().split('T')[0];
  addSheet(wb, [
    ['BLOOMPRO STUDIO — EXECUTIVE BUSINESS SUMMARY'],
    [`Report Date: ${new Date().toLocaleDateString()}`],
    [`Generated: ${new Date().toLocaleString()}`], [],
    ['Key Performance Metric', 'Value', 'Context'],
    ['Total Sales Revenue', `$${data.revenue.toFixed(2)}`, 'Sales & delivery fee revenues'],
    ['Total Orders Processed', data.ordersCount, 'Cumulative database order volume'],
    ['Average Order Value (AOV)', `$${data.aov.toFixed(2)}`, 'Revenue per transaction'],
    ['Sales Tax Liability', `$${data.taxCollected.toFixed(2)}`, 'Sales tax payable to states'],
    ['Cash Balance', `$${data.cashBalance.toFixed(2)}`, 'Total general ledger cash'],
    ['Accounts Receivable', `$${data.accountsReceivable.toFixed(2)}`, 'Unpaid credit balances'],
    ['Inventory Valuation', `$${data.inventoryValue.toFixed(2)}`, 'Total unit cost value of stock'],
  ], 'Executive Summary');
  addSheet(wb, [
    ['GL Account Name', 'Current Balance', 'Account Classification'],
    ...data.ledger.map(acc => [acc.account, acc.balance, acc.type])
  ], 'General Ledger');
  addSheet(wb, [
    ['Order ID', 'Customer Name', 'Customer Email', 'Status', 'Total Price ($)', 'Subtotal ($)',
      'Taxes ($)', 'Delivery Fee ($)', 'Discount ($)', 'Payment Status', 'Payment Method', 'Amount Paid ($)',
      'Balance Due ($)', 'Due Date', 'Delivery Date', 'Delivery Window', 'Fulfillment Status',
      'Assigned Courier', 'Route Number', 'Priority', 'Store Location', 'Sales Channel', 'Occasion'],
    ...data.orders.map(o => [
      o.id, o.customerName, o.customerEmail || '',
      (o.status || 'draft').toUpperCase().replace('_', ' '), o.total, o.subtotal || 0,
      o.taxes || 0, o.deliveryFee || 0, o.discount || 0,
      (o.paymentStatus || 'unpaid').toUpperCase(), o.paymentMethod || 'N/A',
      o.amountPaid || 0, o.balanceDue || 0,
      o.dueDate ? new Date(o.dueDate).toLocaleDateString() : 'N/A',
      o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : 'N/A',
      o.deliveryWindow || 'N/A', o.fulfillmentStatus || 'unfulfilled',
      o.courier || o.driver || 'N/A', o.routeNumber || 'N/A',
      o.priority || 'normal', o.storeLocation || 'N/A', o.salesChannel || 'N/A', o.occasion || 'N/A'
    ])
  ], 'Orders');
  addSheet(wb, [
    ['SKU Code', 'Item Name', 'Category', 'Quantity On Hand', 'Quantity Reserved', 'Quantity Available',
      'Reorder Level', 'Reorder Qty', 'Unit Material Cost ($)', 'Total Stock Value ($)',
      'Preferred Supplier', 'Storage Location', 'Shelf Life (Days)', 'Stem Condition', 'Waste Qty', 'Waste Reason'],
    ...data.inventory.map(i => [
      i.sku, i.name, i.category, i.quantity, i.quantityReserved || 0, i.quantityAvailable || 0,
      i.reorderPoint, i.reorderQuantity || 0, i.unitCost, i.quantity * i.unitCost,
      i.supplier, i.storageLocation || 'N/A', i.shelfLifeDays || 'N/A', i.condition || 'N/A',
      i.wasteQuantity || 0, i.wasteReason || 'N/A'
    ])
  ], 'Inventory Valuation');
  addSheet(wb, [
    ['Product ID', 'SKU', 'Name', 'Category', 'Base Price ($)', 'Sale Price ($)', 'Cost ($)',
      'Margin %', 'In Stock', 'Featured', 'Seasonal', 'Stock Qty', 'Reorder Point',
      'Preferred Supplier', 'Same-Day Eligible', 'Rating Score'],
    ...data.products.map(p => [
      p.id, p.sku || 'N/A', p.name, p.category, p.basePrice || p.price, p.salePrice || 0,
      p.cost || 0, p.marginPercent || 0, p.inStock ? 'YES' : 'NO', p.featuredProduct ? 'YES' : 'NO',
      p.seasonalProduct ? 'YES' : 'NO', p.stockQuantity || 0, p.reorderPoint || 0,
      p.preferredSupplier || 'N/A', p.isSameDay ? 'YES' : 'NO', p.rating
    ])
  ], 'Products');
  addSheet(wb, [
    ['Customer ID', 'Customer Name', 'Customer Type', 'Email Address', 'Phone Number',
      'Loyalty Tier', 'Billing Address', 'Delivery Address', 'City', 'State', 'ZIP',
      'Orders Placed', 'Lifetime Value ($)', 'Open Balance ($)', 'Credit Limit ($)', 'Preferred Payment'],
    ...data.customers.map(c => [
      c.id, c.name, c.customerType || 'retail', c.email, c.phone,
      c.loyaltyTier || 'bronze', c.billingAddress || 'N/A', c.deliveryAddress || 'N/A',
      c.city || 'N/A', c.state || 'N/A', c.zipCode || 'N/A',
      c.totalOrders, c.lifetimeValue, c.openBalance || 0, c.creditLimit || 0, c.preferredPaymentMethod || 'N/A'
    ])
  ], 'Customers');
  downloadWorkbook(wb, `BloomPro_Detailed_Report_${dateStr}.xlsx`);
}

export function exportOrdersExcel(orders: Order[], filename?: string) {
  const wb = createStyledWorkbook();
  addSheet(wb, [
    ['Order ID', 'Customer', 'Items', 'Status', 'Total', 'Payment Status', 'Due Date', 'Created Date'],
    ...orders.map(o => [
      o.id, o.customerName, (o.items !== undefined ? o.items : 1),
      (o.status || 'draft').replace('_', ' ').toUpperCase(), o.total,
      (o.paymentStatus || 'unpaid').toUpperCase(),
      o.dueDate ? new Date(o.dueDate).toLocaleDateString() : 'N/A',
      o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'
    ])
  ], 'Orders');
  downloadWorkbook(wb, filename || `BloomPro_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportInventoryExcel(inventory: InventoryItem[], filename?: string) {
  const wb = createStyledWorkbook();
  addSheet(wb, [
    ['SKU', 'Item', 'Category', 'On Hand', 'Reserved', 'Available', 'Reorder Point', 'Unit Cost', 'Supplier', 'Status'],
    ...inventory.map(i => [
      i.sku, i.name, i.category, i.quantity, i.quantityReserved || 0, i.quantityAvailable || 0, i.reorderPoint,
      i.unitCost, i.supplier,
      i.quantity <= i.reorderPoint ? (i.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK') : 'HEALTHY'
    ])
  ], 'Inventory');
  downloadWorkbook(wb, filename || `BloomPro_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportCustomersExcel(customers: Customer[]) {
  const wb = createStyledWorkbook();
  addSheet(wb, [
    ['Name', 'Email', 'Phone', 'Type', 'Tier', 'Total Orders', 'Lifetime Value', 'Open Balance'],
    ...customers.map(c => [
      c.name, c.email, c.phone, c.customerType || 'retail', c.loyaltyTier || 'bronze',
      c.totalOrders, c.lifetimeValue, c.openBalance || 0
    ])
  ], 'Customers');
  downloadWorkbook(wb, `BloomPro_Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportProductsExcel(products: Product[], filename?: string) {
  const wb = createStyledWorkbook();
  addSheet(wb, [
    ['SKU', 'Product Name', 'Category', 'Price', 'Stock Status', 'Product Status', 'Cost', 'Margin %', 'Supplier'],
    ...products.map(p => [
      p.sku || 'N/A', p.name, p.category, p.basePrice || p.price,
      p.inStock ? 'IN STOCK' : 'OUT OF STOCK',
      (p.productStatus || 'active').toUpperCase(),
      p.cost || 0, p.marginPercent || 0, p.preferredSupplier || 'N/A'
    ])
  ], 'Products');
  downloadWorkbook(wb, filename || `BloomPro_Products_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportSubscriptionsExcel(subscriptions: SubscriptionItem[], filename?: string) {
  const wb = createStyledWorkbook();
  addSheet(wb, [
    ['Customer Name', 'Product Name', 'Frequency', 'Next Delivery', 'Monthly Value', 'Status', 'Failed Payment Count', 'Preferred Colors'],
    ...subscriptions.map(s => [
      s.customerName, s.product, s.frequency.toUpperCase(),
      s.nextDelivery ? new Date(s.nextDelivery).toLocaleDateString() : 'N/A',
      s.value, s.status.toUpperCase(), s.failedPaymentCount || 0, (s.preferredColors || []).join(', ')
    ])
  ], 'Subscriptions');
  downloadWorkbook(wb, filename || `BloomPro_Subscriptions_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportEventsExcel(events: EventItem[], filename?: string) {
  const wb = createStyledWorkbook();
  addSheet(wb, [
    ['Event Name', 'Type', 'Event Date', 'Client Name', 'Total Budget', 'Status', 'Venue', 'Coordinator', 'Centerpiece Count'],
    ...events.map(e => [
      e.name, e.type, e.date ? new Date(e.date).toLocaleDateString() : 'N/A',
      e.client, e.budget, e.status.toUpperCase(), e.venue || 'N/A', e.coordinator || 'N/A', e.centerpieceCount || 0
    ])
  ], 'Events');
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
}, filename?: string) {
  const wb = createStyledWorkbook();
  const period = (filename || '').replace(/BloomPro_Financial_Workbook_/g, '').replace('.xlsx', '').replace(/_/g, ' ') || 'All Time';

  // ─── Sheet 1: Executive Summary ───
  buildExecutiveSummarySheet(wb, data, period);

  // ─── Sheet 2: Income Statement ───
  buildIncomeStatementSheet(wb, data, period);

  // ─── Sheet 3: Balance Sheet ───
  buildBalanceSheetSheet(wb, data, period);

  // ─── Sheet 4: Trial Balance ───
  buildTrialBalanceSheet(wb, data, period);

  // ─── Sheet 5: Chart of Accounts ───
  buildChartOfAccountsSheet(wb, data, period);

  // ─── Sheet 6: Journal Entries Log ───
  buildJournalEntriesSheet(wb, data, period);

  downloadWorkbook(wb, filename || `BloomPro_Financial_Workbook_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function buildExecutiveSummarySheet(wb: XLSX.WorkBook, data: any, period: string) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Executive Financial Summary', period);

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
      setCell(ws, r, 1, value, { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
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
  setCell(ws, r, 0, 'Unaudited — For Management Use Only', { font: { italic: true, sz: 8, color: { rgb: TEXT_MUTED } } });

  ensureRange(ws, r, 1);
  ws['!cols'] = [{ wch: 35 }, { wch: 22 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };

  XLSX.utils.book_append_sheet(wb, ws, 'Executive Summary');
}

function buildIncomeStatementSheet(wb: XLSX.WorkBook, data: any, period: string) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Income Statement (Profit & Loss)', period);

  // Revenue Header
  setCell(ws, r, 0, 'OPERATING REVENUES', sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.incomeStatement.revenues.forEach((rev: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + rev.name, style);
    setCell(ws, r, 1, rev.balance, { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Operating Revenue', totalRowStyle);
  setCell(ws, r, 1, data.incomeStatement.totalRevenue, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  r++;
  r++; // spacing

  // Expense Header
  setCell(ws, r, 0, 'COST & OPERATING EXPENSES', sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.incomeStatement.expenses.forEach((exp: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + exp.name, style);
    setCell(ws, r, 1, exp.balance, { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Operating Expenses', totalRowStyle);
  setCell(ws, r, 1, data.incomeStatement.totalExpense, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  r++;
  r++; // spacing

  // Net Income
  setCell(ws, r, 0, 'NET OPERATING INCOME', grandTotalStyle);
  setCell(ws, r, 1, data.incomeStatement.netIncome, { ...grandTotalStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  r++;

  // Margin note
  r++;
  setCell(ws, r, 0, `Net Margin: ${data.incomeStatement.netMarginPercent.toFixed(1)}%`, { font: { italic: true, sz: 9, color: { rgb: TEXT_MUTED } } });
  r++;
  setCell(ws, r, 0, 'Unaudited — For Management Use Only', { font: { italic: true, sz: 8, color: { rgb: TEXT_MUTED } } });

  ensureRange(ws, r, 1);
  ws['!cols'] = [{ wch: 45 }, { wch: 22 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Income Statement');
}

function buildBalanceSheetSheet(wb: XLSX.WorkBook, data: any, period: string) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Balance Sheet', period);

  // Assets
  setCell(ws, r, 0, 'ASSETS', sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.balanceSheet.assets.forEach((a: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + a.name, style);
    setCell(ws, r, 1, a.balance, { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Assets', totalRowStyle);
  setCell(ws, r, 1, data.balanceSheet.totalAssets, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  r++;
  r++;

  // Liabilities
  setCell(ws, r, 0, 'LIABILITIES', sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.balanceSheet.liabilities.forEach((l: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + l.name, style);
    setCell(ws, r, 1, l.balance, { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Liabilities', totalRowStyle);
  setCell(ws, r, 1, data.balanceSheet.totalLiabilities, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  r++;
  r++;

  // Equity
  setCell(ws, r, 0, 'OWNER EQUITY', sectionHeaderStyle);
  setCell(ws, r, 1, '', sectionHeaderStyle);
  r++;

  data.balanceSheet.equity.forEach((e: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, '    ' + e.name, style);
    setCell(ws, r, 1, e.balance, { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    r++;
  });

  setCell(ws, r, 0, 'Total Owner Equity', totalRowStyle);
  setCell(ws, r, 1, data.balanceSheet.totalEquity, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  r++;
  r++;

  // Grand total
  setCell(ws, r, 0, 'TOTAL LIABILITIES & EQUITY', grandTotalStyle);
  setCell(ws, r, 1, data.balanceSheet.totalLiabilitiesAndEquity, { ...grandTotalStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  r++;

  // Balanced verification
  r++;
  const isBalanced = data.balanceSheet.isBalanced;
  setCell(ws, r, 0, 'Balance Verification:', metaLabelStyle);
  setCell(ws, r, 1, isBalanced ? '✓ BALANCED — Assets = Liabilities + Equity' : '✗ OUT OF BALANCE',
    isBalanced ? badgePassStyle : badgeFailStyle);
  r++;
  setCell(ws, r, 0, 'Unaudited — For Management Use Only', { font: { italic: true, sz: 8, color: { rgb: TEXT_MUTED } } });

  ensureRange(ws, r, 1);
  ws['!cols'] = [{ wch: 45 }, { wch: 22 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
}

function buildTrialBalanceSheet(wb: XLSX.WorkBook, data: any, period: string) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'General Ledger Trial Balance', period);

  // Headers
  const headers = ['Account Code', 'Account Name', 'Classification', 'Debit ($)', 'Credit ($)', 'Net Balance ($)'];
  headers.forEach((h, ci) => {
    setCell(ws, r, ci, h, headerStyle);
  });
  r++;

  data.trialBalance.lines.forEach((line: any, i: number) => {
    const style = i % 2 === 0 ? dataStyle : altRowStyle;
    setCell(ws, r, 0, line.code, { ...style, font: { ...style.font, name: 'Consolas' } });
    setCell(ws, r, 1, line.name, style);
    setCell(ws, r, 2, line.type.toUpperCase(), { ...style, font: { ...style.font, sz: 9 } });
    setCell(ws, r, 3, line.debit > 0 ? line.debit : '', { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    setCell(ws, r, 4, line.credit > 0 ? line.credit : '', { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    setCell(ws, r, 5, line.netBalance, { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    r++;
  });

  // Totals row
  setCell(ws, r, 0, '', totalRowStyle);
  setCell(ws, r, 1, 'TOTALS', totalRowStyle);
  setCell(ws, r, 2, '', totalRowStyle);
  setCell(ws, r, 3, data.trialBalance.totalDebits, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(ws, r, 4, data.trialBalance.totalCredits, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(ws, r, 5, '', totalRowStyle);
  r++;

  // Status
  r++;
  const isBalanced = data.trialBalance.isBalanced;
  setCell(ws, r, 0, 'Double-Entry Verification:', metaLabelStyle);
  setCell(ws, r, 1, isBalanced ? '✓ BALANCED (Diff: $0.00)' : `✗ Out of Balance by $${data.trialBalance.difference.toFixed(2)}`,
    isBalanced ? badgePassStyle : badgeFailStyle);

  ensureRange(ws, r, 5);
  ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 7, c: 0 }, e: { r: 7 + data.trialBalance.lines.length, c: 5 } }) };

  XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
}

function buildChartOfAccountsSheet(wb: XLSX.WorkBook, data: any, period: string) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Chart of Accounts Registry', period);

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

function buildJournalEntriesSheet(wb: XLSX.WorkBook, data: any, period: string) {
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';
  let r = addBrandingHeader(ws, 'Journal Entries Log', period);

  const headers = ['Date', 'Entry Ref', 'Description', 'GL Account', 'Debit ($)', 'Credit ($)', 'Status', 'Created By'];
  headers.forEach((h, ci) => {
    setCell(ws, r, ci, h, headerStyle);
  });
  r++;

  let rowIdx = 0;
  data.journalEntries.forEach((je: any) => {
    const dateStr = je.createdAt ? new Date(je.createdAt.seconds ? je.createdAt.seconds * 1000 : je.createdAt).toLocaleDateString() : 'N/A';
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
      setCell(ws, r, 4, l.debit > 0 ? l.debit : '', { ...lineStyle, alignment: { horizontal: 'right' } }, accountingFormat);
      setCell(ws, r, 5, l.credit > 0 ? l.credit : '', { ...lineStyle, alignment: { horizontal: 'right' } }, accountingFormat);
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
  setCell(ws, r, 0, 'Unaudited — For Management Use Only', { font: { italic: true, sz: 8, color: { rgb: TEXT_MUTED } } });

  ensureRange(ws, r, 7);
  ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 36 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };

  XLSX.utils.book_append_sheet(wb, ws, 'Journal Entries');
}
