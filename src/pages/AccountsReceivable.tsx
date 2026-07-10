import React, { useEffect, useState } from 'react';
import { useAdminStore } from '../store/adminStore';
import { useFinanceStore } from '../store/financeStore';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { useCompany } from '../context/CompanyContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { 
  FileText, Landmark, Plus, Search, 
  Calendar, CreditCard, ChevronRight, MessageSquarePlus, MessageSquare, AlertTriangle
} from 'lucide-react';
import { getLocalDateInNY, generateCustomerStatement, exportStatementPdf } from '../services/customerStatementService';
import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import styles from './FinanceAdmin.module.css';
import { useI18n } from '../i18n/I18nProvider';

interface CollectionNote {
  id?: string;
  customerId: string;
  customerName: string;
  noteText: string;
  promisedDate?: string;
  disputedAmount?: number;
  createdAt: string;
  createdBy: string;
}

export const AccountsReceivable: React.FC = () => {
  const { t } = useI18n();
  const { 
    orders, 
    customers, 
    payments, 
    statements, 
    fetchPayments, 
    fetchCustomerStatements,
    setActiveModal,
    updateCustomerDetails,
    fetchOrders
  } = useAdminStore();

  const { journalEntries, fetchJournalEntries } = useFinanceStore();
  const { role, user } = useAuthStore();
  const { userRole: companyRole } = useCompany();
  const addToast = useToastStore(s => s.addToast);

  const [activeTab, setActiveTab] = useState<'open_ar' | 'aging' | 'payments' | 'statements' | 'collections' | 'gl'>('open_ar');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Collections states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [collectionNotes, setCollectionNotes] = useState<CollectionNote[]>([]);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [disputedAmount, setDisputedAmount] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchCustomerStatements();
    fetchOrders();
    fetchJournalEntries();
  }, [fetchPayments, fetchCustomerStatements, fetchOrders, fetchJournalEntries]);

  // Load collection notes when customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      const loadNotes = async () => {
        setIsNotesLoading(true);
        try {
          const snap = await getDocs(
            query(
              collection(db, 'collectionNotes'),
              where('customerId', '==', selectedCustomerId),
              orderBy('createdAt', 'desc')
            )
          );
          setCollectionNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollectionNote)));
        } catch (e) {
          console.error(e);
        } finally {
          setIsNotesLoading(false);
        }
      };
      loadNotes();
    } else {
      // Intended: clear collection notes state when no customer is selected.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollectionNotes([]);
    }
  }, [selectedCustomerId]);

  // Calculate Aging Buckets for AR
  const calculateARStats = () => {
    let openARCount = 0;
    let totalARBalance = 0;
    let currentBucket = 0;   // 0-30 days
    let thirtyToSixty = 0;   // 31-60 days
    let sixtyToNinety = 0;   // 61-90 days
    let overNinety = 0;      // 90+ days
    let totalUnappliedCash = 0;

    const todayStr = getLocalDateInNY(new Date());

    orders.forEach(o => {
      // Posted orders that have outstanding balance
      if (o.glPostingStatus === 'posted' && o.status !== 'draft' && o.status !== 'cancelled' && o.status !== 'refunded') {
        const bal = o.balanceDue !== undefined ? o.balanceDue : (o.total - (o.amountPaid || 0));
        if (bal > 0) {
          openARCount++;
          totalARBalance += bal;

          // Aging calculation
          const orderDate = getLocalDateInNY(o.createdAt || o.deliveryDate);
          if (orderDate) {
            const diffTime = new Date(todayStr).getTime() - new Date(orderDate).getTime();
            const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

            if (diffDays <= 30) currentBucket += bal;
            else if (diffDays <= 60) thirtyToSixty += bal;
            else if (diffDays <= 90) sixtyToNinety += bal;
            else overNinety += bal;
          }
        }
      }
    });

    // Unapplied Cash from posted payments
    payments.forEach(p => {
      if (p.glPostingStatus === 'posted' && p.status !== 'voided') {
        totalUnappliedCash += p.unappliedAmount || 0;
      }
    });

    return {
      openARCount,
      totalARBalance,
      currentBucket,
      thirtyToSixty,
      sixtyToNinety,
      overNinety,
      totalUnappliedCash
    };
  };

  const arStats = calculateARStats();

  // Handle saving contact log collection notes
  const handleAddCollectionNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      addToast(t('accountsreceivable.toast.selectCustomer'), 'error');
      return;
    }
    if (!newNoteText.trim()) {
      addToast(t('accountsreceivable.toast.writeNote'), 'error');
      return;
    }

    try {
      setIsSubmittingNote(true);
      const customer = customers.find(c => c.id === selectedCustomerId);
      const actor = user?.email || 'Admin';

      const newNote: Omit<CollectionNote, 'id'> = {
        customerId: selectedCustomerId,
        customerName: customer?.name || 'Unknown',
        noteText: newNoteText.trim(),
        promisedDate: promisedDate || undefined,
        disputedAmount: disputedAmount ? parseFloat(disputedAmount) : undefined,
        createdAt: new Date().toISOString(),
        createdBy: actor
      };

      const docRef = await addDoc(collection(db, 'collectionNotes'), newNote);
      setCollectionNotes(prev => [{ id: docRef.id, ...newNote } as CollectionNote, ...prev]);

      // If dispute declared, we can update collection status
      if (disputedAmount) {
        await updateCustomerDetailsInDb(selectedCustomerId, { collectionStatus: 'disputed' });
      } else if (promisedDate) {
        await updateCustomerDetailsInDb(selectedCustomerId, { collectionStatus: 'promise_to_pay' });
      }

      setNewNoteText('');
      setPromisedDate('');
      setDisputedAmount('');
      addToast(t('accountsreceivable.toast.noteLogged'), 'success');
    } catch (e: any) {
      console.error(e);
      addToast(t('accountsreceivable.toast.noteFailed', { error: e.message }), 'error');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const updateCustomerDetailsInDb = async (id: string, updates: any) => {
    const custRef = doc(db, 'customers', id);
    await updateDoc(custRef, updates);
    updateCustomerDetails(id, updates);
  };

  const handleStatusChange = async (id: string, status: any) => {
    try {
      await updateCustomerDetailsInDb(id, { collectionStatus: status });
      addToast(t('accountsreceivable.toast.statusUpdated', { status: status.replace('_', ' ').toUpperCase() }), 'success');
    } catch (e: any) {
      addToast(t('accountsreceivable.toast.statusFailed', { error: e.message }), 'error');
    }
  };

  // Filter open AR items
  const openARList = orders.filter(o => {
    if (o.glPostingStatus !== 'posted' || o.status === 'draft' || o.status === 'cancelled' || o.status === 'refunded') {
      return false;
    }
    const bal = o.balanceDue !== undefined ? o.balanceDue : (o.total - (o.amountPaid || 0));
    if (bal <= 0) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        o.customerName.toLowerCase().includes(q) ||
        (o.orderNumber || '').toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter payments
  const filteredPayments = payments.filter(p => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        p.customerName.toLowerCase().includes(q) ||
        p.paymentNumber.toLowerCase().includes(q) ||
        (p.referenceNumber || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter statements
  const filteredStatements = statements.filter(s => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return s.customerName.toLowerCase().includes(q);
    }
    return true;
  });

  // Filter general ledger matching payment source types
  const filteredPaymentGL = journalEntries.filter(je => {
    return (
      je.sourceType === 'payment' || 
      je.sourceType === 'payment_reversal' || 
      je.sourceType === 'refund'
    );
  });

  // Access denied for non-finance roles. The ACTIVE COMPANY membership role is
  // authoritative (P3.4-DEF-2: gating on the global role denied legitimate
  // company admins whose legacy global role is 'staff').
  const effectiveRole = companyRole || role;
  if (effectiveRole === 'staff' || effectiveRole === 'viewer') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center', padding: '2rem' }}>
        <Landmark size={64} style={{ color: '#EF4444', marginBottom: '1.5rem' }} />
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0' }}>{t('accountsreceivable.accessDenied')}</h2>
        <p style={{ color: '#726E64', fontSize: '0.95rem', maxWidth: '400px', lineHeight: 1.6 }}>
          You do not have authorization to view Accounts Receivable controls. Please contact your manager.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* Header Area */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            Accounts Receivable & Payments
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Manage outstanding customer billing, capture invoice payments, track aging buckets, and print client statements.
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem' }}>
          <Button onClick={() => setActiveModal('newStatement')} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E', display: 'inline-flex', gap: '0.35rem' }}>
            <FileText size={16} /> Create Statement
          </Button>
          <Button onClick={() => setActiveModal('newPayment')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', boxShadow: '0 4px 12px rgba(74,107,80,0.2)' }}>
            <Plus size={16} style={{ marginRight: '0.35rem' }} /> Capture Payment
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        {[
          { id: 'open_ar', name: 'Open Accounts Receivable', value: `$${arStats.totalARBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, sub: `${arStats.openARCount} Unpaid Orders`, icon: Landmark },
          { id: 'unapplied', name: 'Unapplied Customer Credits', value: `$${arStats.totalUnappliedCash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, sub: 'Liability (Account 2200)', icon: CreditCard, color: arStats.totalUnappliedCash > 0 ? '#4A6B50' : undefined },
          { id: 'current', name: 'Current AR (0-30 Days)', value: `$${arStats.currentBucket.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, sub: `${Math.round((arStats.currentBucket/arStats.totalARBalance)*100 || 0)}% of total AR`, icon: Calendar },
          { id: 'past_due', name: 'Delinquent AR (31+ Days)', value: `$${(arStats.thirtyToSixty + arStats.sixtyToNinety + arStats.overNinety).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, sub: 'Collection action recommended', icon: AlertTriangle, color: (arStats.thirtyToSixty + arStats.sixtyToNinety + arStats.overNinety) > 0 ? '#991B1B' : undefined }
        ].map(card => (
          <div key={card.id} style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{card.name}</span>
              <div style={{ background: 'rgba(74, 107, 80, 0.08)', color: '#4A6B50', padding: '0.4rem', borderRadius: '8px' }}>
                <card.icon size={16} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: card.color || '#2C302E', fontFamily: 'var(--font-serif)' }}>{card.value}</div>
              <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.25rem' }}>{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Menu */}
      <div className={styles.tabsHeader} style={{ marginBottom: '2rem', display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '1rem' }}>
        {[
          { id: 'open_ar', label: 'Open AR Ledger' },
          { id: 'aging', label: 'Aging Breakdown' },
          { id: 'payments', label: 'Payment Receipts' },
          { id: 'statements', label: 'Customer Statements' },
          { id: 'collections', label: 'Collections Contact Console' },
          { id: 'gl', label: 'Ledger Audit Trail' }
        ].map(tab => (
          <button 
            key={tab.id}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTabBtn : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
            style={{ padding: '0.75rem 1.25rem', fontSize: '0.9375rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar / Filter Toolbar */}
      {activeTab !== 'aging' && activeTab !== 'collections' && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', background: '#FAFAF8', border: '1px solid #E8EAE6', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <Search size={16} style={{ color: '#8a8f8c', marginRight: '0.5rem' }} />
          <input 
            type="text" 
            placeholder="Search console by customer, ID or reference code..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', flex: 1 }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 600 }}>Clear</button>
          )}
        </div>
      )}

      {/* Tab Panel contents */}
      <Card style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF', padding: '1.5rem' }}>
        <CardContent style={{ padding: 0 }}>

          {/* TAB 1: Open AR Ledger */}
          {activeTab === 'open_ar' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>{t('accountsreceivable.customerName')}</th>
                    <th>{t('accountsreceivable.fulfillmentDate')}</th>
                    <th style={{ textAlign: 'right' }}>{t('accountsreceivable.totalCost')}</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>{t('finance.balanceDue')}</th>
                    <th style={{ textAlign: 'center' }}>{t('accountsreceivable.collectionStatus')}</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {openARList.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '2rem', textAlign: 'center' }}>
                        <EmptyState title={t('accountsreceivable.noOutstandingArInvoices')} description="All delivered and posted florist sales have been fully paid." />
                      </td>
                    </tr>
                  ) : (
                    openARList.map(o => {
                      const bal = o.balanceDue !== undefined ? o.balanceDue : (o.total - (o.amountPaid || 0));
                      const customerObj = customers.find(c => c.id === o.customerId);
                      const colStatus = customerObj?.collectionStatus || 'current';

                      return (
                        <tr key={o.id} style={{ borderBottom: '1px solid #F0EDE6' }}>
                          <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                            {o.orderNumber || o.id.substring(0, 8).toUpperCase()}
                          </td>
                          <td><strong>{o.customerName}</strong></td>
                          <td>{o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ textAlign: 'right' }}>${o.total.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', color: '#10b981' }}>${(o.amountPaid || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>${bal.toFixed(2)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <select
                              value={colStatus}
                              onChange={(e) => handleStatusChange(o.customerId, e.target.value)}
                              style={{ 
                                padding: '4px 8px', 
                                borderRadius: '6px', 
                                border: '1px solid #E8EAE6', 
                                fontSize: '0.75rem',
                                background: colStatus === 'past_due' ? '#FEE2E2' : 
                                            colStatus === 'promise_to_pay' ? '#FEF3C7' : 
                                            colStatus === 'disputed' ? '#F3E8FF' : '#ECFDF5',
                                color: colStatus === 'past_due' ? '#991B1B' : 
                                       colStatus === 'promise_to_pay' ? '#92400E' : 
                                       colStatus === 'disputed' ? '#6B21A8' : '#065F46',
                                fontWeight: 600,
                                outline: 'none'
                              }}
                            >
                              <option value="current">Current</option>
                              <option value="due_soon">{t('accountsreceivable.dueSoon')}</option>
                              <option value="past_due">{t('accountsreceivable.pastDue')}</option>
                              <option value="promise_to_pay">{t('accountsreceivable.promiseToPay')}</option>
                              <option value="disputed">Disputed</option>
                              <option value="on_hold">{t('accountsreceivable.onHold')}</option>
                              <option value="sent_to_collections">{t('accountsreceivable.sentToCollections')}</option>
                            </select>
                          </td>
                          <td style={{ textAlign: 'right', display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <Button 
                              size="sm" 
                              onClick={() => setActiveModal('newPayment', { customerId: o.customerId })}
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              Apply Cash
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setActiveModal('newStatement', { customerId: o.customerId })}
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', border: '1px solid #E8EAE6', background: '#FFFFFF' }}
                            >
                              Statement
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Aging Breakdown */}
          {activeTab === 'aging' && (
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: '#2C302E', marginBottom: '1.5rem', fontWeight: 600 }}>{t('accountsreceivable.agingScheduleByCustomer')}</h3>
              
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr style={{ background: '#FDFCFA' }}>
                      <th>{t('accountsreceivable.customerName')}</th>
                      <th style={{ textAlign: 'right' }}>{t('accountsreceivable.totalOutstanding')}</th>
                      <th style={{ textAlign: 'right' }}>Current (0-30 days)</th>
                      <th style={{ textAlign: 'right' }}>31 - 60 Days</th>
                      <th style={{ textAlign: 'right' }}>61 - 90 Days</th>
                      <th style={{ textAlign: 'right' }}>90+ Days Past Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.filter(c => (c.arBalance || 0) > 0).map(c => {
                      // Calculate aging segments dynamically
                      const clientOrders = orders.filter(o => o.customerId === c.id && o.glPostingStatus === 'posted');
                      let currentSegment = 0;
                      let segment30_60 = 0;
                      let segment60_90 = 0;
                      let segment90Plus = 0;
                      const todayStr = getLocalDateInNY(new Date());

                      clientOrders.forEach(o => {
                        const bal = o.balanceDue !== undefined ? o.balanceDue : (o.total - (o.amountPaid || 0));
                        if (bal > 0) {
                          const orderDate = getLocalDateInNY(o.createdAt || o.deliveryDate);
                          if (orderDate) {
                            const diffTime = new Date(todayStr).getTime() - new Date(orderDate).getTime();
                            const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                            if (diffDays <= 30) currentSegment += bal;
                            else if (diffDays <= 60) segment30_60 += bal;
                            else if (diffDays <= 90) segment60_90 += bal;
                            else segment90Plus += bal;
                          }
                        }
                      });

                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #F0EDE6' }}>
                          <td><strong>{c.name}</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>${(c.arBalance || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>${currentSegment.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', color: segment30_60 > 0 ? '#92400E' : undefined }}>${segment30_60.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', color: segment60_90 > 0 ? '#D97706' : undefined }}>${segment60_90.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: segment90Plus > 0 ? '#B91C1C' : undefined }}>${segment90Plus.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Payment Receipts */}
          {activeTab === 'payments' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Customer</th>
                    <th>{t('accountsreceivable.paymentDate')}</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th style={{ textAlign: 'right' }}>{t('accountsreceivable.totalAmount')}</th>
                    <th style={{ textAlign: 'right' }}>{t('accountsreceivable.unappliedCredit')}</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '2rem', textAlign: 'center' }}>
                        <EmptyState title={t('accountsreceivable.noPaymentReceiptsLogged')} description="Create a new payment receipt to record incoming cash." />
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F0EDE6' }}>
                        <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.paymentNumber}</td>
                        <td><strong>{p.customerName}</strong></td>
                        <td>{p.paymentDate}</td>
                        <td style={{ textTransform: 'capitalize' }}>{p.paymentMethod.replace('_', ' ')}</td>
                        <td>{p.referenceNumber || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>${p.amount.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', color: p.unappliedAmount > 0 ? '#4A6B50' : undefined }}>${(p.unappliedAmount || 0).toFixed(2)}</td>
                        <td>
                          <span className={styles.statusBadge} style={{ 
                            background: p.status === 'posted' ? '#DEF7EC' : 
                                        p.status === 'voided' ? '#FDE8E8' : 
                                        p.status === 'refunded' ? '#E1F5FE' : '#F3F4F6',
                            color: p.status === 'posted' ? '#03543F' : 
                                   p.status === 'voided' ? '#9B1C1C' : 
                                   p.status === 'refunded' ? '#0288D1' : '#4b5563',
                            fontSize: '0.65rem'
                          }}>
                            {p.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setActiveModal('newPayment', p)}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', border: '1px solid #E8EAE6', background: '#FFFFFF' }}
                          >
                            Open Details
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: Customer Statements */}
          {activeTab === 'statements' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('accountsreceivable.generationDate')}</th>
                    <th>{t('accountsreceivable.customerName')}</th>
                    <th>{t('accountsreceivable.startDate')}</th>
                    <th>{t('accountsreceivable.endDate')}</th>
                    <th style={{ textAlign: 'right' }}>{t('accountsreceivable.endingNetBalance')}</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatements.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>
                        <EmptyState title={t('accountsreceivable.noGeneratedStatementsHistory')} description="Choose a customer and calculate statements above to save history logs." />
                      </td>
                    </tr>
                  ) : (
                    filteredStatements.map(s => {
                      const statementDateStr = s.createdAt ? new Date(s.createdAt).toLocaleString() : 'N/A';
                      
                      const handleRePrint = async () => {
                        try {
                          const statementData = await generateCustomerStatement(s.customerId, s.startDate, s.endDate);
                          exportStatementPdf(statementData);
                          addToast(t('accountsreceivable.toast.statementGenerated'), 'success');
                        } catch (err: any) {
                          addToast(t('accountsreceivable.toast.regenFailed', { error: err.message }), 'error');
                        }
                      };

                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #F0EDE6' }}>
                          <td>{statementDateStr}</td>
                          <td><strong>{s.customerName}</strong></td>
                          <td>{s.startDate}</td>
                          <td>{s.endDate}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>${(s.endingNetBalance || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={handleRePrint}
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', border: '1px solid #E8EAE6', background: '#FFFFFF' }}
                            >
                              Re-Print PDF
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: Collections Contact Console */}
          {activeTab === 'collections' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 2fr', gap: '2rem' }}>
              
              {/* Left Column: Client List with AR balances */}
              <div style={{ borderRight: '1px solid #E8EAE6', paddingRight: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#8a8f8c', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Delinquent Accounts
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {customers.filter(c => (c.arBalance || 0) > 0).map(c => {
                    const isSelected = selectedCustomerId === c.id;
                    const colStatus = c.collectionStatus || 'current';

                    return (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedCustomerId(c.id)}
                        style={{ 
                          padding: '1rem', 
                          borderRadius: '12px', 
                          border: isSelected ? '2px solid #4A6B50' : '1px solid #E8EAE6', 
                          background: isSelected ? '#FAF9F5' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 150ms'
                        }}
                      >
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.875rem' }}>{c.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Terms: {c.paymentTerms || 'Net 30'}</span>
                          <span style={{ 
                            display: 'block', 
                            fontSize: '0.6875rem', 
                            fontWeight: 700,
                            marginTop: '4px',
                            color: colStatus === 'past_due' ? '#B91C1C' : 
                                   colStatus === 'promise_to_pay' ? '#D97706' : 
                                   colStatus === 'disputed' ? '#7C3AED' : '#059669',
                            textTransform: 'uppercase'
                          }}>
                            {colStatus.replace('_', ' ')}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>
                            ${(c.arBalance || 0).toFixed(2)}
                          </span>
                          <ChevronRight size={16} style={{ color: '#8a8f8c', marginLeft: '0.25rem', verticalAlign: 'middle' }} />
                        </div>
                      </div>
                    );
                  })}
                  {customers.filter(c => (c.arBalance || 0) > 0).length === 0 && (
                    <p style={{ textAlign: 'center', padding: '20px', color: '#8a8f8c', fontSize: '0.8125rem' }}>{t('accountsreceivable.noDelinquentAccountsCurrently')}</p>
                  )}
                </div>
              </div>

              {/* Right Column: Collections Actions and History notes */}
              <div>
                {selectedCustomerId ? (
                  <div>
                    {/* Customer Profile Header */}
                    {(() => {
                      const c = customers.find(cust => cust.id === selectedCustomerId);
                      if (!c) return null;
                      return (
                        <div style={{ paddingBottom: '1.25rem', borderBottom: '1px solid #E8EAE6', marginBottom: '1.5rem' }}>
                          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', color: '#2C302E', margin: '0 0 4px 0', fontWeight: 600 }}>
                            {c.name}
                          </h3>
                          <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
                            📧 {c.email} | 📞 {c.phone} | Outstanding AR: <strong>${(c.arBalance || 0).toFixed(2)}</strong> | Credit Deposit: <strong>${(c.creditBalance || 0).toFixed(2)}</strong>
                          </p>
                        </div>
                      );
                    })()}

                    {/* Add note Form */}
                    <form onSubmit={handleAddCollectionNote} style={{ background: '#FAFAF8', border: '1px solid #E8EAE6', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8125rem', fontWeight: 700, color: '#2C302E', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <MessageSquarePlus size={16} /> Log Collection Contact Note
                      </h4>
                      <textarea
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        className={styles.formInput}
                        style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #E8EAE6', background: '#FFFFFF', fontSize: '0.8125rem', outline: 'none', resize: 'vertical' }}
                        placeholder="Log email sent, phone call summaries, customer promises..."
                        required
                      />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <div className={styles.formGroup}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>{t('accountsreceivable.promisedPaymentDate')}</label>
                          <input
                            type="date"
                            value={promisedDate}
                            onChange={(e) => setPromisedDate(e.target.value)}
                            className={styles.formInput}
                            style={{ background: '#FFFFFF', padding: '6px 10px' }}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Disputed Amount ($)</label>
                          <input
                            type="number"
                            value={disputedAmount}
                            onChange={(e) => setDisputedAmount(e.target.value)}
                            placeholder="0.00"
                            className={styles.formInput}
                            style={{ background: '#FFFFFF', padding: '6px 10px', textAlign: 'right' }}
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <Button type="submit" disabled={isSubmittingNote} style={{ padding: '0.45rem 1.25rem', fontSize: '0.8125rem' }}>
                          {isSubmittingNote ? 'Saving note...' : 'Log Contact Log'}
                        </Button>
                      </div>
                    </form>

                    {/* History notes log */}
                    <div>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8125rem', fontWeight: 700, color: '#8a8f8c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Contact Logs & Notes
                      </h4>
                      {isNotesLoading ? (
                        <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{t('accountsreceivable.loadingContactLogs')}</p>
                      ) : collectionNotes.length === 0 ? (
                        <p style={{ fontSize: '0.8125rem', color: '#8a8f8c', padding: '10px 0', fontStyle: 'italic' }}>{t('accountsreceivable.noCollectionsHistoryRecordedYet')}</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
                          {collectionNotes.map(note => (
                            <div key={note.id} style={{ border: '1px solid #E8EAE6', borderRadius: '8px', padding: '10px 12px', background: '#FFFFFF' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem', color: '#8a8f8c' }}>
                                <span>Logged by: <strong>{note.createdBy}</strong></span>
                                <span>{new Date(note.createdAt).toLocaleString()}</span>
                              </div>
                              <p style={{ margin: '0 0 8px 0', fontSize: '0.8125rem', color: '#2C302E', whiteSpace: 'pre-line' }}>{note.noteText}</p>
                              {(note.promisedDate || note.disputedAmount) && (
                                <div style={{ display: 'flex', gap: '1rem', borderTop: '1px dashed #E8EAE6', paddingTop: '6px', fontSize: '0.75rem', color: '#4A6B50', fontWeight: 600 }}>
                                  {note.promisedDate && <span>📅 Promised payment: {new Date(note.promisedDate).toLocaleDateString()}</span>}
                                  {note.disputedAmount && <span style={{ color: '#B91C1C' }}>⚠️ Declared Dispute: ${note.disputedAmount.toFixed(2)}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', border: '1px dashed #E8EAE6', borderRadius: '12px', color: '#8a8f8c' }}>
                    <MessageSquare size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.875rem' }}>{t('accountsreceivable.selectADelinquentCustomerOnTheLeftToReviewContactLogs')}</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 6: Ledger Audit Trail */}
          {activeTab === 'gl' && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr style={{ background: '#FDFCFA' }}>
                    <th>Date</th>
                    <th>{t('accountsreceivable.entryRef')}</th>
                    <th>Memo / Description</th>
                    <th>GL Account</th>
                    <th style={{ textAlign: 'right' }}>Debit ($)</th>
                    <th style={{ textAlign: 'right' }}>Credit ($)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaymentGL.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center' }}>
                        <EmptyState title={t('accountsreceivable.noPaymentLedgersLogged')} description="Posted cash receipts and voided transaction histories will show up here." />
                      </td>
                    </tr>
                  ) : (
                    filteredPaymentGL.map(je => {
                      let dateStr = 'N/A';
                      if (je.createdAt) {
                        const anyCreated = je.createdAt as any;
                        if (typeof anyCreated.toDate === 'function') {
                          dateStr = anyCreated.toDate().toLocaleDateString();
                        } else if (typeof anyCreated.seconds === 'number') {
                          dateStr = new Date(anyCreated.seconds * 1000).toLocaleDateString();
                        } else if (typeof je.createdAt === 'string' || je.createdAt instanceof Date) {
                          dateStr = new Date(je.createdAt as any).toLocaleDateString();
                        }
                      }
                      const entryRef = je.orderId?.substring(0, 12) || '';
                      const status = (je.status || 'posted').toUpperCase();

                      return (
                        <React.Fragment key={je.id}>
                          <tr className={styles.entryHeader} style={{ background: je.status === 'reversed' ? '#FEF2F2' : '#FDFDFB' }}>
                            <td colSpan={7} style={{ padding: '12px 16px', borderBottom: '1px solid #E8EAE6' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong style={{ color: '#2C302E', fontSize: '0.875rem' }}>{je.description}</strong>
                                  <span style={{ fontSize: '0.75rem', color: '#8a8f8c', marginLeft: '0.25rem' }}> (Entry: {je.id?.substring(0,8).toUpperCase()} • By: {je.createdBy})</span>
                                  {je.status === 'reversed' && (
                                    <span style={{ marginLeft: '0.5rem', background: '#FEE2E2', color: '#991B1B', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>REVERSED</span>
                                  )}
                                  {je.reversalOf && (
                                    <span style={{ marginLeft: '0.5rem', background: '#E0F2FE', color: '#0369A1', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>REVERSAL ENTRY</span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {je.lines.map((l, idx) => (
                            <tr key={idx} className={styles.entryLine} style={{ borderBottom: '1px solid #F0EDE6' }}>
                              <td>{idx === 0 ? dateStr : ''}</td>
                              <td style={{ fontFamily: 'monospace' }}>{idx === 0 ? entryRef : ''}</td>
                              <td></td>
                              <td style={{ paddingLeft: l.credit > 0 ? '2rem' : '1rem', color: '#4b5563' }}>{l.account}</td>
                              <td style={{ textAlign: 'right', fontWeight: l.debit > 0 ? 600 : 400 }}>{l.debit > 0 ? `$${l.debit.toFixed(2)}` : '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: l.credit > 0 ? 600 : 400 }}>{l.credit > 0 ? `$${l.credit.toFixed(2)}` : '—'}</td>
                              <td>{idx === 0 ? <span className={styles.statusBadge} style={{ background: je.status === 'reversed' ? '#FDE8E8' : '#DEF7EC', color: je.status === 'reversed' ? '#9B1C1C' : '#03543F', fontSize: '0.6rem' }}>{status}</span> : ''}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

        </CardContent>
      </Card>

    </div>
  );
};
