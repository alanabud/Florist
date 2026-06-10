import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { signInWithGoogle, signInWithMicrosoft, getFriendlyErrorMessage, syncUserProfile } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Flower2, ArrowLeft } from 'lucide-react';
import styles from './Login.module.css';

// SVG Icons for buttons
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" className={styles.providerIcon}>
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 21 21" className={styles.providerIcon}>
    <path fill="#f35325" d="M1 1h9v9H1z"/>
    <path fill="#81bc06" d="M11 1h9v9h-9z"/>
    <path fill="#05a6f0" d="M1 11h9v9H1z"/>
    <path fill="#ffba08" d="M11 11h9v9h-9z"/>
  </svg>
);

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingMicrosoft, setIsLoadingMicrosoft] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const origin = location.state?.from?.pathname || '/admin';
      navigate(origin, { replace: true });
    }
  }, [user, navigate, location]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoadingEmail(true);

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await syncUserProfile(result.user);
      // Navigation is handled by useEffect
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleProviderLogin = async (provider: 'google' | 'microsoft') => {
    setError('');
    if (provider === 'google') setIsLoadingGoogle(true);
    if (provider === 'microsoft') setIsLoadingMicrosoft(true);

    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithMicrosoft();
      }
      // Navigation is handled by useEffect
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Sign-in failed.');
    } finally {
      if (provider === 'google') setIsLoadingGoogle(false);
      if (provider === 'microsoft') setIsLoadingMicrosoft(false);
    }
  };

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to Store
      </button>

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoWrapper}>
            <Flower2 className={styles.logoIcon} />
          </div>
          <h1 className={styles.title}>BloomPro Studio</h1>
          <p className={styles.subtitle}>Sign in to manage your floral business</p>
        </div>
        
        {error && <div className={styles.errorAlert}>{error}</div>}

        <div className={styles.providerGroup}>
          <Button 
            type="button" 
            variant="outline" 
            fullWidth 
            className={styles.providerBtn}
            onClick={() => handleProviderLogin('google')}
            isLoading={isLoadingGoogle}
            disabled={isLoadingEmail || isLoadingMicrosoft}
          >
            {!isLoadingGoogle && <GoogleIcon />}
            Continue with Google
          </Button>

          <Button 
            type="button" 
            variant="outline" 
            fullWidth 
            className={styles.providerBtn}
            onClick={() => handleProviderLogin('microsoft')}
            isLoading={isLoadingMicrosoft}
            disabled={isLoadingEmail || isLoadingGoogle}
          >
            {!isLoadingMicrosoft && <MicrosoftIcon />}
            Continue with Microsoft
          </Button>
        </div>

        <div className={styles.divider}>
          <span>or sign in with email</span>
        </div>
        
        <form onSubmit={handleEmailLogin} className={styles.form}>
          <Input 
            label="Email Address" 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            disabled={isLoadingEmail || isLoadingGoogle || isLoadingMicrosoft}
          />
          <Input 
            label="Password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            disabled={isLoadingEmail || isLoadingGoogle || isLoadingMicrosoft}
          />
          
          <div className={styles.forgotPassword}>
            <button type="button" onClick={() => alert("Password reset link sent (simulated)")}>
              Forgot your password?
            </button>
          </div>

          <Button 
            type="submit" 
            fullWidth 
            isLoading={isLoadingEmail} 
            className={styles.submitBtn}
            disabled={isLoadingGoogle || isLoadingMicrosoft}
          >
            Sign In
          </Button>
        </form>

      </div>
    </div>
  );
};
