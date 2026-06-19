import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';
import type { ReconciliationRun, ReconciliationException } from './reconciliationTypes';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

const SAGE_RGB = '6C8271';
const TEXT_DARK = '2C302E';

export interface ExportOptions {
  companyName?: string;
  currencyCode?: string;
  locale?: string;
  reportFooterText?: string;
}

const LABELS: Record<string, Record<string, string>> = {
  'en-US': {
    reportTitle: 'AI Reconciliation & Compliance Report',
    generated: 'Generated:',
    period: 'Period:',
    runNumber: 'Run Number:',
    runType: 'Run Type:',
    healthScore: 'Health Score:',
    status: 'Status:',
    exceptionsSummary: 'Exceptions Summary',
    module: 'Module',
    severity: 'Severity',
    title: 'Title',
    variance: 'Variance',
    statusCol: 'Resolution Status',
    aiExplanation: 'AI Explanation & Insights',
    suggestedFix: 'Suggested Fix',
    disclaimer: 'Prepared for internal review; not a tax filing.',
    glDebits: 'GL Total Debits',
    glCredits: 'GL Total Credits',
    arSubledger: 'AR Subledger Total',
    apSubledger: 'AP Subledger Total',
    inventoryValuation: 'Inventory Valuation',
    cashTotal: 'Cash & Payments',
    salesTaxCollected: 'Sales Tax Collected'
  },
  'es-US': {
    reportTitle: 'Informe de Conciliación y Cumplimiento de IA',
    generated: 'Generado:',
    period: 'Período:',
    runNumber: 'Número de ejecución:',
    runType: 'Tipo de ejecución:',
    healthScore: 'Puntaje de salud:',
    status: 'Estado:',
    exceptionsSummary: 'Resumen de excepciones',
    module: 'Módulo',
    severity: 'Severidad',
    title: 'Título',
    variance: 'Varianza',
    statusCol: 'Estado de resolución',
    aiExplanation: 'Explicación e información de IA',
    suggestedFix: 'Solución sugerida',
    disclaimer: 'Preparado para revisión interna; no es una declaración de impuestos.',
    glDebits: 'Débitos totales de GL',
    glCredits: 'Créditos totales de GL',
    arSubledger: 'Total del libro auxiliar de AR',
    apSubledger: 'Total del libro auxiliar de AP',
    inventoryValuation: 'Valoración de inventario',
    cashTotal: 'Efectivo y pagos',
    salesTaxCollected: 'Impuestos sobre las ventas recaudados'
  },
  'fr-FR': {
    reportTitle: 'Rapport de Rapprochement et de Conformité IA',
    generated: 'Généré:',
    period: 'Période:',
    runNumber: 'Numéro d\'exécution:',
    runType: 'Type d\'exécution:',
    healthScore: 'Score de santé:',
    status: 'Statut:',
    exceptionsSummary: 'Résumé des Exceptions',
    module: 'Module',
    severity: 'Gravité',
    title: 'Titre',
    variance: 'Écart',
    statusCol: 'Statut de Résolution',
    aiExplanation: 'Explication et Informations IA',
    suggestedFix: 'Correction Suggérée',
    disclaimer: 'Préparé pour examen interne ; pas une déclaration de revenus.',
    glDebits: 'Total des Débits GL',
    glCredits: 'Total des Crédits GL',
    arSubledger: 'Total du Grand Livre Auxiliaire Client',
    apSubledger: 'Total du Grand Livre Auxiliaire Fournisseur',
    inventoryValuation: 'Valorisation des Stocks',
    cashTotal: 'Trésorerie et Paiements',
    salesTaxCollected: 'TVA Collectée'
  },
  'nl-NL': {
    reportTitle: 'AI Reconciliatie & Compliance Rapport',
    generated: 'Gegenereerd:',
    period: 'Periode:',
    runNumber: 'Run Nummer:',
    runType: 'Run Type:',
    healthScore: 'Gezondheidsscore:',
    status: 'Status:',
    exceptionsSummary: 'Uitzonderingen Overzicht',
    module: 'Module',
    severity: 'Ernst',
    title: 'Titel',
    variance: 'Verschil',
    statusCol: 'Resolutiestatus',
    aiExplanation: 'AI Toelichting & Inzichten',
    suggestedFix: 'Voorgestelde Correctie',
    disclaimer: 'Voorbereid voor interne review; geen belastingaangifte.',
    glDebits: 'GL Totaal Debet',
    glCredits: 'GL Totaal Credit',
    arSubledger: 'AR Subledger Totaal',
    apSubledger: 'AP Subledger Totaal',
    inventoryValuation: 'Voorraadwaardering',
    cashTotal: 'Geld & Betalingen',
    salesTaxCollected: 'Btw Verzameld'
  }
};

function getFormattedCurrency(amount: number, currencyCode = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

export function exportReconciliationPDF(
  run: ReconciliationRun,
  exceptions: ReconciliationException[],
  options?: ExportOptions
) {
  const locale = options?.locale || 'en-US';
  const currency = options?.currencyCode || 'USD';
  const brandName = options?.companyName || 'BloomPro Studio';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  const docPdf = new jsPDF() as any;

  // Title & Header Branding Banner
  docPdf.setFont('helvetica', 'bold');
  docPdf.setFontSize(20);
  docPdf.setTextColor(44, 48, 46); // TEXT_DARK
  docPdf.text(brandName, 14, 20);

  docPdf.setFontSize(14);
  docPdf.setTextColor(108, 130, 113); // SAGE
  docPdf.text(langLabels.reportTitle, 14, 28);

  // Divider Line
  docPdf.setDrawColor(108, 130, 113);
  docPdf.setLineWidth(1);
  docPdf.line(14, 32, 196, 32);

  // Metadata block
  docPdf.setFont('helvetica', 'normal');
  docPdf.setFontSize(10);
  docPdf.setTextColor(107, 114, 128); // TEXT_MUTED
  
  docPdf.text(`${langLabels.runNumber} ${run.runNumber}`, 14, 40);
  docPdf.text(`${langLabels.runType} ${run.runType.toUpperCase()}`, 14, 46);
  docPdf.text(`${langLabels.period} ${run.periodStart} to ${run.periodEnd}`, 14, 52);
  
  docPdf.text(`${langLabels.generated} ${new Date().toLocaleString(locale)}`, 130, 40);
  docPdf.text(`${langLabels.healthScore} ${run.summary.healthScore}/100`, 130, 46);
  docPdf.text(`${langLabels.status} ${run.status.toUpperCase()}`, 130, 52);

  // 1. Snapshot Summary Table
  const summaryRows = [
    [langLabels.glDebits, getFormattedCurrency(run.summary.glDebits, currency, locale)],
    [langLabels.glCredits, getFormattedCurrency(run.summary.glCredits, currency, locale)],
    [langLabels.arSubledger, getFormattedCurrency(run.summary.arSubledgerTotal, currency, locale)],
    [langLabels.apSubledger, getFormattedCurrency(run.summary.apSubledgerTotal, currency, locale)],
    [langLabels.inventoryValuation, getFormattedCurrency(run.summary.inventoryValuation, currency, locale)],
    [langLabels.cashTotal, getFormattedCurrency(run.summary.cashReceiptsTotal, currency, locale)],
    [langLabels.salesTaxCollected, getFormattedCurrency(run.summary.salesTaxCollected, currency, locale)]
  ];

  docPdf.setFont('helvetica', 'bold');
  docPdf.setFontSize(12);
  docPdf.setTextColor(44, 48, 46);
  docPdf.text("Financial Ledger Snapshots", 14, 64);

  docPdf.autoTable({
    startY: 68,
    head: [['Metric', 'Computed Value']],
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillStyle: 'solid', fillColor: [108, 130, 113], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [250, 250, 248] },
    margin: { horizontal: 14 }
  });

  let nextY = docPdf.lastAutoTable.finalY + 12;

  // 2. Exceptions Table
  docPdf.text(langLabels.exceptionsSummary, 14, nextY);
  nextY += 4;

  if (exceptions.length === 0) {
    docPdf.setFont('helvetica', 'italic');
    docPdf.setFontSize(10);
    docPdf.text("No discrepancies or exceptions found for this run period. Ledger is fully reconciled.", 14, nextY);
  } else {
    const exceptionHeaders = [langLabels.module, langLabels.severity, langLabels.title, langLabels.variance, langLabels.statusCol];
    const exceptionRows = exceptions.map(e => [
      e.module.toUpperCase(),
      e.severity.toUpperCase(),
      e.title,
      e.varianceAmount !== undefined ? getFormattedCurrency(e.varianceAmount, currency, locale) : '—',
      e.status.toUpperCase()
    ]);

    docPdf.autoTable({
      startY: nextY,
      head: [exceptionHeaders],
      body: exceptionRows,
      theme: 'grid',
      headStyles: { fillColor: [108, 130, 113] },
      alternateRowStyles: { fillColor: [250, 250, 248] },
      margin: { horizontal: 14 }
    });

    nextY = docPdf.lastAutoTable.finalY + 10;

    // AI Analysis section
    if (run.aiSummary) {
      if (nextY > 230) {
        docPdf.addPage();
        nextY = 20;
      }
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(12);
      docPdf.text("AI Auditor Insights & Explanations", 14, nextY);
      nextY += 6;

      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(9);
      docPdf.setTextColor(44, 48, 46);
      const splitAiText = docPdf.splitTextToSize(run.aiSummary, 182);
      docPdf.text(splitAiText, 14, nextY);
    }
  }

  // Footer Disclaimer
  docPdf.setFont('helvetica', 'italic');
  docPdf.setFontSize(8);
  docPdf.setTextColor(156, 163, 175);
  docPdf.text(options?.reportFooterText || langLabels.disclaimer, 14, 285);

  docPdf.save(`Reconciliation_Run_${run.runNumber}.pdf`);
}

export function exportReconciliationExcel(
  run: ReconciliationRun,
  exceptions: ReconciliationException[],
  options?: ExportOptions
) {
  const locale = options?.locale || 'en-US';
  const brandName = options?.companyName || 'BloomPro Studio';
  const langLabels = LABELS[locale] || LABELS['en-US'];

  const wb = XLSX.utils.book_new();

  // Excel Cell Styles
  const titleStyle = {
    font: { bold: true, sz: 16, color: { rgb: TEXT_DARK }, name: 'Calibri' }
  };

  const ws = XLSX.utils.aoa_to_sheet([]);
  ws['!ref'] = 'A1:H100';

  // Set titles
  XLSX.utils.sheet_add_aoa(ws, [
    [brandName],
    [langLabels.reportTitle],
    [],
    [`${langLabels.runNumber} ${run.runNumber}`],
    [`${langLabels.runType} ${run.runType.toUpperCase()}`],
    [`${langLabels.period} ${run.periodStart} to ${run.periodEnd}`],
    [`${langLabels.healthScore} ${run.summary.healthScore}/100`],
    [],
    ['Financial Ledger Snapshots'],
    ['Metric', 'Computed Value'],
    [langLabels.glDebits, run.summary.glDebits],
    [langLabels.glCredits, run.summary.glCredits],
    [langLabels.arSubledger, run.summary.arSubledgerTotal],
    [langLabels.apSubledger, run.summary.apSubledgerTotal],
    [langLabels.inventoryValuation, run.summary.inventoryValuation],
    [langLabels.cashTotal, run.summary.cashReceiptsTotal],
    [langLabels.salesTaxCollected, run.summary.salesTaxCollected],
    [],
    [langLabels.exceptionsSummary],
    [langLabels.module, langLabels.severity, langLabels.title, langLabels.variance, langLabels.statusCol]
  ], { origin: 'A1' });

  // Apply exceptions rows
  const exceptionRows = exceptions.map(e => [
    e.module.toUpperCase(),
    e.severity.toUpperCase(),
    e.title,
    e.varianceAmount || 0,
    e.status.toUpperCase()
  ]);
  XLSX.utils.sheet_add_aoa(ws, exceptionRows, { origin: 'A21' });

  // Add AI summary text block
  const aiStartY = 21 + exceptionRows.length + 2;
  XLSX.utils.sheet_add_aoa(ws, [
    ['AI Auditor Insights'],
    [run.aiSummary || 'No insights generated']
  ], { origin: `A${aiStartY}` });

  // Apply styles to cells
  // A1
  ws['A1'].s = titleStyle;
  ws['A2'].s = { ...titleStyle, font: { ...titleStyle.font, sz: 12, color: { rgb: SAGE_RGB } } };

  // Set widths
  ws['!cols'] = [
    { wch: 30 },
    { wch: 20 },
    { wch: 40 },
    { wch: 15 },
    { wch: 20 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Reconciliation Summary');

  XLSX.writeFile(wb, `Reconciliation_Run_${run.runNumber}.xlsx`);
}
