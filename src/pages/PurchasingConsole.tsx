import React, { useEffect, useState } from 'react';
import { useAdminStore } from '../store/adminStore';
import { useToastStore } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Truck, FileText, Plus, CreditCard, AlertTriangle
} from 'lucide-react';
import { cancelPurchaseOrder } from '../services/purchaseOrderService';
import { postVendorBill, voidVendorBill } from '../services/vendorBillService';
import { voidVendorPayment } from '../services/vendorPaymentService';
import styles from './FinanceAdmin.module.css';
import { useI18n } from '../i18n/I18nProvider';

export const PurchasingConsole: React.FC = () => {
  const { t } = useI18n();
  const {
    vendors,
    purchaseOrders,
    inventoryReceipts,
    vendorBills,
    vendorPayments,
    inventory,
    fetchVendors,
    fetchPurchaseOrders,
    fetchInventoryReceipts,
    fetchVendorBills,
    fetchVendorPayments,
    setActiveModal
  } = useAdminStore();

  const addToast = useToastStore(s => s.addToast);

  const [activeTab, setActiveTab] = useState<'vendors' | 'pos' | 'receiving' | 'bills' | 'payments' | 'reports'>('vendors');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchVendors();
    fetchPurchaseOrders();
    fetchInventoryReceipts();
    fetchVendorBills();
    fetchVendorPayments();
  }, [fetchVendors, fetchPurchaseOrders, fetchInventoryReceipts, fetchVendorBills, fetchVendorPayments]);

  // Calculations for Stats Ribbon
  const totalOpenAP = Math.round(vendorBills
    .filter(b => b.status === 'posted' || b.status === 'partially_paid')
    .reduce((sum, b) => sum + (b.balanceDue || 0), 0) * 100) / 100;

  const openPOCount = purchaseOrders
    .filter(po => po.status === 'ordered' || po.status === 'partially_received')
    .length;

  // GRNI (Goods Received Not Invoiced) Accrual = Sum over all PO lines of: (received - billed) * unitCost
  let grniAccrual = 0;
  purchaseOrders.forEach(po => {
    if (po.status !== 'cancelled' && po.status !== 'closed') {
      po.lines.forEach(line => {
        const received = line.quantityReceived || 0;
        const billed = line.quantityBilled || 0;
        if (received > billed) {
          grniAccrual += (received - billed) * line.unitCost;
        }
      });
    }
  });
  grniAccrual = Math.round(grniAccrual * 100) / 100;

  // Sum of Purchase Price Variances from all posted bills
  let ppvTotal = 0;
  vendorBills.forEach(bill => {
    if (bill.status === 'posted' || bill.status === 'paid' || bill.status === 'partially_paid') {
      if (bill.poId) {
        const matchingPO = purchaseOrders.find(po => po.id === bill.poId);
        if (matchingPO) {
          bill.lines.forEach(bLine => {
            const poLine = matchingPO.lines.find(pLine => pLine.sku === bLine.sku);
            if (poLine) {
              ppvTotal += bLine.quantity * (bLine.unitCost - poLine.unitCost);
            }
          });
        }
      }
    }
  });
  ppvTotal = Math.round(ppvTotal * 100) / 100;

  // Actions
  const handleCancelPO = async (poId: string) => {
    if (window.confirm(`Are you sure you want to cancel Purchase Order ${poId}?`)) {
      setIsProcessing(true);
      try {
        await cancelPurchaseOrder(poId, 'Admin');
        addToast(t('purchasingconsole.toast.poCancelled', { id: poId }), 'success');
      } catch (e: any) {
        addToast(e.message || 'Failed to cancel Purchase Order.', 'error');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handlePostBill = async (billId: string) => {
    setIsProcessing(true);
    try {
      await postVendorBill(billId, 'Admin');
      addToast(t('purchasingconsole.toast.billPosted', { id: billId }), 'success');
    } catch (e: any) {
      addToast(e.message || 'Failed to post Vendor Bill.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoidBill = async (billId: string) => {
    setIsProcessing(true);
    try {
      await voidVendorBill(billId, 'Admin');
      addToast(t('purchasingconsole.toast.billVoided', { id: billId }), 'success');
    } catch (e: any) {
      addToast(e.message || 'Failed to void Vendor Bill.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoidPayment = async (paymentId: string) => {
    setIsProcessing(true);
    try {
      await voidVendorPayment(paymentId, 'Admin');
      addToast(t('purchasingconsole.toast.paymentVoided', { id: paymentId }), 'success');
    } catch (e: any) {
      addToast(e.message || 'Failed to void Vendor Payment.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter Helper
  const matchesSearch = (text: string) => text.toLowerCase().includes(searchTerm.toLowerCase().trim());

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('purchasingconsole.purchasingPayablesConsole')}</h1>
        <p className={styles.subtitle}>
          Control the supply chain: setup vendor accounts, create POs, track warehouse receiving, register AP bills, and disburse cash.
        </p>
      </div>

      {/* Stats Ribbon */}
      <div className={styles.statsGrid}>
        <Card>
          <CardContent className={styles.statContent}>
            <div className={styles.statInfo}>
              <span className={styles.statName}>Accounts Payable (2000)</span>
              <span className={styles.statValue}>${totalOpenAP.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={styles.statIconWrapper}>
              <CreditCard className={styles.statIcon} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className={styles.statContent}>
            <div className={styles.statInfo}>
              <span className={styles.statName}>GRNI Clearing Accrual (2050)</span>
              <span className={styles.statValue}>${grniAccrual.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={styles.statIconWrapper} style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>
              <Truck className={styles.statIcon} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className={styles.statContent}>
            <div className={styles.statInfo}>
              <span className={styles.statName}>{t('purchasingconsole.activePurchaseOrders')}</span>
              <span className={styles.statValue}>{openPOCount} Orders</span>
            </div>
            <div className={styles.statIconWrapper} style={{ backgroundColor: '#FDF2F8', color: '#BE185D' }}>
              <FileText className={styles.statIcon} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className={styles.statContent}>
            <div className={styles.statInfo}>
              <span className={styles.statName}>Purchase Price Variance (5400)</span>
              <span className={styles.statValue} style={{ color: ppvTotal > 0 ? '#DC2626' : (ppvTotal < 0 ? '#16A34A' : 'inherit') }}>
                ${ppvTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.statIconWrapper} style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
              <AlertTriangle className={styles.statIcon} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Header */}
      <div className={styles.tabsHeader}>
        <button className={`${styles.tabBtn} ${activeTab === 'vendors' ? styles.activeTabBtn : ''}`} onClick={() => { setActiveTab('vendors'); setSearchTerm(''); }}>Suppliers</button>
        <button className={`${styles.tabBtn} ${activeTab === 'pos' ? styles.activeTabBtn : ''}`} onClick={() => { setActiveTab('pos'); setSearchTerm(''); }}>{t('purchasingconsole.purchaseOrders')}</button>
        <button className={`${styles.tabBtn} ${activeTab === 'receiving' ? styles.activeTabBtn : ''}`} onClick={() => { setActiveTab('receiving'); setSearchTerm(''); }}>{t('purchasingconsole.receivingCenter')}</button>
        <button className={`${styles.tabBtn} ${activeTab === 'bills' ? styles.activeTabBtn : ''}`} onClick={() => { setActiveTab('bills'); setSearchTerm(''); }}>{t('purchasingconsole.vendorBills')}</button>
        <button className={`${styles.tabBtn} ${activeTab === 'payments' ? styles.activeTabBtn : ''}`} onClick={() => { setActiveTab('payments'); setSearchTerm(''); }}>{t('purchasingconsole.paymentsLog')}</button>
        <button className={`${styles.tabBtn} ${activeTab === 'reports' ? styles.activeTabBtn : ''}`} onClick={() => { setActiveTab('reports'); setSearchTerm(''); }}>{t('purchasingconsole.valuationsAging')}</button>
      </div>

      {/* Control Row */}
      <div className={styles.ledgerHeaderRow} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.ledgerSearchBox}>
          {activeTab !== 'reports' && (
            <input
              type="text"
              className={styles.ledgerSearchInput}
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {activeTab === 'vendors' && (
            <Button onClick={() => setActiveModal('newVendor')} variant="primary" size="sm" disabled={isProcessing}>
              <Plus size={16} style={{ marginRight: '0.5rem' }} /> Add Vendor profile
            </Button>
          )}
          {activeTab === 'pos' && (
            <Button onClick={() => setActiveModal('newPO')} variant="primary" size="sm" disabled={isProcessing}>
              <Plus size={16} style={{ marginRight: '0.5rem' }} /> Create PO Draft
            </Button>
          )}
          {activeTab === 'receiving' && (
            <Button onClick={() => setActiveModal('receivePO')} variant="primary" size="sm" disabled={isProcessing}>
              <Truck size={16} style={{ marginRight: '0.5rem' }} /> Log Receipt Intake
            </Button>
          )}
          {activeTab === 'bills' && (
            <Button onClick={() => setActiveModal('newVendorBill')} variant="primary" size="sm" disabled={isProcessing}>
              <Plus size={16} style={{ marginRight: '0.5rem' }} /> Add Vendor Bill
            </Button>
          )}
          {activeTab === 'payments' && (
            <Button onClick={() => setActiveModal('payVendor')} variant="primary" size="sm" disabled={isProcessing}>
              <CreditCard size={16} style={{ marginRight: '0.5rem' }} /> Log Disbursement
            </Button>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      <Card className={styles.ledgerCard}>
        <CardContent style={{ padding: 0 }}>
          
          {/* VENDORS TAB */}
          {activeTab === 'vendors' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('purchasingconsole.vendorId')}</th>
                    <th>{t('purchasingconsole.supplierName')}</th>
                    <th>{t('purchasingconsole.contactPerson')}</th>
                    <th>Email / Phone</th>
                    <th>{t('purchasingconsole.paymentTerms')}</th>
                    <th className={styles.amountCol}>{t('purchasingconsole.openBalance')}</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {vendors
                    .filter(v => matchesSearch(v.id) || matchesSearch(v.name) || matchesSearch(v.email))
                    .map(v => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>{v.id}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-sage-dark)' }}>{v.name}</td>
                        <td>{v.contactName || '—'}</td>
                        <td>
                          <div style={{ fontSize: '0.8125rem' }}>{v.email}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{v.phone}</div>
                        </td>
                        <td>{v.paymentTerms}</td>
                        <td className={styles.amountCol} style={{ fontWeight: 700, color: v.balance > 0 ? '#B91C1C' : 'inherit' }}>
                          ${(v.balance || 0).toFixed(2)}
                        </td>
                        <td>
                          <span className={v.active ? 'status-delivered' : 'status-draft'} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {v.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <Button variant="secondary" size="sm" onClick={() => setActiveModal('newVendor', v)}>
                            Edit / View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  {vendors.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState title={t('purchasingconsole.noSuppliersRegistered')} description="Create supplier dossiers to link Purchase Orders, receive warehouse stock, and log Accounts Payable bills." icon={Truck} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* PURCHASE ORDERS TAB */}
          {activeTab === 'pos' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>PO ID</th>
                    <th>{t('purchasingconsole.supplierName')}</th>
                    <th>{t('purchasingconsole.orderDate')}</th>
                    <th>{t('purchasingconsole.warehouseLocation')}</th>
                    <th>Items</th>
                    <th className={styles.amountCol}>{t('purchasingconsole.totalCost')}</th>
                    <th>{t('purchasingconsole.fulfillmentStatus')}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders
                    .filter(po => matchesSearch(po.id) || matchesSearch(po.vendorName) || matchesSearch(po.status))
                    .map(po => {
                      const totalQty = (po.lines || []).reduce((sum, l) => sum + l.quantityOrdered, 0);
                      const receivedQty = (po.lines || []).reduce((sum, l) => sum + (l.quantityReceived || 0), 0);
                      return (
                        <tr key={po.id}>
                          <td style={{ fontWeight: 600 }}>{po.id}</td>
                          <td style={{ fontWeight: 600 }}>{po.vendorName}</td>
                          <td>{new Date(po.orderDate).toLocaleDateString()}</td>
                          <td>{po.location || 'Main Warehouse'}</td>
                          <td>{receivedQty} / {totalQty} items</td>
                          <td className={styles.amountCol} style={{ fontWeight: 700 }}>${po.totalCost.toFixed(2)}</td>
                          <td>
                            <span className={`status-${po.status}`} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {po.status.toUpperCase().replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button variant="secondary" size="sm" onClick={() => setActiveModal('newPO', po)}>
                                {po.status === 'draft' ? 'Edit' : 'View Details'}
                              </Button>
                              {(po.status === 'ordered' || po.status === 'partially_received') && (
                                <Button variant="primary" size="sm" onClick={() => setActiveModal('receivePO', po)}>
                                  Receive Items
                                </Button>
                              )}
                              {po.status === 'draft' && (
                                <Button variant="secondary" size="sm" onClick={() => handleCancelPO(po.id)} style={{ color: '#EF4444' }}>
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {purchaseOrders.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState title={t('purchasingconsole.noPurchaseOrders')} description="Draft purchase orders to source fresh roses, fillers, ribbons, and florist design materials." icon={FileText} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* RECEIVING TAB */}
          {activeTab === 'receiving' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('purchasingconsole.receiptId')}</th>
                    <th>{t('purchasingconsole.linkedPo')}</th>
                    <th>{t('purchasingconsole.supplierName')}</th>
                    <th>{t('purchasingconsole.dateReceived')}</th>
                    <th>{t('purchasingconsole.acceptedStems')}</th>
                    <th>Damaged / Rejected</th>
                    <th>{t('purchasingconsole.freightPost')}</th>
                    <th>GL Entry</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryReceipts
                    .filter(rec => matchesSearch(rec.id) || matchesSearch(rec.poNumber) || matchesSearch(rec.vendorName))
                    .map(rec => {
                      const accepted = (rec.lines || []).reduce((sum, l) => sum + (l.quantityAccepted || 0), 0);
                      const exception = (rec.lines || []).reduce((sum, l) => sum + (l.quantityDamaged || 0) + (l.quantityRejected || 0), 0);
                      return (
                        <tr key={rec.id}>
                          <td style={{ fontWeight: 600 }}>{rec.id}</td>
                          <td>{rec.poNumber}</td>
                          <td style={{ fontWeight: 600 }}>{rec.vendorName}</td>
                          <td>{new Date(rec.receiptDate).toLocaleDateString()}</td>
                          <td style={{ color: '#16A34A', fontWeight: 600 }}>{accepted} units</td>
                          <td style={{ color: exception > 0 ? '#DC2626' : 'inherit' }}>{exception} items</td>
                          <td>
                            <div style={{ fontSize: '0.8125rem' }}>${(rec.freightAmount || 0).toFixed(2)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{rec.freightTreatment.toUpperCase()}</div>
                          </td>
                          <td>
                            {rec.journalEntryId ? (
                              <span style={{ fontSize: '0.8125rem', color: 'var(--color-sage-dark)', fontWeight: 600 }}>
                                Posted (JE-{rec.journalEntryId.substring(0,6)})
                              </span>
                            ) : (
                              <span className="status-draft" style={{ fontSize: '0.75rem' }}>UNPOSTED</span>
                            )}
                          </td>
                          <td>
                            <Button variant="secondary" size="sm" onClick={() => setActiveModal('receivePO', rec)}>
                              View Details
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  {inventoryReceipts.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <EmptyState title={t('purchasingconsole.noInventoryReceived')} description="Record warehouse delivery notes. Accepted stock triggers auto average unit cost updates and GRNI posting." icon={Truck} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* VENDOR BILLS TAB */}
          {activeTab === 'bills' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('purchasingconsole.billId')}</th>
                    <th>{t('purchasingconsole.supplierName')}</th>
                    <th>{t('purchasingconsole.invoiceNo')}</th>
                    <th>{t('purchasingconsole.linkedPo')}</th>
                    <th>{t('purchasingconsole.billDate')}</th>
                    <th>{t('purchasingconsole.dueDate')}</th>
                    <th className={styles.amountCol}>{t('purchasingconsole.totalBill')}</th>
                    <th className={styles.amountCol}>{t('finance.balanceDue')}</th>
                    <th>{t('purchasingconsole.matchStatus')}</th>
                    <th>{t('purchasingconsole.filingStatus')}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorBills
                    .filter(b => matchesSearch(b.id) || matchesSearch(b.billNumber) || matchesSearch(b.vendorName))
                    .map(b => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600 }}>{b.id}</td>
                        <td style={{ fontWeight: 600 }}>{b.vendorName}</td>
                        <td style={{ fontWeight: 600 }}>{b.billNumber}</td>
                        <td>{b.poNumber || 'Manual'}</td>
                        <td>{new Date(b.billDate).toLocaleDateString()}</td>
                        <td>{new Date(b.dueDate).toLocaleDateString()}</td>
                        <td className={styles.amountCol} style={{ fontWeight: 700 }}>${b.totalAmount.toFixed(2)}</td>
                        <td className={styles.amountCol} style={{ fontWeight: 700, color: b.balanceDue > 0 ? '#B91C1C' : 'inherit' }}>
                          ${(b.balanceDue || 0).toFixed(2)}
                        </td>
                        <td>
                          <span className={`status-${b.matchStatus}`} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {b.matchStatus.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className={`status-${b.status}`} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {b.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button variant="secondary" size="sm" onClick={() => setActiveModal('newVendorBill', b)}>
                              {b.status === 'draft' ? 'Edit' : 'View'}
                            </Button>
                            {b.status === 'draft' && (
                              <Button variant="primary" size="sm" onClick={() => handlePostBill(b.id)}>
                                Post to AP
                              </Button>
                            )}
                            {(b.status === 'posted' || b.status === 'partially_paid') && (
                              <Button variant="primary" size="sm" onClick={() => setActiveModal('payVendor', { id: b.id, vendorId: b.vendorId, vendorName: b.vendorName, amountApplied: b.balanceDue })}>
                                Pay Invoice
                              </Button>
                            )}
                            {b.status === 'posted' && b.balanceDue === b.totalAmount && (
                              <Button variant="secondary" size="sm" onClick={() => handleVoidBill(b.id)} style={{ color: '#EF4444' }}>
                                Void
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {vendorBills.length === 0 && (
                    <tr>
                      <td colSpan={11}>
                        <EmptyState title={t('purchasingconsole.noAccountsPayableBills')} description="Post vendor bills to match PO costs, clear Accrued Purchases, and credit Accounts Payable liabilities." icon={FileText} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* VENDOR PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('purchasingconsole.paymentId')}</th>
                    <th>{t('purchasingconsole.supplierName')}</th>
                    <th>{t('purchasingconsole.postingDate')}</th>
                    <th>Method</th>
                    <th>Check/Ref No</th>
                    <th className={styles.amountCol}>{t('purchasingconsole.cashDisbursed')}</th>
                    <th className={styles.amountCol}>{t('purchasingconsole.appliedAmount')}</th>
                    <th>{t('purchasingconsole.postingStatus')}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorPayments
                    .filter(p => matchesSearch(p.id) || matchesSearch(p.vendorName) || matchesSearch(p.paymentMethod))
                    .map(p => {
                      const applied = (p.allocations || []).reduce((sum, a) => sum + a.amountApplied, 0);
                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.paymentNumber}</td>
                          <td style={{ fontWeight: 600 }}>{p.vendorName}</td>
                          <td>{new Date(p.paymentDate).toLocaleDateString()}</td>
                          <td>{p.paymentMethod.toUpperCase().replace('_', ' ')}</td>
                          <td>{p.referenceNumber || '—'}</td>
                          <td className={styles.amountCol} style={{ fontWeight: 700 }}>${p.amount.toFixed(2)}</td>
                          <td className={styles.amountCol} style={{ fontWeight: 600, color: 'var(--color-sage-dark)' }}>${applied.toFixed(2)}</td>
                          <td>
                            <span className={`status-${p.status}`} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {p.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button variant="secondary" size="sm" onClick={() => setActiveModal('payVendor', p)}>
                                View Details
                              </Button>
                              {p.status === 'posted' && (
                                <button
                                  type="button"
                                  onClick={() => handleVoidPayment(p.id)}
                                  className={styles.tabBtn}
                                  style={{ color: '#EF4444', fontSize: '0.8125rem', padding: '0.25rem 0.5rem', border: '1px solid #FCA5A5', borderRadius: '6px' }}
                                >
                                  Void Check
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {vendorPayments.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <EmptyState title={t('purchasingconsole.noCashDisbursementsLogged')} description="Record vendor disbursements to clear accounts payable liabilities and credit bank accounts." icon={CreditCard} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* OPERATIONAL REPORTS TAB */}
          {activeTab === 'reports' && (
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                
                {/* AP Aging summary */}
                <div style={{ background: '#FAFAF8', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E8EAE6' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontFamily: 'var(--font-serif)', color: 'var(--color-text-main)' }}>AP Payables Aging Report</h3>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table} style={{ fontSize: '0.8125rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.5rem' }}>Supplier</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Current (0-30)</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>31-60 Days</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>61-90 Days</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>90+ Days</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('purchasingconsole.totalPayables')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendors.map(v => {
                          const c = v.agingBuckets?.current || 0;
                          const t = v.agingBuckets?.thirtyToSixty || 0;
                          const s = v.agingBuckets?.sixtyToNinety || 0;
                          const o = v.agingBuckets?.overNinety || 0;
                          return (
                            <tr key={v.id}>
                              <td style={{ padding: '0.5rem', fontWeight: 600 }}>{v.name}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>${c.toFixed(2)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>${t.toFixed(2)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>${s.toFixed(2)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: o > 0 ? '#B91C1C' : 'inherit' }}>${o.toFixed(2)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>${(c+t+s+o).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Weighted-Average Inventory Valuations */}
                <div style={{ background: '#FAFAF8', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E8EAE6' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontFamily: 'var(--font-serif)', color: 'var(--color-text-main)' }}>{t('purchasingconsole.inventoryWacValuationReport')}</h3>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table} style={{ fontSize: '0.8125rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.5rem' }}>SKU</th>
                          <th style={{ padding: '0.5rem' }}>{t('purchasingconsole.stockItemName')}</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('purchasingconsole.onHand')}</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Avg Unit Cost (WAC)</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('purchasingconsole.valuationTotal')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map(item => {
                          const qty = item.quantity || 0;
                          const cost = item.unitCost || 0;
                          const total = qty * cost;
                          return (
                            <tr key={item.id}>
                              <td style={{ padding: '0.5rem', fontWeight: 600 }}>{item.sku}</td>
                              <td style={{ padding: '0.5rem' }}>{item.name}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{qty} {item.unitOfMeasure || 'stems'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>${cost.toFixed(2)}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>${total.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};
