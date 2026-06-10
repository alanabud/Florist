import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Customer, Order, PaymentRecord } from '../store/adminStore';
import * as XLSX from 'xlsx-js-style';

export interface StatementActivity {
  id: string;
  date: string;
  type: 'Invoice' | 'Payment' | 'Void' | 'Refund' | 'Reversal';
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface StatementData {
  customer: Customer;
  startDate: string;
  endDate: string;
  openingArBalance: number;
  openingCreditBalance: number;
  openingNetBalance: number;
  endingArBalance: number;
  endingCreditBalance: number;
  endingNetBalance: number;
  activities: StatementActivity[];
  aging: {
    current: number;      // 0-30 days
    thirtyToSixty: number; // 31-60 days
    sixtyToNinety: number; // 61-90 days
    overNinety: number;    // 90+ days
  };
}

/**
 * Formats a date or timestamp to YYYY-MM-DD in America/New_York timezone.
 */
export function getLocalDateInNY(dateInput: any): string {
  if (!dateInput) return '';
  let date: Date;
  if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else if (dateInput.seconds) {
    date = new Date(dateInput.seconds * 1000);
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    date = new Date(dateInput);
  }
  
  if (isNaN(date.getTime())) return '';
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Generate Statement Data for a customer within a cutoff window.
 */
export async function generateCustomerStatement(
  customerId: string,
  startDateStr: string, // YYYY-MM-DD
  endDateStr: string    // YYYY-MM-DD
): Promise<StatementData> {
  // 1. Fetch customer details
  const customerSnap = await getDoc(doc(db, 'customers', customerId));
  if (!customerSnap.exists()) {
    throw new Error(`Customer ${customerId} not found`);
  }
  const customer = { id: customerSnap.id, ...customerSnap.data() } as Customer;

  // 2. Fetch all orders for this customer (only posted/reversed)
  const ordersSnap = await getDocs(
    query(collection(db, 'orders'), where('customerId', '==', customerId))
  );
  const orders = ordersSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as Order))
    .filter(o => o.glPostingStatus === 'posted' || o.glPostingStatus === 'reversed');

  // 3. Fetch all payments for this customer
  const paymentsSnap = await getDocs(
    query(collection(db, 'payments'), where('customerId', '==', customerId))
  );
  const payments = paymentsSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as PaymentRecord))
    .filter(p => p.glPostingStatus === 'posted' || p.glPostingStatus === 'reversed');

  // Time boundaries (we compare strings YYYY-MM-DD directly)
  const startDate = startDateStr;
  const endDate = endDateStr;

  // 4. Calculate Opening Balances (all activities before startDate)
  let openingArBalance = 0;
  let openingCreditBalance = 0;

  // Process orders before startDate
  orders.forEach(o => {
    const orderDate = getLocalDateInNY(o.createdAt || o.deliveryDate);
    if (orderDate && orderDate < startDate) {
      openingArBalance += o.total;

      // If reversed before startDate, apply credit
      if (o.glPostingStatus === 'reversed') {
        const revDate = getLocalDateInNY(o.reversalDate || o.lastUpdatedDate || o.createdAt);
        if (revDate && revDate < startDate) {
          openingArBalance -= o.total;
        }
      }
    }
  });

  // Process payments and refunds before startDate
  payments.forEach(p => {
    const paymentDate = getLocalDateInNY(p.paymentDate || p.createdAt);
    if (paymentDate && paymentDate < startDate) {
      // Amount allocated reduces AR balance
      const allocationTotal = p.allocations.reduce((sum, a) => sum + a.amountApplied, 0);
      openingArBalance -= allocationTotal;

      // Amount unapplied increases Customer Credit
      openingCreditBalance += p.unappliedAmount;

      // Restore if payment was voided/reversed before startDate
      if (p.glPostingStatus === 'reversed') {
        const voidDate = getLocalDateInNY(p.updatedAt || p.createdAt);
        if (voidDate && voidDate < startDate) {
          openingArBalance += allocationTotal;
          openingCreditBalance -= p.unappliedAmount;
        }
      }

      // Process refunds of credit before startDate
      const refunds = (p as any).refunds || [];
      refunds.forEach((ref: any) => {
        const refundDate = getLocalDateInNY(ref.refundDate);
        if (refundDate && refundDate < startDate) {
          openingCreditBalance -= ref.refundAmount;
        }
      });
    }
  });

  const openingNetBalance = Math.round((openingArBalance - openingCreditBalance) * 100) / 100;

  // 5. Gather Activities in the selected window (startDate <= date <= endDate)
  const activities: Omit<StatementActivity, 'runningBalance'>[] = [];

  // Add Invoices
  orders.forEach(o => {
    const orderDate = getLocalDateInNY(o.createdAt || o.deliveryDate);
    if (orderDate && orderDate >= startDate && orderDate <= endDate) {
      activities.push({
        id: `inv-${o.id}`,
        date: orderDate,
        type: 'Invoice',
        reference: o.orderNumber || `ORD-${o.id.substring(0, 6).toUpperCase()}`,
        debit: o.total,
        credit: 0
      });
    }

    // Add Order Reversals if occurred in period
    if (o.glPostingStatus === 'reversed') {
      const revDate = getLocalDateInNY(o.reversalDate || o.lastUpdatedDate || o.createdAt);
      if (revDate && revDate >= startDate && revDate <= endDate) {
        activities.push({
          id: `rev-${o.id}`,
          date: revDate,
          type: 'Reversal',
          reference: `REV-${o.orderNumber || o.id.substring(0, 6).toUpperCase()}`,
          debit: 0,
          credit: o.total
        });
      }
    }
  });

  // Add Payments
  payments.forEach(p => {
    const paymentDate = getLocalDateInNY(p.paymentDate || p.createdAt);
    if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
      const allocationTotal = p.allocations.reduce((sum, a) => sum + a.amountApplied, 0);
      activities.push({
        id: `pmt-${p.id}`,
        date: paymentDate,
        type: 'Payment',
        reference: p.paymentNumber,
        debit: 0,
        credit: allocationTotal // decreases AR
      });
    }

    // Add voids if occurred in period
    if (p.glPostingStatus === 'reversed') {
      const voidDate = getLocalDateInNY(p.updatedAt || p.createdAt);
      if (voidDate && voidDate >= startDate && voidDate <= endDate) {
        const allocationTotal = p.allocations.reduce((sum, a) => sum + a.amountApplied, 0);
        activities.push({
          id: `void-${p.id}`,
          date: voidDate,
          type: 'Void',
          reference: `VOID-${p.paymentNumber}`,
          debit: allocationTotal, // restores AR
          credit: 0
        });
      }
    }

    // Add refunds if occurred in period
    const refunds = (p as any).refunds || [];
    refunds.forEach((ref: any, idx: number) => {
      const refundDate = getLocalDateInNY(ref.refundDate);
      if (refundDate && refundDate >= startDate && refundDate <= endDate) {
        activities.push({
          id: `ref-${p.id}-${idx}`,
          date: refundDate,
          type: 'Refund',
          reference: `REF-${p.paymentNumber}`,
          debit: 0, // does not affect AR directly, but let's list it for transparency of credit transactions
          credit: 0
        });
      }
    });
  });

  // Sort activities by date ascending
  activities.sort((a, b) => a.date.localeCompare(b.date));

  // Compute Running Net Balance
  let currentBalance = openingNetBalance;
  const activitiesWithRunning: StatementActivity[] = activities.map(act => {
    let netDebit = act.debit;
    const netCredit = act.credit;
    if (act.type === 'Refund') {
      // A refund of credit increases the net customer balance due
      netDebit = 0; // handled separately or let's say it does not affect AR
    }
    currentBalance = Math.round((currentBalance + netDebit - netCredit) * 100) / 100;
    return {
      ...act,
      runningBalance: currentBalance
    };
  });

  // 6. Calculate Ending Balances in the period
  let endingArBalance = openingArBalance;
  let endingCreditBalance = openingCreditBalance;

  // Period changes
  activities.forEach(act => {
    if (act.type === 'Invoice' || act.type === 'Void') {
      endingArBalance += act.debit;
    } else if (act.type === 'Payment' || act.type === 'Reversal') {
      endingArBalance -= act.credit;
    }
  });

  // Credit balance period changes
  payments.forEach(p => {
    const paymentDate = getLocalDateInNY(p.paymentDate || p.createdAt);
    const inPeriod = paymentDate && paymentDate >= startDate && paymentDate <= endDate;
    if (inPeriod) {
      endingCreditBalance += p.unappliedAmount;
      if (p.glPostingStatus === 'reversed') {
        const voidDate = getLocalDateInNY(p.updatedAt || p.createdAt);
        if (voidDate && voidDate >= startDate && voidDate <= endDate) {
          endingCreditBalance -= p.unappliedAmount;
        }
      }
    } else if (paymentDate && paymentDate < startDate) {
      // void of older payment in this period
      if (p.glPostingStatus === 'reversed') {
        const voidDate = getLocalDateInNY(p.updatedAt || p.createdAt);
        if (voidDate && voidDate >= startDate && voidDate <= endDate) {
          endingCreditBalance -= p.unappliedAmount;
        }
      }
    }

    // refunds in period
    const refunds = (p as any).refunds || [];
    refunds.forEach((ref: any) => {
      const refundDate = getLocalDateInNY(ref.refundDate);
      if (refundDate && refundDate >= startDate && refundDate <= endDate) {
        endingCreditBalance -= ref.refundAmount;
      }
    });
  });

  const endingNetBalance = Math.round((endingArBalance - endingCreditBalance) * 100) / 100;

  // 7. Aging Calculations as of endDate
  const aging = {
    current: 0,
    thirtyToSixty: 0,
    sixtyToNinety: 0,
    overNinety: 0
  };

  orders.forEach(o => {
    // Only count active posted invoices (not cancelled/reversed)
    if (o.glPostingStatus !== 'posted') return;
    if (o.status === 'draft' || o.status === 'cancelled' || o.status === 'refunded') return;

    const orderDate = getLocalDateInNY(o.createdAt || o.deliveryDate);
    if (orderDate && orderDate <= endDate) {
      // Calculate payment allocations to this order before or on endDate
      let amountAppliedBeforeEndDate = 0;
      payments.forEach(p => {
        const paymentDate = getLocalDateInNY(p.paymentDate || p.createdAt);
        if (paymentDate && paymentDate <= endDate) {
          const alloc = p.allocations.find(a => a.orderId === o.id);
          if (alloc) {
            amountAppliedBeforeEndDate += alloc.amountApplied;
            
            // Deduct if voided on or before endDate
            if (p.glPostingStatus === 'reversed') {
              const voidDate = getLocalDateInNY(p.updatedAt || p.createdAt);
              if (voidDate && voidDate <= endDate) {
                amountAppliedBeforeEndDate -= alloc.amountApplied;
              }
            }
          }
        }
      });

      const historicalBalanceDue = Math.max(0, Math.round((o.total - amountAppliedBeforeEndDate) * 100) / 100);

      if (historicalBalanceDue > 0) {
        const endD = new Date(endDate);
        const ordD = new Date(orderDate);
        const diffTime = endD.getTime() - ordD.getTime();
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        if (diffDays <= 30) {
          aging.current += historicalBalanceDue;
        } else if (diffDays <= 60) {
          aging.thirtyToSixty += historicalBalanceDue;
        } else if (diffDays <= 90) {
          aging.sixtyToNinety += historicalBalanceDue;
        } else {
          aging.overNinety += historicalBalanceDue;
        }
      }
    }
  });

  // Round aging buckets
  aging.current = Math.round(aging.current * 100) / 100;
  aging.thirtyToSixty = Math.round(aging.thirtyToSixty * 100) / 100;
  aging.sixtyToNinety = Math.round(aging.sixtyToNinety * 100) / 100;
  aging.overNinety = Math.round(aging.overNinety * 100) / 100;

  return {
    customer,
    startDate: startDateStr,
    endDate: endDateStr,
    openingArBalance: Math.round(openingArBalance * 100) / 100,
    openingCreditBalance: Math.round(openingCreditBalance * 100) / 100,
    openingNetBalance,
    endingArBalance: Math.round(endingArBalance * 100) / 100,
    endingCreditBalance: Math.round(endingCreditBalance * 100) / 100,
    endingNetBalance,
    activities: activitiesWithRunning,
    aging
  };
}

/**
 * Export Statement as beautifully branded PDF (using browser window print)
 */
export function exportStatementPdf(statement: StatementData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up blocker is enabled. Please allow popups for PDF statement export.');
    return;
  }

  const actRows = statement.activities.map(act => `
    <tr>
      <td>${act.date}</td>
      <td>${act.type}</td>
      <td>${act.reference}</td>
      <td style="text-align: right">${act.debit > 0 ? `$${act.debit.toFixed(2)}` : '—'}</td>
      <td style="text-align: right">${act.credit > 0 ? `$${act.credit.toFixed(2)}` : '—'}</td>
      <td style="text-align: right; font-weight: 600">$${act.runningBalance.toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Statement - ${statement.customer.name}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Outfit', sans-serif;
          color: #2C302E;
          margin: 0;
          padding: 40px;
          line-height: 1.5;
          background-color: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #E8EAE6;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .brand-title {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          color: #4A6B50;
          margin: 0 0 5px 0;
        }
        .brand-subtitle {
          font-size: 12px;
          color: #6b7280;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin: 0;
        }
        .statement-title {
          font-size: 36px;
          font-weight: 700;
          color: #2C302E;
          margin: 0;
          text-align: right;
        }
        .statement-dates {
          font-size: 14px;
          color: #6b7280;
          text-align: right;
          margin-top: 5px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
        }
        .info-block h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: #6b7280;
          letter-spacing: 1px;
          margin: 0 0 10px 0;
          border-bottom: 1px solid #E8EAE6;
          padding-bottom: 5px;
        }
        .info-block p {
          margin: 0 0 5px 0;
          font-size: 14px;
        }
        .summary-banner {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          background-color: #FAFAF8;
          border: 1px solid #E8EAE6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 40px;
          text-align: center;
        }
        .summary-card {
          border-right: 1px solid #E8EAE6;
        }
        .summary-card:last-child {
          border-right: none;
        }
        .summary-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #6b7280;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }
        .summary-value {
          font-size: 20px;
          font-weight: 700;
          color: #2C302E;
        }
        .summary-value.net {
          color: #4A6B50;
        }
        .activity-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 40px;
        }
        .activity-table th {
          background-color: #FAFAF8;
          border-bottom: 2px solid #E8EAE6;
          padding: 12px 10px;
          font-size: 11px;
          text-transform: uppercase;
          color: #6b7280;
          letter-spacing: 0.5px;
          text-align: left;
        }
        .activity-table td {
          padding: 12px 10px;
          font-size: 13px;
          border-bottom: 1px dashed #E8EAE6;
        }
        .activity-table tr:hover {
          background-color: #fbfbfb;
        }
        .aging-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 30px;
          border: 1px solid #E8EAE6;
          border-radius: 6px;
        }
        .aging-table th {
          background-color: #E8EAE6;
          padding: 10px;
          font-size: 11px;
          text-transform: uppercase;
          color: #2C302E;
          letter-spacing: 0.5px;
          text-align: center;
        }
        .aging-table td {
          padding: 12px;
          font-size: 14px;
          text-align: center;
          font-weight: 600;
        }
        .footer {
          margin-top: 60px;
          border-top: 1px solid #E8EAE6;
          padding-top: 20px;
          text-align: center;
          font-size: 11px;
          color: #9ca3af;
        }
        @media print {
          body {
            padding: 20px;
          }
          .summary-banner {
            background-color: #FAFAF8 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="brand-title">BloomPro Studio</h1>
          <p class="brand-subtitle">Premium Floral Artistry</p>
        </div>
        <div>
          <h2 class="statement-title">STATEMENT OF ACCOUNT</h2>
          <div class="statement-dates">
            ${statement.startDate} to ${statement.endDate}
          </div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-block">
          <h3>Customer Details</h3>
          <p style="font-weight: 600; font-size: 16px;">${statement.customer.name}</p>
          <p>${statement.customer.email}</p>
          <p>${statement.customer.phone}</p>
          <p>${statement.customer.billingAddress || 'No Billing Address'}</p>
        </div>
        <div class="info-block">
          <h3>Business Contact</h3>
          <p style="font-weight: 600; font-size: 16px;">BloomPro Studio Inc.</p>
          <p>100 Floral Avenue, Suite 400</p>
          <p>New York, NY 10001</p>
          <p>billing@bloompro.studio | (555) 019-9231</p>
        </div>
      </div>

      <div class="summary-banner">
        <div class="summary-card">
          <div class="summary-label">Ending AR Balance</div>
          <div class="summary-value">$${statement.endingArBalance.toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Available Credit</div>
          <div class="summary-value">$${statement.endingCreditBalance.toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Net Amount Due</div>
          <div class="summary-value net">$${statement.endingNetBalance.toFixed(2)}</div>
        </div>
      </div>

      <h3 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin-bottom: 15px;">Statement Activity</h3>
      <table class="activity-table">
        <thead>
          <tr>
            <th style="width: 15%">Date</th>
            <th style="width: 15%">Type</th>
            <th style="width: 25%">Reference</th>
            <th style="width: 15%; text-align: right">Charge (Debit)</th>
            <th style="width: 15%; text-align: right">Payment (Credit)</th>
            <th style="width: 15%; text-align: right">Running Net Due</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${statement.startDate}</td>
            <td style="font-style: italic">Opening Balance</td>
            <td>—</td>
            <td style="text-align: right">${statement.openingArBalance > 0 ? `$${statement.openingArBalance.toFixed(2)}` : '—'}</td>
            <td style="text-align: right">${statement.openingCreditBalance > 0 ? `$${statement.openingCreditBalance.toFixed(2)}` : '—'}</td>
            <td style="text-align: right; font-weight: 600">$${statement.openingNetBalance.toFixed(2)}</td>
          </tr>
          ${actRows}
        </tbody>
      </table>

      <h3 style="font-size: 14px; text-transform: uppercase; color: #6b7280; margin-bottom: 15px;">Aging Summary (As of ${statement.endDate})</h3>
      <table class="aging-table">
        <thead>
          <tr>
            <th>Current (0-30 days)</th>
            <th>31 - 60 Days</th>
            <th>61 - 90 Days</th>
            <th>90+ Days Past Due</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>$${statement.aging.current.toFixed(2)}</td>
            <td>$${statement.aging.thirtyToSixty.toFixed(2)}</td>
            <td>$${statement.aging.sixtyToNinety.toFixed(2)}</td>
            <td style="color: ${statement.aging.overNinety > 0 ? '#991B1B' : '#2C302E'}">$${statement.aging.overNinety.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <p>Thank you for your business. For billing inquiries, please contact our support department.</p>
        <p>BloomPro Studio — Unaudited Customer Statement</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Export Statement as beautifully branded Excel file (SheetJS)
 */
export function exportStatementExcel(statement: StatementData) {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  ws['!ref'] = 'A1';

  // Styles
  const SAGE_RGB = '6C8271';
  const SAGE_DARK_RGB = '4A6B50';
  const CREAM_RGB = 'F5F1E7';
  const BG_LIGHT_RGB = 'FAFAF8';
  const BORDER_RGB = 'E8EAE6';
  const TEXT_DARK = '2C302E';
  const TEXT_MUTED = '6b7280';

  const titleStyle: XLSX.CellStyle = {
    font: { bold: true, sz: 16, color: { rgb: TEXT_DARK }, name: 'Calibri' },
    alignment: { vertical: 'center' },
  };

  const subtitleStyle: XLSX.CellStyle = {
    font: { sz: 10, color: { rgb: TEXT_MUTED }, name: 'Calibri' },
    alignment: { vertical: 'center' },
  };

  const headerStyle: XLSX.CellStyle = {
    fill: { fgColor: { rgb: SAGE_RGB } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
    alignment: { vertical: 'center', horizontal: 'left' },
    border: { bottom: { style: 'thin', color: { rgb: SAGE_DARK_RGB } } },
  };

  const accountingFormat = '#,##0.00;(#,##0.00);"—"';

  const dataStyle: XLSX.CellStyle = {
    font: { sz: 10, color: { rgb: TEXT_DARK }, name: 'Calibri' },
    alignment: { vertical: 'center' },
    border: { bottom: { style: 'hair', color: { rgb: BORDER_RGB } } },
  };

  const altStyle: XLSX.CellStyle = {
    ...dataStyle,
    fill: { fgColor: { rgb: BG_LIGHT_RGB } }
  };

  const boldDataStyle: XLSX.CellStyle = {
    ...dataStyle,
    font: { bold: true, sz: 10, color: { rgb: TEXT_DARK }, name: 'Calibri' }
  };

  const totalRowStyle: XLSX.CellStyle = {
    font: { bold: true, sz: 11, color: { rgb: TEXT_DARK }, name: 'Calibri' },
    fill: { fgColor: { rgb: CREAM_RGB } },
    border: {
      top: { style: 'thin', color: { rgb: TEXT_DARK } },
      bottom: { style: 'double' as any, color: { rgb: TEXT_DARK } }
    }
  };

  const setCell = (r: number, c: number, v: any, style?: XLSX.CellStyle, format?: string) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    const cell: XLSX.CellObject = { v, t: typeof v === 'number' ? 'n' : 's' };
    if (style) cell.s = style;
    if (format) cell.z = format;
    ws[ref] = cell;
  };

  const ensureRange = (maxRow: number, maxCol: number) => {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    if (maxRow > range.e.r) range.e.r = maxRow;
    if (maxCol > range.e.c) range.e.c = maxCol;
    ws['!ref'] = XLSX.utils.encode_range(range);
  };

  // 1. Branding Header
  setCell(0, 0, 'BloomPro Studio — Customer Statement', titleStyle);
  setCell(1, 0, `Statement Period: ${statement.startDate} to ${statement.endDate}`, subtitleStyle);
  setCell(2, 0, `Generated: ${new Date().toLocaleString()}`, subtitleStyle);

  // 2. Info Grid
  setCell(4, 0, 'CUSTOMER DETAILS', { font: { bold: true, sz: 10, color: { rgb: SAGE_DARK_RGB } } });
  setCell(5, 0, statement.customer.name, boldDataStyle);
  setCell(6, 0, statement.customer.email, dataStyle);
  setCell(7, 0, statement.customer.phone, dataStyle);
  setCell(8, 0, statement.customer.billingAddress || 'No Billing Address', dataStyle);

  setCell(4, 3, 'BUSINESS DETAILS', { font: { bold: true, sz: 10, color: { rgb: SAGE_DARK_RGB } } });
  setCell(5, 3, 'BloomPro Studio Inc.', boldDataStyle);
  setCell(6, 3, '100 Floral Avenue, Suite 400', dataStyle);
  setCell(7, 3, 'New York, NY 10001', dataStyle);
  setCell(8, 3, 'billing@bloompro.studio', dataStyle);

  // 3. Balance Summary Box
  setCell(10, 0, 'SUMMARY OF BALANCES', { font: { bold: true, sz: 10, color: { rgb: SAGE_DARK_RGB } } });
  setCell(11, 0, 'Ending AR Balance', dataStyle);
  setCell(11, 1, statement.endingArBalance, { ...boldDataStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(12, 0, 'Available Credit Balance', dataStyle);
  setCell(12, 1, statement.endingCreditBalance, { ...boldDataStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(13, 0, 'Net Customer Balance Due', totalRowStyle);
  setCell(13, 1, statement.endingNetBalance, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);

  // 4. Activity Table Headers
  let r = 15;
  const headers = ['Transaction Date', 'Activity Type', 'Reference', 'Charge (Debit)', 'Payment (Credit)', 'Net Running Due'];
  headers.forEach((h, ci) => {
    setCell(r, ci, h, headerStyle);
  });
  r++;

  // Opening Balance Row
  setCell(r, 0, statement.startDate, dataStyle);
  setCell(r, 1, 'Opening Balance', { ...dataStyle, font: { italic: true } });
  setCell(r, 2, '—', dataStyle);
  setCell(r, 3, statement.openingArBalance > 0 ? statement.openingArBalance : '', { ...dataStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(r, 4, statement.openingCreditBalance > 0 ? statement.openingCreditBalance : '', { ...dataStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(r, 5, statement.openingNetBalance, { ...boldDataStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  r++;

  // Activities Rows
  statement.activities.forEach((act, idx) => {
    const style = idx % 2 === 0 ? altStyle : dataStyle;
    setCell(r, 0, act.date, style);
    setCell(r, 1, act.type, style);
    setCell(r, 2, act.reference, style);
    setCell(r, 3, act.debit > 0 ? act.debit : '', { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    setCell(r, 4, act.credit > 0 ? act.credit : '', { ...style, alignment: { horizontal: 'right' } }, accountingFormat);
    setCell(r, 5, act.runningBalance, { ...boldDataStyle, alignment: { horizontal: 'right' } }, accountingFormat);
    r++;
  });

  // Totals Row
  setCell(r, 0, 'Ending Balance', totalRowStyle);
  setCell(r, 1, '', totalRowStyle);
  setCell(r, 2, '', totalRowStyle);
  setCell(r, 3, statement.endingArBalance, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(r, 4, statement.endingCreditBalance, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(r, 5, statement.endingNetBalance, { ...totalRowStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  r++;

  // 5. Aging Summary Box
  r += 2;
  setCell(r, 0, `AGING SUMMARY (As of ${statement.endDate})`, { font: { bold: true, sz: 10, color: { rgb: SAGE_DARK_RGB } } });
  r++;

  const agingHeaders = ['Current (0-30 days)', '31 - 60 Days', '61 - 90 Days', '90+ Days Past Due'];
  agingHeaders.forEach((h, ci) => {
    setCell(r, ci, h, headerStyle);
  });
  r++;

  setCell(r, 0, statement.aging.current, { ...boldDataStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(r, 1, statement.aging.thirtyToSixty, { ...boldDataStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(r, 2, statement.aging.sixtyToNinety, { ...boldDataStyle, alignment: { horizontal: 'right' } }, accountingFormat);
  setCell(r, 3, statement.aging.overNinety, { ...boldDataStyle, font: { bold: true, color: { rgb: statement.aging.overNinety > 0 ? '991B1B' : TEXT_DARK } }, alignment: { horizontal: 'right' } }, accountingFormat);

  ensureRange(r, 5);
  ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Statement of Account');
  XLSX.writeFile(wb, `Statement_${statement.customer.name.replace(/\s+/g, '_')}_${statement.endDate}.xlsx`);
}
