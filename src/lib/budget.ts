import type { Category, CategoryId, MonthBudget, Transaction } from '../types';
import { CATEGORIES, getCategory } from '../data/categories';
import { budgetForMonth } from './storage';
import { daysInMonth, daysLeftInMonth, monthProgress } from './dates';
import type { AppState } from '../types';

export function transactionsInMonth(transactions: Transaction[], monthKey: string): Transaction[] {
  return transactions
    .filter((txn) => txn.date.startsWith(monthKey))
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

export function sumAmount(transactions: Transaction[]): number {
  return Math.round(transactions.reduce((sum, txn) => sum + txn.amount, 0) * 100) / 100;
}

export interface CategorySpend {
  category: Category;
  spent: number;
  limit?: number;
  /** 0–1+ */
  ratio: number;
  count: number;
}

export interface MonthSummary {
  monthKey: string;
  budget: MonthBudget;
  spent: number;
  remaining: number;
  /** 0–1+ af budgettet brugt */
  ratio: number;
  daysInMonth: number;
  daysLeft: number;
  /** Hvad man kan bruge pr. dag resten af måneden */
  dailyAllowance: number;
  /** Forventet forbrug ved månedens udgang, hvis takten fortsætter */
  projected: number;
  /** Forventet forbrug minus budget (positiv = over budget) */
  projectedOver: number;
  /** Er man foran/i rute ift. hvor langt måneden er? */
  pace: 'under' | 'onTrack' | 'over';
  /** Hvor meget man er foran/ bagud i kroner ift. den lineære takt */
  paceAmount: number;
  count: number;
  categories: CategorySpend[];
  transactions: Transaction[];
  averagePerDay: number;
  largest?: Transaction;
}

export function summarizeMonth(state: AppState, monthKey: string): MonthSummary {
  const budget = budgetForMonth(state, monthKey);
  const transactions = transactionsInMonth(state.transactions, monthKey);
  const spent = sumAmount(transactions);
  const total = budget.total > 0 ? budget.total : 0;
  const ratio = total > 0 ? spent / total : spent > 0 ? 1 : 0;
  const days = daysInMonth(monthKey);
  const left = daysLeftInMonth(monthKey);
  const progress = monthProgress(monthKey);
  const elapsedDays = Math.max(1, Math.round(days * progress));

  const remaining = Math.round((total - spent) * 100) / 100;
  const dailyAllowance = left > 0 ? remaining / left : remaining;
  const projected = Math.round((spent / elapsedDays) * days * 100) / 100;
  const expectedSoFar = total * progress;
  const paceAmount = Math.round((spent - expectedSoFar) * 100) / 100;

  const byCategory = new Map<CategoryId, { spent: number; count: number }>();
  for (const txn of transactions) {
    const entry = byCategory.get(txn.category) ?? { spent: 0, count: 0 };
    entry.spent += txn.amount;
    entry.count += 1;
    byCategory.set(txn.category, entry);
  }

  const categories: CategorySpend[] = CATEGORIES.map((category) => {
    const entry = byCategory.get(category.id);
    const limit = budget.categories[category.id] || undefined;
    const categorySpent = Math.round((entry?.spent ?? 0) * 100) / 100;
    return {
      category,
      spent: categorySpent,
      limit,
      ratio: limit ? categorySpent / limit : 0,
      count: entry?.count ?? 0,
    };
  })
    .filter((entry) => entry.spent > 0 || entry.limit)
    .sort((a, b) => b.spent - a.spent);

  const largest = [...transactions].sort((a, b) => b.amount - a.amount)[0];

  return {
    monthKey,
    budget,
    spent,
    remaining,
    ratio,
    daysInMonth: days,
    daysLeft: left,
    dailyAllowance,
    projected,
    projectedOver: Math.round((projected - total) * 100) / 100,
    pace: ratio > progress + 0.08 ? 'over' : ratio < progress - 0.08 ? 'under' : 'onTrack',
    paceAmount,
    count: transactions.length,
    categories,
    transactions,
    averagePerDay: Math.round((spent / elapsedDays) * 100) / 100,
    largest,
  };
}

export function categoryTotals(transactions: Transaction[]): Array<{ category: Category; spent: number; count: number }> {
  const map = new Map<CategoryId, { spent: number; count: number }>();
  for (const txn of transactions) {
    const entry = map.get(txn.category) ?? { spent: 0, count: 0 };
    entry.spent += txn.amount;
    entry.count += 1;
    map.set(txn.category, entry);
  }
  return [...map.entries()]
    .map(([id, value]) => ({ category: getCategory(id), spent: value.spent, count: value.count }))
    .sort((a, b) => b.spent - a.spent);
}

/** Fordeler et månedsbeløb på kategorier ud fra en klassisk 50/30/20-tankegang. */
export function suggestDistribution(total: number): Partial<Record<CategoryId, number>> {
  const weights: Array<[CategoryId, number]> = [
    ['dagligvarer', 0.3],
    ['bolig', 0.25],
    ['transport', 0.1],
    ['restaurant', 0.08],
    ['shopping', 0.08],
    ['fritid', 0.06],
    ['sundhed', 0.04],
    ['born', 0.05],
    ['rejser', 0.02],
    ['andet', 0.02],
  ];
  const result: Partial<Record<CategoryId, number>> = {};
  let assigned = 0;
  weights.forEach(([id, weight], index) => {
    const isLast = index === weights.length - 1;
    const value = isLast ? total - assigned : Math.round((total * weight) / 10) * 10;
    result[id] = Math.max(0, value);
    assigned += value;
  });
  return result;
}
