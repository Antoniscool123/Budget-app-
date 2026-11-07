import type { RecurringExpense, Transaction } from '../types';
import { addMonths } from './dates';
import { normalizeMerchant } from './merchants';

/**
 * Finder udgifter der går igen hver måned — fx husleje, streaming og
 * medlemskaber — ud fra de seneste måneders historik.
 *
 * Kriterier: butikken skal optræde i mindst to måneder, beløbet skal være
 * nogenlunde stabilt, og den må ikke være brugt for ofte (så ryger
 * supermarkedsindkøb ud).
 */
export function detectRecurring(
  transactions: Transaction[],
  referenceMonth: string,
  monthsBack = 3,
): RecurringExpense[] {
  const months = Array.from({ length: monthsBack }, (_, index) => addMonths(referenceMonth, -index));
  const monthSet = new Set(months);

  const groups = new Map<string, Transaction[]>();
  for (const txn of transactions) {
    const month = txn.date.slice(0, 7);
    if (!monthSet.has(month)) continue;
    const key = normalizeMerchant(txn.merchant);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(txn);
    groups.set(key, list);
  }

  const maxOccurrences = Math.max(3, Math.ceil(monthsBack * 1.6));
  const result: RecurringExpense[] = [];

  for (const [key, list] of groups) {
    if (list.length < 2 || list.length > maxOccurrences) continue;

    const distinctMonths = [...new Set(list.map((txn) => txn.date.slice(0, 7)))];
    if (distinctMonths.length < 2) continue;

    const amounts = list.map((txn) => txn.amount).sort((a, b) => a - b);
    const min = amounts[0];
    const max = amounts[amounts.length - 1];
    if (min <= 0) continue;
    // Beløbet skal være stabilt (højst 25 % udsving mellem billigste og dyreste).
    if (max / min > 1.25) continue;

    const sum = amounts.reduce((total, amount) => total + amount, 0);
    const average = Math.round((sum / list.length) * 100) / 100;
    const latest = [...list].sort((a, b) => b.date.localeCompare(a.date))[0];

    result.push({
      key,
      merchant: latest.merchant,
      category: latest.category,
      averageAmount: average,
      months: distinctMonths.sort(),
      lastDate: latest.date,
      count: list.length,
    });
  }

  return result.sort((a, b) => b.averageAmount - a.averageAmount);
}

/** Samlet månedlig udgift for de faste poster. */
export function monthlyTotal(recurring: RecurringExpense[]): number {
  return Math.round(recurring.reduce((sum, item) => sum + item.averageAmount, 0) * 100) / 100;
}
