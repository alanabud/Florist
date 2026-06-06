import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ShoppingBag, TrendingUp, Truck, AlertTriangle } from 'lucide-react';
import styles from './Dashboard.module.css';

const stats = [
  { id: 1, name: "Today's Orders", value: '24', icon: ShoppingBag, change: '+12%', changeType: 'increase' },
  { id: 2, name: 'Revenue', value: '$1,240', icon: TrendingUp, change: '+5.4%', changeType: 'increase' },
  { id: 3, name: 'Pending Deliveries', value: '12', icon: Truck, change: '-2', changeType: 'decrease' },
  { id: 4, name: 'Low Stock Alerts', value: '3', icon: AlertTriangle, change: '+1', changeType: 'increase' },
];

export const Dashboard: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Welcome back, here's what's happening today.</p>
      </div>

      <div className={styles.statsGrid}>
        {stats.map((stat) => (
          <Card key={stat.id}>
            <CardContent className={styles.statContent}>
              <div className={styles.statInfo}>
                <p className={styles.statName}>{stat.name}</p>
                <p className={styles.statValue}>{stat.value}</p>
              </div>
              <div className={`${styles.statIconWrapper} ${styles[`icon-${stat.id}`]}`}>
                <stat.icon className={styles.statIcon} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={styles.mainGrid}>
        <Card className={styles.activityCard}>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.emptyState}>
              <p>No recent activity to show.</p>
            </div>
          </CardContent>
        </Card>

        <div className={styles.sideGrid}>
          <Card className={styles.aiCard}>
            <CardHeader>
              <CardTitle>AI Insights ✨</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className={styles.insightList}>
                <li className={styles.insightItem}>
                  <div className={styles.insightDot} style={{ backgroundColor: 'var(--color-warning)' }} />
                  <p>You are low on <strong>White Roses</strong>. Consider reordering from supplier.</p>
                </li>
                <li className={styles.insightItem}>
                  <div className={styles.insightDot} style={{ backgroundColor: 'var(--color-success)' }} />
                  <p><strong>Mother's Day</strong> products should be featured this week.</p>
                </li>
                <li className={styles.insightItem}>
                  <div className={styles.insightDot} style={{ backgroundColor: 'var(--color-sage-dark)' }} />
                  <p>Waste is higher than usual for <strong>Tulips</strong> this month.</p>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
