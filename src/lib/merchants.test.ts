import { describe, expect, it } from 'vitest';
import { normalizeMerchant, rememberedCategory, topMerchants } from './merchants';
import { createInitialState } from './storage';
import type { Transaction } from '../types';

const txn = (partial: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  amount: 100,
  date: '2026-11-05',
  merchant: 'Netto',
  category: 'dagligvarer',
  source: 'manual',
  createdAt: new Date().toISOString(),
  ...partial,
});

describe('normalizeMerchant', () => {
  it('gør butiksnavne sammenlignelige', () => {
    expect(normalizeMerchant('  REMA 1000! ')).toBe('rema 1000');
    expect(normalizeMerchant('Netto')).toBe('netto');
    expect(normalizeMerchant('NETTO')).toBe('netto');
    expect(normalizeMerchant('')).toBe('');
  });
});

describe('rememberedCategory', () => {
  it('husker den kategori brugeren har valgt for en butik', () => {
    const state = createInitialState();
    expect(rememberedCategory(state, 'Netto')).toBeUndefined();

    state.merchantCategories.netto = 'shopping';
    expect(rememberedCategory(state, 'NETTO')).toBe('shopping');
    expect(rememberedCategory(state, undefined)).toBeUndefined();
  });
});

describe('topMerchants', () => {
  it('finder de butikker man bruger mest', () => {
    const list = [
      txn({ merchant: 'Netto' }),
      txn({ merchant: 'netto' }),
      txn({ merchant: 'Netto' }),
      txn({ merchant: 'REMA 1000', category: 'dagligvarer' }),
      txn({ merchant: 'Apotek', category: 'sundhed' }),
    ];
    const top = topMerchants(list, 2);
    expect(top).toHaveLength(2);
    expect(top[0].merchant.toLowerCase()).toBe('netto');
    expect(top[0].count).toBe(3);
  });
});
