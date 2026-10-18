import React from 'react';
import { SITE_CONFIG } from '../config/siteConfig';
import { useI18n } from '../i18n/I18nProvider';
import styles from './InfoPages.module.css';

/**
 * Storefront information pages (About, Contact, FAQ, Delivery Policy,
 * Terms of Service, Privacy Policy).
 *
 * Copy lives in the locale files under `infopages.*` (English source in
 * en-US; other locales currently fall back to it). Business facts (name,
 * email, phone, address, delivery cities, governing law) are injected
 * from SITE_CONFIG — see src/config/siteConfig.ts. Facts Alan has not
 * confirmed yet are empty strings there, and these pages HIDE the
 * corresponding rows/sections (or fall back to the trading name) rather
 * than rendering placeholder text to visitors. Policy copy is generic
 * storefront copy and should be reviewed by Alan (and counsel) before
 * the store takes real orders.
 */

const LEGAL_LAST_UPDATED = 'October 17, 2026';

/** Full one-line address, or '' while no address has been configured. */
const fullAddress = () =>
  SITE_CONFIG.addressLine1
    ? `${SITE_CONFIG.addressLine1}, ${SITE_CONFIG.addressCity}, ${SITE_CONFIG.addressState} ${SITE_CONFIG.addressZip}`
    : '';

/** Legal entity for the legal pages: the confirmed legal name, else the trading name. */
const legalName = () => SITE_CONFIG.legalBusinessName || SITE_CONFIG.businessName;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className={styles.section}>
    <h2>{title}</h2>
    {children}
  </div>
);

export const AboutPage: React.FC = () => {
  const { t } = useI18n();
  const p = { businessName: SITE_CONFIG.businessName };
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('infopages.about.title')}</h1>
      <p className={styles.lede}>{t('infopages.about.lede', p)}</p>
      <Section title={t('infopages.about.howTitle')}>
        <p>{t('infopages.about.howBody')}</p>
      </Section>
      <Section title={t('infopages.about.makeTitle')}>
        <ul>
          <li>{t('infopages.about.item1')}</li>
          <li>{t('infopages.about.item2')}</li>
          <li>{t('infopages.about.item3')}</li>
          <li>{t('infopages.about.item4')}</li>
        </ul>
        {/* The founding story renders only once Alan writes it into
            SITE_CONFIG.foundingStory — no placeholder text is shown. */}
        {SITE_CONFIG.foundingStory && <p>{SITE_CONFIG.foundingStory}</p>}
      </Section>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('infopages.contact.title')}</h1>
      <p className={styles.lede}>{t('infopages.contact.lede')}</p>

      {/* Only configured contact facts are rendered — a field Alan has
          not set yet (empty in SITE_CONFIG) produces no row at all,
          never an empty box or placeholder text. */}
      <div className={styles.contactCard}>
        <p>
          <strong>{t('infopages.contact.emailLabel')}</strong>{' '}
          <a href={`mailto:${SITE_CONFIG.contactEmail}`}>{SITE_CONFIG.contactEmail}</a>
        </p>
        {SITE_CONFIG.contactPhone && (
          <p>
            <strong>{t('infopages.contact.phoneLabel')}</strong> {SITE_CONFIG.contactPhone}
          </p>
        )}
        {fullAddress() && (
          <p>
            <strong>{t('infopages.contact.studioLabel')}</strong> {fullAddress()}
          </p>
        )}
        {SITE_CONFIG.supportHours && (
          <p>
            <strong>{t('infopages.contact.hoursLabel')}</strong> {SITE_CONFIG.supportHours}
          </p>
        )}
      </div>

      <Section title={t('infopages.contact.orderHelpTitle')}>
        <p>{t('infopages.contact.orderHelpBody')}</p>
      </Section>

      <Section title={t('infopages.contact.eventsTitle')}>
        <p>
          {t('infopages.contact.eventsBody', { email: SITE_CONFIG.contactEmail })}
        </p>
      </Section>
    </div>
  );
};

export const FaqPage: React.FC = () => {
  const { t } = useI18n();
  const items = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    q: t(`infopages.faq.q${n}`),
    a: t(`infopages.faq.a${n}`, { email: SITE_CONFIG.contactEmail }),
  }));
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('infopages.faq.title')}</h1>
      <p className={styles.lede}>{t('infopages.faq.lede')}</p>
      {items.map((item) => (
        <div key={item.q} className={styles.faqItem}>
          <h3>{item.q}</h3>
          <p>{item.a}</p>
        </div>
      ))}
    </div>
  );
};

export const DeliveryPage: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('infopages.delivery.title')}</h1>
      <p className={styles.lede}>
        {t('infopages.delivery.lede', { businessName: SITE_CONFIG.businessName })}
      </p>

      <Section title={t('infopages.delivery.optionsTitle')}>
        <ul>
          <li>
            <strong>{t('infopages.delivery.standard')}</strong>{' '}
            {t('infopages.delivery.standardDesc')}
          </li>
          <li>
            <strong>{t('infopages.delivery.sameday')}</strong>{' '}
            {t('infopages.delivery.samedayDesc')}
          </li>
          <li>
            <strong>{t('infopages.delivery.pickup')}</strong>{' '}
            {fullAddress()
              ? t('infopages.delivery.pickupDesc', { address: fullAddress() })
              : t('infopages.delivery.pickupDescNoAddress')}
          </li>
        </ul>
        <p>{t('infopages.delivery.feesNote')}</p>
      </Section>

      <Section title={t('infopages.delivery.areasTitle')}>
        {SITE_CONFIG.deliveryCities.length > 0 ? (
          <p>
            {t('infopages.delivery.areasBody', {
              cities: SITE_CONFIG.deliveryCities.join(', '),
            })}
          </p>
        ) : (
          <p>{t('infopages.delivery.areasUnset', { email: SITE_CONFIG.contactEmail })}</p>
        )}
      </Section>

      <Section title={t('infopages.delivery.dayTitle')}>
        <p>{t('infopages.delivery.dayBody')}</p>
      </Section>

      <Section title={t('infopages.delivery.trackingTitle')}>
        <p>{t('infopages.delivery.trackingBody')}</p>
      </Section>

      <Section title={t('infopages.delivery.guaranteeTitle')}>
        <p>{t('infopages.delivery.guaranteeBody')}</p>
      </Section>
    </div>
  );
};

export const TermsPage: React.FC = () => {
  const { t } = useI18n();
  const params = {
    businessName: SITE_CONFIG.businessName,
    legalName: legalName(),
    email: SITE_CONFIG.contactEmail,
    phone: SITE_CONFIG.contactPhone,
    state: SITE_CONFIG.governingLawState,
  };
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('infopages.terms.title')}</h1>
      <p className={styles.meta}>
        {t('infopages.lastUpdated', { date: LEGAL_LAST_UPDATED })}
      </p>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
        <Section key={n} title={t(`infopages.terms.s${n}Title`)}>
          <p>{t(`infopages.terms.s${n}Body`, params)}</p>
        </Section>
      ))}
      {/* Governing law renders only once Alan confirms the state —
          an unconfirmed jurisdiction is never printed. */}
      {SITE_CONFIG.governingLawState && (
        <Section title={t('infopages.terms.s9Title')}>
          <p>{t('infopages.terms.s9Body', params)}</p>
        </Section>
      )}
      <Section title={t('infopages.terms.s10Title')}>
        <p>{t('infopages.terms.s10Body', params)}</p>
      </Section>
      <Section title={t('infopages.terms.s11Title')}>
        <p>
          {SITE_CONFIG.contactPhone
            ? t('infopages.terms.s11Body', params)
            : t('infopages.terms.s11BodyNoPhone', params)}
        </p>
      </Section>
    </div>
  );
};

export const PrivacyPage: React.FC = () => {
  const { t } = useI18n();
  const params = {
    businessName: SITE_CONFIG.businessName,
    legalName: legalName(),
    email: SITE_CONFIG.contactEmail,
  };
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('infopages.privacy.title')}</h1>
      <p className={styles.meta}>
        {t('infopages.lastUpdated', { date: LEGAL_LAST_UPDATED })}
      </p>

      <Section title={t('infopages.privacy.s1Title')}>
        <p>{t('infopages.privacy.s1Body', params)}</p>
      </Section>

      <Section title={t('infopages.privacy.s2Title')}>
        <ul>
          <li>{t('infopages.privacy.s2Item1')}</li>
          <li>{t('infopages.privacy.s2Item2')}</li>
          <li>{t('infopages.privacy.s2Item3')}</li>
          <li>{t('infopages.privacy.s2Item4')}</li>
        </ul>
      </Section>

      <Section title={t('infopages.privacy.s3Title')}>
        <ul>
          <li>{t('infopages.privacy.s3Item1')}</li>
          <li>{t('infopages.privacy.s3Item2')}</li>
          <li>{t('infopages.privacy.s3Item3')}</li>
          <li>{t('infopages.privacy.s3Item4')}</li>
          <li>{t('infopages.privacy.s3Item5')}</li>
        </ul>
        <p>{t('infopages.privacy.s3Note')}</p>
      </Section>

      {[4, 5, 6, 7, 8, 9].map((n) => (
        <Section key={n} title={t(`infopages.privacy.s${n}Title`)}>
          <p>{t(`infopages.privacy.s${n}Body`, params)}</p>
        </Section>
      ))}
    </div>
  );
};
