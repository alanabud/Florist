import type { ReconciliationRunType } from './reconciliationTypes';

// Local (not UTC) YYYY-MM-DD, so "today" matches what an <input type="date">
// shows the user in their own timezone.
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface RunDateRange {
  start: string;
  end: string;
}

/**
 * Suggest a sensible, NEVER-in-the-future date range for a new audit run.
 * The end date is always clamped to today, so the default selection can never
 * disable the form. Month-oriented run types start at the first of the current
 * month while it is still open (rather than defaulting to a future month-end).
 */
export function getDefaultRunRange(
  runType: ReconciliationRunType,
  now: Date = new Date()
): RunDateRange {
  const today = toDateStr(now);
  const firstOfMonth = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));

  switch (runType) {
    case 'daily':
      return { start: today, end: today };
    case 'weekly': {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 6);
      return { start: toDateStr(weekStart), end: today };
    }
    case 'month_end':
    case 'tax_readiness':
    case 'historical_baseline':
    default:
      return { start: firstOfMonth, end: today };
  }
}

export interface StartScanValidationInput {
  hasCompany: boolean;
  runType?: string | null;
  start?: string | null;
  end?: string | null;
  today: string;
  submitting: boolean;
}

/**
 * Single source of truth for why "Start Scan" is blocked. Returns a
 * human-readable reason, or null when the form is valid and submittable.
 * The UI mirrors these exact rules in the disabled state AND surfaces the
 * reason, so the button is never silently disabled.
 */
export function getStartScanDisabledReason(input: StartScanValidationInput): string | null {
  if (!input.hasCompany) return 'Active company context is required.';
  if (!input.runType) return 'Run type is required.';
  if (!input.start || !input.end) return 'Start and end dates are required.';
  if (input.start > input.end) return 'Start date must be on or before the end date.';
  if (input.end > input.today) return 'End date cannot be in the future.';
  if (input.submitting) return 'Audit is already being created.';
  return null;
}
