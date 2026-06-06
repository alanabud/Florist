import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Flower2 } from 'lucide-react';
import styles from './Login.module.css';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoWrapper}>
            <Flower2 className={styles.logoIcon} />
          </div>
          <h1 className={styles.title}>BloomPro Studio</h1>
          <p className={styles.subtitle}>Sign in to manage your floral business</p>
        </div>
        
        <form onSubmit={handleLogin} className={styles.form}>
          {error && <div className={styles.errorAlert}>{error}</div>}
          
          <Input 
            label="Email Address" 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <Input 
            label="Password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          
          <Button type="submit" fullWidth isLoading={isLoading} className={styles.submitBtn}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};
