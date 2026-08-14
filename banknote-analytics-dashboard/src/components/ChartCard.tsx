import { ReactNode } from 'react';

interface Props {
  title: string;
  loading?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, loading, error, children, className = '' }: Props) {
  return (
    <div className={`chart-card ${className}`}>
      <h3>{title}</h3>
      {loading && <div className="loading">Loading…</div>}
      {error && !loading && <div className="error">{error}</div>}
      {!loading && !error && children}
    </div>
  );
}
