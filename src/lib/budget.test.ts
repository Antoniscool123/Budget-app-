import { describe, expect, it } from 'vitest';
import type { AppState, Transaction } from '../types';
import { budgetForMonth, createInitialState, DEFAULT_BUDGET } from './storage';
import { summarizeMonth, suggestDistribution, sumAmount, transactionsInMonth } from './budget';
import { addMonths, currentMonthKey, daysInMonth, daysLeftInMonth, monthProgress } from './dates';
import { createDemoState } from './demo';
import { formatMoney, parseAmountString } from './format';

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    amount: 100,
    date: `${currentMonthKey()}-05`,
    merchant: 'Netto',
    category: 'dagligvarer',
    source: 'manual',
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

function stateWith(transactions: Transaction[], budgets: AppState['budgets'] = {}): AppState {
  return { ...createInitialState(), transactions, budgets };
}

describe('månedslogik', () => {
  it('regner dage og fremdrift ud for en måned', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-11')).toBe(30);
    expect(isNaN(monthProgress('2026-11'))).toBe(false);
    expect(daysLeftInMonth('2020-01')).toBe(0);
    expect(monthProgress('2020-01')).toBe(1);
  });

  it('kan gå frem og tilbage mellem måneder', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });
});

describe('budgetForMonth', () => {
  it('bruger standardbudgettet når intet er sat', () => {
    const state = createInitialState();
    expect(budgetForMonth(state, '2026-11')).toEqual(DEFAULT_BUDGET);
  });

  it('arver det seneste tidligere budget', () => {
    const state = stateWith([], { '2026-09': { total: 7000, categories: {} } });
    expect(budgetForMonth(state, '2026-11').total).toBe(7000);
  });

  it('foretrækker budgettet for den valgte måned', () => {
    const state = stateWith([], {
      '2026-09': { total: 7000, categories: {} },
      '2026-11': { total: 12000, categories: {} },
    });
    expect(budgetForMonth(state, '2026-11').total).toBe(12000);
  });
});

describe('summarizeMonth', () => {
  it('opsummerer forbrug, restbeløb og kategorier', () => {
    const month = '2026-05';
    const state = stateWith(
      [
        txn({ date: `${month}-02`, amount: 250, category: 'dagligvarer' }),
        txn({ date: `${month}-04`, amount: 150, category: 'restaurant', merchant: 'Café' }),
        txn({ date: '2026-04-29', amount: 999, category: 'shopping' }),
      ],
      { [month]: { total: 1000, categories: { dagligvarer: 500, restaurant: 200 } } },
    );

    const summary = summarizeMonth(state, month);
    expect(summary.spent).toBe(400);
    expect(summary.remaining).toBe(600);
    expect(summary.ratio).toBeCloseTo(0.4, 5);
    expect(summary.count).toBe(2);
    expect(summary.projected).toBe(400);
    expect(summary.categories[0].category.id).toBe('dagligvarer');
    expect(summary.categories[0].limit).toBe(500);
    expect(summary.largest?.amount).toBe(250);
  });

  it('markerer at budgettet er overskredet', () => {
    const month = '2026-05';
    const state = stateWith([txn({ date: `${month}-03`, amount: 1500 })], {
      [month]: { total: 1000, categories: {} },
    });
    const summary = summarizeMonth(state, month);
    expect(summary.remaining).toBe(-500);
    expect(summary.ratio).toBeGreaterThan(1);
  });
});

describe('hjælpefunktioner', () => {
  it('summerer og filtrerer transaktioner pr. måned', () => {
    const list = [
      txn({ date: '2026-05-01', amount: 10 }),
      txn({ date: '2026-05-31', amount: 20 }),
      txn({ date: '2026-06-01', amount: 30 }),
    ];
    expect(transactionsInMonth(list, '2026-05')).toHaveLength(2);
    expect(sumAmount(list)).toBe(60);
  });

  it('fordeler et budget uden at miste kroner', () => {
    const distribution = suggestDistribution(10000);
    const total = Object.values(distribution).reduce((sum, value) => sum + (value ?? 0), 0);
    expect(total).toBe(10000);
  });

  it('formaterer danske kroner', () => {
    expect(formatMoney(1234.5, 'DKK')).toContain('1.234,50');
    expect(parseAmountString('1.234,50')).toBe(1234.5);
  });
});

describe('eksempeldata', () => {
  it('laver realistiske data med budget for indeværende måned', () => {
    const demo = createDemoState();
    expect(demo.transactions.length).toBeGreaterThan(20);
    const summary = summarizeMonth(demo, currentMonthKey());
    expect(summary.budget.total).toBeGreaterThan(0);
    expect(summary.spent).toBeGreaterThan(0);
    expect(summary.categories.length).toBeGreaterThan(2);
  });
});
