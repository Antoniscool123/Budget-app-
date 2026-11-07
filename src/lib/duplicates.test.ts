import { describe, expect, it } from 'vitest';
import { findDuplicate } from './duplicates';
import type { Transaction } from '../types';

const txn = (partial: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  amount: 165.25,
  date: '2026-11-04',
  merchant: 'Netto',
  category: 'dagligvarer',
  source: 'scan',
  createdAt: new Date().toISOString(),
  ...partial,
});

describe('findDuplicate', () => {
  const existing = [txn({})];

  it('finder samme butik og beløb inden for få dage', () => {
    expect(findDuplicate(existing, { amount: 165.25, merchant: 'netto', date: '2026-11-05' })).toBeDefined();
    expect(findDuplicate(existing, { amount: 165.25, merchant: 'NETTO', date: '2026-11-02' })).toBeDefined();
  });

  it('ignorerer andre beløb, butikker og for lang tidsafstand', () => {
    expect(findDuplicate(existing, { amount: 165.3, merchant: 'Netto', date: '2026-11-04' })).toBeUndefined();
    expect(findDuplicate(existing, { amount: 165.25, merchant: 'REMA 1000', date: '2026-11-04' })).toBeUndefined();
    expect(findDuplicate(existing, { amount: 165.25, merchant: 'Netto', date: '2026-11-10' })).toBeUndefined();
  });
});
