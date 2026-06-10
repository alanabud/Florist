import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Save, Building2, Receipt, Palette } from 'lucide-react';
import { useAdminStore } from '../store/adminStore';
import { useToastStore } from '../store/toastStore';
import styles from '../components/layout/AdminList.module.css';

export const Settings: React.FC = () => {
  const { resetToDemo } = useAdminStore();
  const addToast = useToastStore((state) => state.addToast);

  const [storeName, setStoreName] = useState(() => localStorage.getItem('bloompro_settings_storeName') || 'BloomPro Studio');
  const [email, setEmail] = useState(() => localStorage.getItem('bloompro_settings_email') || 'hello@bloompro.com');
  const [phone, setPhone] = useState(() => localStorage.getItem('bloompro_settings_phone') || '1-800-BLOOMS');
  const [taxDeliv, setTaxDeliv] = useState(() => localStorage.getItem('bloompro_settings_taxDeliv') !== 'false');
  const [theme, setTheme] = useState(() => localStorage.getItem('bloompro_settings_theme') || 'Premium Sage (Default)');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('bloompro_settings_storeName', storeName);
    localStorage.setItem('bloompro_settings_email', email);
    localStorage.setItem('bloompro_settings_phone', phone);
    localStorage.setItem('bloompro_settings_taxDeliv', taxDeliv.toString());
    localStorage.setItem('bloompro_settings_theme', theme);
    addToast('Settings saved and applied successfully.', 'success');
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all data to the demo seed?")) {
      resetToDemo();
      localStorage.removeItem('bloompro_settings_storeName');
      localStorage.removeItem('bloompro_settings_email');
      localStorage.removeItem('bloompro_settings_phone');
      localStorage.removeItem('bloompro_settings_taxDeliv');
      localStorage.removeItem('bloompro_settings_theme');
      setStoreName('BloomPro Studio');
      setEmail('hello@bloompro.com');
      setPhone('1-800-BLOOMS');
      setTaxDeliv(true);
      setTheme('Premium Sage (Default)');
      addToast('Data reset to demo defaults and local settings cleared.', 'info');
    }
  };

  return (
    <form onSubmit={handleSave} className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Manage business profile, taxes, and system preferences.</p>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={handleReset}>Reset Demo Data</Button>
          <Button type="submit"><Save size={16} style={{marginRight: '0.5rem'}}/> Save Changes</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>
              <Building2 size={20} /> Business Profile
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Store Name</label>
                <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className={styles.searchInput} style={{ width: '100%' }} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Contact Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.searchInput} style={{ width: '100%' }} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Support Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={styles.searchInput} style={{ width: '100%' }} required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>
              <Receipt size={20} /> Checkout & Taxes
            </div>
          </CardHeader>
          <CardContent>
             <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Tax calculation is currently destination-based via the Recipient State logic.</p>
             <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input type="checkbox" id="taxDeliv" checked={taxDeliv} onChange={(e) => setTaxDeliv(e.target.checked)} />
                <label htmlFor="taxDeliv" style={{ cursor: 'pointer', userSelect: 'none' }}>Apply sales tax to delivery fees where applicable</label>
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>
              <Palette size={20} /> Storefront Theme
            </div>
          </CardHeader>
          <CardContent>
             <div style={{ display: 'flex', gap: '1rem' }}>
                <select className={styles.searchInput} value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option value="Premium Sage (Default)">Premium Sage (Default)</option>
                  <option value="Midnight Floral">Midnight Floral</option>
                  <option value="Classic White">Classic White</option>
                </select>
             </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
};
