import type { ReactNode } from 'react';

interface ProgressRingProps {
  /** 0–1 (værdier over 1 vises som fuld ring) */
  value: number;
  size?: number;
  stroke?: number;
  tone?: 'good' | 'warn' | 'bad';
  children?: ReactNode;
  label?: string;
}

const TONES = {
  good: ['#2dd4bf', '#0ea5e9'],
  warn: ['#fbbf24', '#f97316'],
  bad: ['#fb7185', '#f43f5e'],
};

export function ProgressRing({ value, size = 148, stroke = 12, tone = 'good', children, label }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gradId = `ring-${tone}`;
  const [from, to] = TONES[tone];

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={label ?? `Budget brugt ${Math.round(clamped * 100)} %`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="ring-track"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="ring-content">{children}</div>
    </div>
  );
}
