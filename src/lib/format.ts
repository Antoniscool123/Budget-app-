import type { Settings } from '../types';

const CURRENCY_STEPS: Record<Settings['currency'], number> = {
  DKK: 1,
  EUR: 7.46,
  SEK: 0.65,
  NOK: 0.64,
};

/**
 * Beløb gemmes altid i kroner. Ved visning omregnes de til den valuta
 * brugeren har valgt i indstillingerne.
 */
/** Omregner et kronebeløb til den valuta brugeren har valgt. */
export function convertAmount(amount: number, currency: Settings['currency'] = 'DKK'): number {
  return amount / CURRENCY_STEPS[currency];
}

export function formatMoney(amount: number, currency: Settings['currency'] = 'DKK', opts: { compact?: boolean } = {}): string {
  const value = convertAmount(amount, currency);
  const formatter = new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency,
    maximumFractionDigits: opts.compact ? 0 : 2,
    minimumFractionDigits: opts.compact ? 0 : 2,
  });
  return formatter.format(value).replace(/\u00a0/g, ' ');
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('da-DK', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/** "1.234,56" / "1 234,56" / "12,95" / "12.95" → 1234.56 */
export function parseAmountString(input: string): number | null {
  if (!input) return null;
  let s = input
    .replace(/\u00a0/g, ' ')
    .replace(/[^\d.,\-\s]/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!s) return null;

  const negative = s.startsWith('-');
  s = s.replace(/-/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    s = s.split(thousandSep).join('');
    s = s.replace(decimalSep, '.');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    if (decimals === 3 && s.length > 4) {
      // "1,234" tolkes som tusindtal
      s = s.replace(',', '');
    } else {
      s = s.replace(',', '.');
    }
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    if (decimals === 3 && s.length > 4) {
      s = s.split('.').join('');
    }
  }

  const parts = s.split('.');
  const normalized = parts.length > 2 ? `${parts.slice(0, -1).join('')}.${parts.at(-1)}` : s;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' }).format(date);
}

export function formatDateLong(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

export function formatRelativeDay(iso: string, today = new Date()): string {
  const d = new Date(`${iso}T12:00:00`);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'I dag';
  if (diff === 1) return 'I går';
  if (diff > 1 && diff < 7) return `${diff} dage siden`;
  return formatDateLong(iso);
}
