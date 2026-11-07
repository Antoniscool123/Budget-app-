import { describe, expect, it } from 'vitest';
import { buildInsights } from './insights';
import { createInitialState } from './storage';
import { addMonths, currentMonthKey } from './dates';
import type { AppState, Transaction } from '../types';

const month = currentMonthKey();
const previous = addMonths(month, -1);

function txn(date: string, amount: number, category: Transaction['category'] = 'dagligvarer'): Transaction {
  return {
    id: `${date}-${amount}-${Math.random().toString(36).slice(2)}`,
    amount,
    date,
    merchant: 'Netto',
    category,
    source: 'scan',
    createdAt: `${date}T10:00:00.000Z`,
  };
}

function baseState(): AppState {
  const state = createInitialState();
  state.budgets[month] = { total: 10000, categories: {} };
  state.settings.lastBackupAt = new Date().toISOString();
  return state;
}

describe('buildInsights', () => {
  it('giver en venlig opfordring når budgettet mangler', () => {
    const state = createInitialState();
    state.transactions = [txn(`${month}-02`, 100)];
    const insights = buildInsights(state, month);
    expect(insights.some((insight) => insight.id === 'budget-missing')).toBe(true);
  });

  it('advarer når forbruget ligger foran planen', () => {
    const state = baseState();
    // Måneden er kun delvist gået, men næsten hele budgettet er brugt.
    state.transactions = [txn(`${month}-01`, 4000), txn(`${month}-02`, 4000)];
    const insights = buildInsights(state, month);
    expect(insights.some((insight) => insight.id === 'pace-over' || insight.id === 'month-up')).toBe(true);
    expect(insights.length).toBeLessThanOrEqual(3);
  });

  it('fortæller når man bruger mindre end sidste måned', () => {
    const state = baseState();
    state.transactions = [txn(`${previous}-05`, 5000), txn(`${month}-05`, 1500)];
    const titles = buildInsights(state, month).map((insight) => insight.id);
    expect(titles).toContain('month-down');
  });

  it('fremhæver en kategori der er steget', () => {
    const state = baseState();
    state.transactions = [
      txn(`${previous}-05`, 600, 'restaurant'),
      txn(`${month}-05`, 1400, 'restaurant'),
    ];
    const insight = buildInsights(state, month).find((item) => item.id === 'spike-restaurant');
    expect(insight).toBeDefined();
    expect(insight?.detail).toContain('800');
  });

  it('minder om backup når der er meget at miste', () => {
    const state = baseState();
    state.settings.lastBackupAt = undefined;
    state.transactions = Array.from({ length: 9 }, (_, index) => txn(`${month}-0${(index % 8) + 1}`, 100 + index));
    expect(buildInsights(state, month).some((insight) => insight.id === 'backup')).toBe(true);
  });

  it('giver aldrig mere end tre indsigter', () => {
    const state = baseState();
    state.transactions = [
      txn(`${previous}-02`, 4000),
      txn(`${month}-02`, 6000),
      txn(`${month}-03`, 2000, 'restaurant'),
      txn(`${previous}-03`, 300, 'restaurant'),
    ];
    expect(buildInsights(state, month).length).toBeLessThanOrEqual(3);
  });
});
