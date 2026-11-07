import { describe, expect, it } from 'vitest';
import { detectRecurring, monthlyTotal } from './recurring';
import { addMonths, currentMonthKey } from './dates';
import type { Transaction } from '../types';

const month = currentMonthKey();
const m1 = addMonths(month, -1);
const m2 = addMonths(month, -2);

const txn = (date: string, merchant: string, amount: number, category: Transaction['category'] = 'fritid'): Transaction => ({
  id: `${date}-${merchant}-${Math.random().toString(36).slice(2)}`,
  amount,
  date,
  merchant,
  category,
  source: 'manual',
  createdAt: new Date().toISOString(),
});

describe('detectRecurring', () => {
  it('finder faste udgifter med stabilt beløb', () => {
    const transactions = [
      txn(`${m2}-04`, 'Netflix', 129),
      txn(`${m1}-04`, 'Netflix', 129),
      txn(`${month}-04`, 'Netflix', 129),
      txn(`${m2}-01`, 'Husleje', 6200, 'bolig'),
      txn(`${m1}-01`, 'Husleje', 6200, 'bolig'),
      txn(`${month}-01`, 'Husleje', 6300, 'bolig'),
    ];

    const recurring = detectRecurring(transactions, month);
    const merchants = recurring.map((item) => item.merchant);
    expect(merchants).toContain('Netflix');
    expect(merchants).toContain('Husleje');
    expect(recurring[0].merchant).toBe('Husleje');
    expect(monthlyTotal(recurring)).toBeCloseTo(6362.33, 1);
  });

  it('ignorerer variable dagligvarer og enkeltstående køb', () => {
    const transactions = [
      txn(`${m2}-04`, 'Netto', 180, 'dagligvarer'),
      txn(`${m1}-04`, 'Netto', 420, 'dagligvarer'),
      txn(`${month}-04`, 'Netto', 260, 'dagligvarer'),
      txn(`${month}-09`, 'Elgiganten', 2499, 'shopping'),
    ];
    expect(detectRecurring(transactions, month)).toHaveLength(0);
  });

  it('kræver at udgiften er set i mindst to måneder', () => {
    const transactions = [txn(`${month}-04`, 'Spotify', 109), txn(`${month}-18`, 'Spotify', 109)];
    expect(detectRecurring(transactions, month)).toHaveLength(0);
  });
});
