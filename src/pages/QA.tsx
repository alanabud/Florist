import React, { useState, useEffect, useCallback } from 'react';
import { useAdminStore } from '../store/adminStore';
import { useFinanceStore } from '../store/financeStore';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { useCompany } from '../context/CompanyContext';
import { runAutomatedQAChecks, saveQARunEvidence, getQARunHistory, type QAResult, type QARunEvidence } from '../services/qaService';
import { seedJournalEntriesFromDemoOrders } from '../services/financeService';
import { getRecentAuditLogs, type AuditRecord } from '../services/auditService';
import { exportQAEvidencePDF } from '../services/pdfExportService';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { 
  ShieldAlert, ShieldCheck, RefreshCw, Database, 
  Trash2, ArrowRight, CheckCircle2, XCircle, FileText, Download
} from 'lucide-react';

export const QA: React.FC = () => {
  const { selectedCompanyId } = useCompany();
  const { resetToDemo, orders, fetchOrders } = useAdminStore();
  const { fetchJournalEntries, journalEntries } = useFinanceStore();
  const { role, user } = useAuthStore();
  const addToast = useToastStore(s => s.addToast);

  const [qaResults, setQaResults] = useState<QAResult[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [history, setHistory] = useState<QARunEvidence[]>([]);
  const [latestEvidenceId, setLatestEvidenceId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Gating check
  const isAuthorized = role === 'owner' || role === 'admin' || role === 'manager';
  const isReadOnly = role === 'manager';

  const loadQADatas = useCallback(async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    try {
      await fetchJournalEntries();
      await fetchOrders();
      const results = await runAutomatedQAChecks();
      setQaResults(results);
      
      const logs = await getRecentAuditLogs(selectedCompanyId || 'DEFAULT_COMPANY', 15);
      setAuditLogs(logs);
      
      const historyRuns = await getQARunHistory(10);
      setHistory(historyRuns);
      if (historyRuns.length > 0) {
        setLatestEvidenceId(historyRuns[0].id || null);
      }
    } catch (error) {
      console.error("Failed to load QA data:", error);
      addToast("Failed to fetch current QA check status.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, fetchJournalEntries, fetchOrders, addToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadQADatas();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadQADatas]);

  const handleRunChecks = async () => {
    if (isReadOnly) return;
    setIsLoading(true);
    try {
      const results = await runAutomatedQAChecks();
      setQaResults(results);
      
      // Persist the run evidence to Firestore
      const docId = await saveQARunEvidence(results, user?.email || 'Admin');
      setLatestEvidenceId(docId);
      
      // Reload history
      const historyRuns = await getQARunHistory(10);
      setHistory(historyRuns);
      
      addToast("Automated verification tests completed & QA evidence logged.", "success");
    } catch (e) {
      console.error(e);
      addToast("Failed to run verification tests.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedLedger = async () => {
    if (isReadOnly) return;
    setIsLoading(true);
    try {
      await seedJournalEntriesFromDemoOrders();
      await loadQADatas();
      addToast("Ledger successfully seeded from demo orders.", "success");
    } catch (error) {
      console.error(error);
      addToast("Failed to seed ledger entries.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (resetConfirmation !== 'RESET FLORIST QA DATA') {
      addToast("Incorrect confirmation phrase.", "error");
      return;
    }

    if (import.meta.env.PROD) {
      addToast("Reset is disabled in production.", "error");
      throw new Error("Reset is disabled in production.");
    }

    setIsResetting(true);
    try {
      const collections = ['journalEntries', 'auditLogs', 'orders', 'qaRuns'];
      for (const colName of collections) {
        const snapshot = await getDocs(collection(db, colName));
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, colName, d.id)));
        await Promise.all(deletePromises);
      }

      resetToDemo();
      setResetConfirmation('');
      setLatestEvidenceId(null);
      setHistory([]);
      
      addToast("Firestore collections deleted and local store reset to demo data.", "success");
      await loadQADatas();
    } catch (error) {
      console.error(error);
      addToast("Failed to reset Firestore collections.", "error");
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Category,Verification check,Result,Expected,Actual,Details\n";
    qaResults.forEach(r => {
      csvContent += `"${r.category}","${r.label}","${r.passed ? 'PASS' : 'FAIL'}","${r.expected || ''}","${r.actual || ''}","${r.details || ''}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bloompro-qa-evidence-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("QA evidence exported as CSV.", "success");
  };

  const handleExportPDF = () => {
    const dataForPDF = qaResults.map(r => ({
      id: r.id,
      label: r.label,
      category: r.category,
      passed: r.passed,
      expected: r.expected,
      actual: r.actual
    }));
    exportQAEvidencePDF(dataForPDF, latestEvidenceId || 'Ad-Hoc');
    addToast("QA evidence exported as PDF.", "success");
  };

  const formatRunDate = (timestamp: unknown): string => {
    if (!timestamp) return 'Just now';
    if (typeof timestamp === 'object' && 'toDate' in (timestamp as any)) {
      return (timestamp as any).toDate().toLocaleString();
    }
    return new Date(timestamp as string).toLocaleString();
  };

  // Route Gating View
  if (!isAuthorized) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center', padding: '2rem' }}>
        <ShieldAlert size={64} style={{ color: '#EF4444', marginBottom: '1.5rem' }} />
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0' }}>Access Denied</h2>
        <p style={{ color: '#726E64', fontSize: '0.95rem', maxWidth: '400px', lineHeight: 1.6 }}>
          You do not have authorization to view the QA Verification Console. Please contact your administrator for credentials.
        </p>
      </div>
    );
  }

  // Statistics summaries
  const passedCount = qaResults.filter(r => r.passed).length;
  const failedCount = qaResults.filter(r => !r.passed).length;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '90vh' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600, color: 'var(--color-text-main)', margin: 0 }}>
              Operational QA & Verification Console
            </h1>
            {isReadOnly && (
              <span style={{ fontSize: '0.75rem', background: '#FEF3C7', color: '#D97706', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>READ-ONLY ARCHIVE</span>
            )}
          </div>
          <p style={{ color: '#726E64', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
            Verify ledger reconciliation, audit trails, and financial truth metrics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="outline" onClick={loadQADatas} disabled={isLoading}>
            <RefreshCw size={16} style={{ marginRight: '0.5rem', animation: isLoading ? 'spin 1.5s linear infinite' : 'none' }} />
            Refresh Data
          </Button>
          <Button onClick={handleRunChecks} disabled={isLoading || isReadOnly}>
            Run Verification Tests
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* Left Side: Automated Verification Checks */}
        <div>
          <Card style={{ padding: '1.5rem', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #E8EAE6', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <ShieldCheck size={24} style={{ color: 'var(--color-sage-dark)' }} />
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>Automated QA Verification Checks</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {qaResults.map(result => (
                <div 
                  key={result.id} 
                  style={{ 
                    padding: '1rem', 
                    borderRadius: '10px', 
                    border: '1px solid #E8EAE6', 
                    background: result.passed ? '#F7F9F6' : '#FFF5F5',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-main)' }}>{result.label}</strong>
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        padding: '0.25rem 0.6rem', 
                        borderRadius: '999px',
                        background: result.passed ? '#D1FAE5' : '#FEE2E2',
                        color: result.passed ? '#065F46' : '#991B1B',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      {result.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {result.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#555' }}>{result.details}</p>
                  {(result.expected !== undefined || result.actual !== undefined) && (
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#777', background: '#FFFFFF', padding: '0.5rem', borderRadius: '6px', border: '1px solid #EDEDED' }}>
                      <span><strong>Expected:</strong> {result.expected}</span>
                      <span><strong>Actual:</strong> {result.actual}</span>
                    </div>
                  )}
                </div>
              ))}

              {qaResults.length === 0 && (
                <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No checks run yet. Click Refresh or Run Verification.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Side: Evidence Lockdown, Seeding, Reset & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Evidence Lockdown Badge */}
          <Card style={{ padding: '1.5rem', background: '#F9FBF8', border: '1px solid #E2EADA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #E2EADA', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <ShieldCheck size={20} style={{ color: 'var(--color-sage-dark)' }} />
              <h4 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--color-text-main)' }}>Evidence Lockdown</h4>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.825rem', color: '#555', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Environment:</span>
                <strong style={{ textTransform: 'capitalize', color: 'var(--color-text-main)' }}>
                  {import.meta.env.PROD ? 'production' : 'development'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Build:</span>
                <strong style={{ color: 'var(--color-text-main)' }}>v2.1.0</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Passed Checks:</span>
                <strong style={{ color: '#065F46' }}>{passedCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Failed Checks:</span>
                <strong style={{ color: failedCount > 0 ? '#991B1B' : '#555' }}>{failedCount}</strong>
              </div>
              {latestEvidenceId && (
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: '#F0F4EF', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace', color: '#444' }}>
                  <span>Firestore Record:</span>
                  <span style={{ wordBreak: 'break-all', fontWeight: 600 }}>qaRuns/{latestEvidenceId}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={handleExportPDF} 
                disabled={qaResults.length === 0} 
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  padding: '0.5rem', fontSize: '0.8rem', background: '#FFF', border: '1px solid #C1D0B7',
                  borderRadius: '6px', color: 'var(--color-sage-dark)', fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Download size={14} /> Export PDF
              </button>
              <button 
                onClick={handleExportCSV} 
                disabled={qaResults.length === 0} 
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  padding: '0.5rem', fontSize: '0.8rem', background: '#FFF', border: '1px solid #C1D0B7',
                  borderRadius: '6px', color: 'var(--color-sage-dark)', fontWeight: 600, cursor: 'pointer'
                }}
              >
                <FileText size={14} /> Export CSV
              </button>
            </div>
          </Card>

          {/* Data Seeding Panel */}
          <Card style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #E8EAE6', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <Database size={24} style={{ color: 'var(--color-sage-dark)' }} />
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>Data Seeding & Ledger Sync</h3>
            </div>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#555', lineHeight: '1.4' }}>
              Sync general ledger entries from orders. Seeding is fully idempotent and prevents inflated treasury metrics.
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Button onClick={handleSeedLedger} disabled={isLoading || isReadOnly}>
                Seed Ledger from Orders
              </Button>
              <div style={{ fontSize: '0.75rem', color: '#726E64' }}>
                Active Orders: <strong>{orders.length}</strong> <br />
                Ledger Entries: <strong>{journalEntries.length}</strong>
              </div>
            </div>
          </Card>

          {/* Persistent QA Run History */}
          <Card style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #E8EAE6', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <ShieldCheck size={22} style={{ color: 'var(--color-sage-dark)' }} />
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.2rem' }}>QA Verification History</h3>
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map((run) => (
                <div key={run.id} style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', background: '#FCFAF7', borderRadius: '6px', border: '1px solid #EDEDED', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong style={{ color: 'var(--color-text-main)' }}>Run by: {run.runBy}</strong>
                    <span style={{ color: run.checksFailed > 0 ? '#991B1B' : '#065F46', fontWeight: 700 }}>
                      {run.checksFailed > 0 ? 'FAILING' : 'SECURE'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                    <span>{formatRunDate(run.runAt)} ({run.environment})</span>
                    <span>Passed: {run.checksPassed} | Failed: {run.checksFailed}</span>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', fontSize: '0.75rem', margin: '1rem 0' }}>No verification history found.</p>
              )}
            </div>
          </Card>

          {/* Database Reset Guard */}
          {!isReadOnly && (
            <Card style={{ padding: '1.5rem', border: '1px solid #FCA5A5', background: '#FEF2F2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #FEE2E2', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <ShieldAlert size={24} style={{ color: '#EF4444' }} />
                <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: '#991B1B' }}>Danger Zone: Clear Sandbox</h3>
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#991B1B', lineHeight: '1.4' }}>
                Clears Firestore collections and resets local states to default. Disabled in production.
              </p>

              <form onSubmit={handleResetFirestore} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#EF4444' }}>
                    Type "RESET FLORIST QA DATA" to confirm:
                  </label>
                  <input 
                    type="text" 
                    value={resetConfirmation}
                    onChange={(e) => setResetConfirmation(e.target.value)}
                    placeholder="RESET FLORIST QA DATA" 
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid #FCA5A5',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                    disabled={import.meta.env.PROD}
                  />
                </div>

                <Button 
                  type="submit" 
                  variant="outline" 
                  style={{ 
                    borderColor: '#EF4444', 
                    color: '#EF4444', 
                    background: '#FFFFFF',
                    alignSelf: 'flex-start',
                    fontWeight: 600
                  }}
                  disabled={resetConfirmation !== 'RESET FLORIST QA DATA' || isResetting || import.meta.env.PROD}
                >
                  <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                  {isResetting ? 'Wiping Database...' : 'Clear and Reset Firestore'}
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>

      {/* Audit Trail Activity Panel */}
      <Card style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #E8EAE6', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <ShieldCheck size={24} style={{ color: 'var(--color-sage-dark)' }} />
          <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>Recent Database Audit Trail</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #E8EAE6', paddingBottom: '0.5rem' }}>
                <th style={{ padding: '0.5rem' }}>Actor</th>
                <th style={{ padding: '0.5rem' }}>Action</th>
                <th style={{ padding: '0.5rem' }}>Entity</th>
                <th style={{ padding: '0.5rem' }}>Entity ID</th>
                <th style={{ padding: '0.5rem' }}>Details (Before &rarr; After)</th>
                <th style={{ padding: '0.5rem' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => {
                const date = log.createdAt ? (log.createdAt as any).toDate?.() || new Date(log.createdAt as any) : new Date();
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid #F0EDE6' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{log.actor}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span style={{
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        background: '#EAECE9',
                        fontSize: '0.7rem',
                        fontWeight: 600
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#666' }}>{log.entityType}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>{log.entityId.substring(0, 10)}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {log.before && <span style={{ color: '#991B1B', background: '#FEE2E2', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{JSON.stringify(log.before)}</span>}
                      {log.before && <ArrowRight size={12} style={{ display: 'inline', margin: '0 0.25rem' }} />}
                      {log.after && <span style={{ color: '#065F46', background: '#D1FAE5', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{JSON.stringify(log.after)}</span>}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#726E64' }}>{date.toLocaleTimeString()} {date.toLocaleDateString()}</td>
                  </tr>
                );
              })}

              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No audit logs recorded yet. Perform some mutations to write logs.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
