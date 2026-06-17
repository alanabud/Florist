import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './MaintenanceModal.module.css';
import { useI18n } from '../../i18n/I18nProvider';

export interface TabFieldOption {
  value: string | number;
  label: string;
}

export interface TabFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'checkbox' | 'display' | 'custom';
  required?: boolean;
  placeholder?: string;
  options?: TabFieldOption[];
  colSpan?: 1 | 2 | 3; // 1 = standard, 2 = span 2, 3 = span all
  readOnly?: boolean;
  section?: string; // Optional Section Grouping Card
  render?: (values: Record<string, any>, onChange: (name: string, value: any) => void) => React.ReactNode;
}

export interface TabConfig {
  id: string;
  label: string;
  badge?: string | number;
  fields: TabFieldConfig[];
}

export interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: Record<string, any>) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  title: string;
  subtitle?: string;
  mode: 'create' | 'edit' | 'view';
  initialValues: Record<string, any>;
  tabs: TabConfig[];
  statusBadgeText?: string;
  statusBadgeClass?: string;
  showDraftButton?: boolean;
  onSaveDraft?: (values: Record<string, any>) => void | Promise<void>;
  validate?: (values: Record<string, any>) => Record<string, string>;
  summaryMetrics?: {
    status?: string;
    total?: number;
    paymentStatus?: string;
    assignedStaff?: string;
    deliveryDate?: string;
    priority?: string;
  };
  children?: React.ReactNode;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  title,
  subtitle,
  mode,
  initialValues,
  tabs,
  statusBadgeText,
  statusBadgeClass,
  showDraftButton = false,
  onSaveDraft,
  validate,
  summaryMetrics,
  children,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load initial values when modal opens or initialValues change
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setFormValues(initialValues || {});
        setErrors({});
        if (tabs.length > 0) {
          setActiveTab(tabs[0].id);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialValues, tabs]);

  if (!isOpen) return null;

  const handleFieldChange = (name: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    let newErrors: Record<string, string> = {};

    if (validate) {
      newErrors = validate(formValues);
    } else {
      // Fallback simple validation
      tabs.forEach((tab) => {
        tab.fields.forEach((field) => {
          if (field.required && field.type !== 'custom') {
            const val = formValues[field.name];
            if (val === undefined || val === null || val === '') {
              newErrors[field.name] = `${field.label} is required`;
            }
          }
        });
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'view' || isSubmitting) return;

    if (!validateForm()) {
      // Find the first tab containing an error and switch to it
      const errorFields = Object.keys(errors);
      if (errorFields.length > 0) {
        const firstErrorField = errorFields[0];
        const tabWithError = tabs.find((t) =>
          t.fields.some((f) => f.name === firstErrorField)
        );
        if (tabWithError) {
          setActiveTab(tabWithError.id);
        }
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formValues);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDraftSubmit = async () => {
    if (!onSaveDraft || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSaveDraft(formValues);
    } catch (err) {
      console.error('Draft save failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!onDelete || isSubmitting) return;
    if (window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      setIsSubmitting(true);
      try {
        await onDelete();
      } catch (err) {
        console.error('Delete failed:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Get active tab config
  const currentTabConfig = tabs.find((t) => t.id === activeTab);

  // Group fields inside active tab by section
  const sectionsMap: Record<string, TabFieldConfig[]> = {};
  if (currentTabConfig) {
    currentTabConfig.fields.forEach((field) => {
      const sectionName = field.section || 'General Information';
      if (!sectionsMap[sectionName]) {
        sectionsMap[sectionName] = [];
      }
      sectionsMap[sectionName].push(field);
    });
  }

  // Helper to determine CSS class for column spans
  const getColSpanClass = (span?: 1 | 2 | 3) => {
    if (span === 3) return `${styles.formGroup} ${styles.formGroupFull}`;
    if (span === 2) return `${styles.formGroup} ${styles.formGroupSpan2}`;
    return styles.formGroup;
  };

  // Helper to check if a tab contains fields with errors
  const getTabErrorCount = (tabId: string): number => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return 0;
    return tab.fields.filter((f) => errors[f.name]).length;
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 className={styles.title}>{title}</h2>
              {statusBadgeText && (
                <span className={`${styles.tabBadge} ${statusBadgeClass || ''}`} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  {statusBadgeText.toUpperCase()}
                </span>
              )}
            </div>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>

        {/* Summary Ribbon */}
        {summaryMetrics && (
          <div className={styles.summaryRibbon}>
            <div className={styles.ribbonItem}>
              <span className={styles.ribbonLabel}>Status</span>
              <span className={`${styles.ribbonValue} ${styles['status_' + summaryMetrics.status] || ''}`}>
                {(summaryMetrics.status || '—').toUpperCase().replace('_', ' ')}
              </span>
            </div>
            <div className={styles.ribbonItem}>
              <span className={styles.ribbonLabel}>{t('maintenance.totalAmount')}</span>
              <span className={styles.ribbonValue} style={{ fontWeight: 700, color: 'var(--color-sage-dark)' }}>
                {summaryMetrics.total !== undefined ? `$${summaryMetrics.total.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className={styles.ribbonItem}>
              <span className={styles.ribbonLabel}>{t('maintenance.paymentStatus')}</span>
              <span className={`${styles.ribbonValue} ${styles['payment_' + summaryMetrics.paymentStatus] || ''}`}>
                {(summaryMetrics.paymentStatus || '—').toUpperCase()}
              </span>
            </div>
            <div className={styles.ribbonItem}>
              <span className={styles.ribbonLabel}>{t('maintenance.assignedStaff')}</span>
              <span className={styles.ribbonValue}>{summaryMetrics.assignedStaff || 'Unassigned'}</span>
            </div>
            <div className={styles.ribbonItem}>
              <span className={styles.ribbonLabel}>{t('maintenance.deliveryDate')}</span>
              <span className={styles.ribbonValue}>
                {summaryMetrics.deliveryDate ? new Date(summaryMetrics.deliveryDate).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className={styles.ribbonItem}>
              <span className={styles.ribbonLabel}>Priority</span>
              <span className={`${styles.ribbonValue} ${styles['priority_' + summaryMetrics.priority] || ''}`}>
                {(summaryMetrics.priority || 'normal').toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Tab Bar */}
        <div className={styles.tabBar}>
          {tabs.map((tab) => {
            const errorCount = getTabErrorCount(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                {errorCount > 0 ? (
                  <span className={styles.tabBadge} style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                    {errorCount}
                  </span>
                ) : tab.badge !== undefined && tab.badge !== null && tab.badge !== '' ? (
                  <span className={styles.tabBadge}>{tab.badge}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Body with Section Cards */}
        <div className={styles.body}>
          {currentTabConfig && (
            <div className={styles.sectionsContainer}>
              {Object.entries(sectionsMap).map(([sectionName, sectionFields]) => (
                <div key={sectionName} className={styles.sectionCard}>
                  <h3 className={styles.sectionHeader}>{sectionName}</h3>
                  <div className={styles.formGrid}>
                    {sectionFields.map((field) => {
                      const isFieldReadOnly = mode === 'view' || field.readOnly;
                      const fieldId = `field-${field.name}`;
                      const hasError = !!errors[field.name];

                      if (field.type === 'custom' && field.render) {
                        return (
                          <div key={field.name} className={getColSpanClass(field.colSpan)}>
                            {field.render(formValues, handleFieldChange)}
                          </div>
                        );
                      }

                      return (
                        <div key={field.name} className={getColSpanClass(field.colSpan)}>
                          {field.type !== 'checkbox' && (
                            <label htmlFor={fieldId} className={styles.formLabel}>
                              {field.label}
                              {field.required && !isFieldReadOnly && <span style={{ color: '#DC2626' }}> *</span>}
                            </label>
                          )}

                          {field.type === 'textarea' ? (
                            <textarea
                              id={fieldId}
                              name={field.name}
                              placeholder={field.placeholder}
                              value={formValues[field.name] || ''}
                              onChange={(e) => handleFieldChange(field.name, e.target.value)}
                              className={`${styles.formInput} ${styles.formTextarea}`}
                              disabled={isFieldReadOnly}
                              style={hasError ? { borderColor: '#EF4444' } : undefined}
                            />
                          ) : field.type === 'select' ? (
                            <select
                              id={fieldId}
                              name={field.name}
                              value={formValues[field.name] || ''}
                              onChange={(e) => handleFieldChange(field.name, e.target.value)}
                              className={`${styles.formInput} ${styles.formSelect}`}
                              disabled={isFieldReadOnly}
                              style={hasError ? { borderColor: '#EF4444' } : undefined}
                            >
                              <option value="">{t('maintenance.selectOption')}</option>
                              {field.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'checkbox' ? (
                            <div className={styles.formCheckboxRow}>
                              <input
                                type="checkbox"
                                id={fieldId}
                                name={field.name}
                                checked={!!formValues[field.name]}
                                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                                className={styles.formCheckbox}
                                disabled={isFieldReadOnly}
                              />
                              <label htmlFor={fieldId} className={styles.formCheckboxLabel}>
                                {field.label}
                              </label>
                            </div>
                          ) : field.type === 'display' ? (
                            <div className={styles.infoPanel} style={{ padding: '0.5rem 0.75rem' }}>
                              <span className={styles.infoPanelValue}>
                                {formValues[field.name] !== undefined && formValues[field.name] !== null
                                  ? String(formValues[field.name])
                                  : '—'}
                              </span>
                            </div>
                          ) : (
                            <input
                              type={field.type}
                              id={fieldId}
                              name={field.name}
                              placeholder={field.placeholder}
                              value={formValues[field.name] !== undefined && formValues[field.name] !== null ? formValues[field.name] : ''}
                              onChange={(e) => handleFieldChange(field.name, e.target.value)}
                              className={styles.formInput}
                              disabled={isFieldReadOnly}
                              style={hasError ? { borderColor: '#EF4444' } : undefined}
                            />
                          )}

                          {hasError && !isFieldReadOnly && (
                            <span style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.25rem', display: 'block' }}>
                              {errors[field.name]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {onDelete && mode === 'edit' && (
              <button
                type="button"
                className={styles.btnDelete}
                onClick={handleDeleteClick}
                disabled={isSubmitting}
              >
                Delete Record
              </button>
            )}
            {children}
          </div>
          <div className={styles.footerRight}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onClose}
              disabled={isSubmitting}
            >
              {mode === 'view' ? 'Close' : 'Cancel'}
            </button>

            {mode !== 'view' && showDraftButton && onSaveDraft && (
              <button
                type="button"
                className={styles.btnDraft}
                onClick={handleDraftSubmit}
                disabled={isSubmitting}
              >
                Save Draft
              </button>
            )}

            {mode !== 'view' && (
              <button
                type="button"
                className={styles.btnSubmit}
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
