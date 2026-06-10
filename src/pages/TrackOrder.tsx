import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Search, MapPin, Calendar, CheckCircle2, ArrowRight } from 'lucide-react';
import styles from './TrackOrder.module.css';

interface TimelineStep {
  status: string;
  label: string;
  timestamp: string;
}

interface TrackingData {
  orderNumber: string;
  status: string;
  deliveryDate: string;
  recipientFirstName: string;
  city: string;
  state: string;
  itemsSummary: string;
  timeline: TimelineStep[];
  updatedAt?: string;
}

export const TrackOrder: React.FC = () => {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !email.trim()) return;

    setIsLoading(true);
    setError(null);
    setTrackingData(null);

    try {
      const orderNumberNormalized = orderNumber.toLowerCase().trim();
      const emailNormalized = email.toLowerCase().trim();
      const lookupId = `${orderNumberNormalized}_${emailNormalized}`;

      // Query the sanitized public tracking collection directly
      const docRef = doc(db, 'publicOrderTracking', lookupId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setTrackingData(docSnap.data() as TrackingData);
      } else {
        setError("No order matches this Order Number and Sender Email combination. Please check your credentials.");
      }
    } catch (err) {
      console.error("Tracking lookup failed:", err);
      setError("An error occurred while fetching tracking details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const trackingSteps = [
    { key: 'placed', label: 'Placed', desc: 'Order received and confirmed' },
    { key: 'preparing', label: 'In Design', desc: 'Florists are selecting and arranging stems' },
    { key: 'ready', label: 'Ready', desc: 'Bouquet completed and quality checked' },
    { key: 'out_for_delivery', label: 'In Transit', desc: 'Assigned to courier route' },
    { key: 'delivered', label: 'Delivered', desc: 'Successfully hand-delivered to recipient' }
  ];

  const getStepIndex = (status: string) => {
    return trackingSteps.findIndex(s => s.key === status);
  };

  const activeIndex = trackingData ? getStepIndex(trackingData.status) : -1;

  return (
    <div className={styles.trackPage}>
      <div className={styles.container}>
        <div className={styles.intro}>
          <h1 className={styles.pageTitle}>Track Your Order</h1>
          <p className={styles.pageSubtitle}>
            Enter your order details below to view delivery progress, dispatch schedules, and arrangements status.
          </p>
        </div>

        <div className={styles.workspace}>
          {/* Lookup Card */}
          <Card className={styles.formCard}>
            <form onSubmit={handleTrack}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Order Number *</label>
                <input 
                  type="text" 
                  placeholder="e.g. BLM-12345" 
                  value={orderNumber} 
                  onChange={(e) => setOrderNumber(e.target.value)} 
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Sender's Email Address *</label>
                <input 
                  type="email" 
                  placeholder="e.g. customer@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className={styles.input}
                  required
                />
              </div>

              {error && <div className={styles.errorAlert}>{error}</div>}

              <Button 
                type="submit" 
                fullWidth 
                isLoading={isLoading}
                style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', padding: '0.8rem' }}
              >
                <Search size={16} style={{ marginRight: '0.35rem' }} /> Track Order
              </Button>
            </form>
          </Card>

          {/* Results Area */}
          {trackingData && (
            <Card className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <div>
                  <span className={styles.orderLabel}>Order Status</span>
                  <h2>{trackingData.orderNumber}</h2>
                </div>
                <div className={`${styles.statusPill} ${styles[`status-${trackingData.status}`]}`}>
                  {trackingData.status.toUpperCase().replace('_', ' ')}
                </div>
              </div>

              <div className={styles.metadataGrid}>
                <div className={styles.metaItem}>
                  <MapPin size={18} className={styles.metaIcon} />
                  <div>
                    <h4>Destination</h4>
                    <p>{trackingData.recipientFirstName}'s residence — {trackingData.city}, {trackingData.state}</p>
                  </div>
                </div>
                <div className={styles.metaItem}>
                  <Calendar size={18} className={styles.metaIcon} />
                  <div>
                    <h4>Delivery Date</h4>
                    <p>{new Date(trackingData.deliveryDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              <div className={styles.itemsSummaryBlock}>
                <h4>Arrangements</h4>
                <p>{trackingData.itemsSummary}</p>
              </div>

              {/* Progress Timeline */}
              <div className={styles.timelineSection}>
                <h3>Delivery Progress Timeline</h3>
                
                <div className={styles.timelineSteps}>
                  {trackingSteps.map((step, idx) => {
                    const isCompleted = idx <= activeIndex;
                    const isCurrent = idx === activeIndex;
                    const matchedTimelineRecord = trackingData.timeline.find(t => t.status === step.key);
                    const timestamp = matchedTimelineRecord ? new Date(matchedTimelineRecord.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null;

                    return (
                      <div key={step.key} className={`${styles.timelineStep} ${isCompleted ? styles.completed : ''} ${isCurrent ? styles.current : ''}`}>
                        <div className={styles.stepIndicator}>
                          <div className={styles.circle}>
                            {isCompleted ? <CheckCircle2 size={18} /> : <div className={styles.dot}></div>}
                          </div>
                          {idx < trackingSteps.length - 1 && <div className={styles.line}></div>}
                        </div>
                        <div className={styles.stepContent}>
                          <div className={styles.stepHeader}>
                            <h4 className={styles.stepLabel}>{step.label}</h4>
                            {timestamp && <span className={styles.stepTime}>{timestamp}</span>}
                          </div>
                          <p className={styles.stepDesc}>{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.resultActions}>
                <Button variant="ghost" onClick={() => navigate('/shop')} style={{ color: '#4A6B50', fontSize: '0.875rem' }}>
                  Return to Store <ArrowRight size={14} style={{ marginLeft: '0.25rem' }} />
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
