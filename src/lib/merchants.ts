import type { AppState, CategoryId, Transaction } from '../types';

/** Gør butiksnavne sammenlignelige: "REMA 1000 " og "Rema 1000" bliver ens. */
export function normalizeMerchant(name: string): string {
  return (name ?? '')
    .toLocaleLowerCase('da-DK')
    .replace(/[.,:;!?'"`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * Kategorien brugeren sidst har valgt for en butik. Det gør scanningen
 * klogere over tid: retter man Netto til "Dagligvarer" én gang, huskes det.
 */
export function rememberedCategory(state: AppState, merchant: string | undefined): CategoryId | undefined {
  if (!merchant) return undefined;
  const key = normalizeMerchant(merchant);
  if (!key) return undefined;
  return state.merchantCategories[key];
}

export interface MerchantSuggestion {
  merchant: string;
  category: CategoryId;
  count: number;
  lastAmount: number;
}

/** De butikker man bruger mest — bruges til hurtig tilføjelse. */
export function topMerchants(transactions: Transaction[], limit = 6): MerchantSuggestion[] {
  const map = new Map<string, MerchantSuggestion>();
  for (const txn of transactions) {
    const key = normalizeMerchant(txn.merchant);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastAmount = txn.amount;
    } else {
      map.set(key, { merchant: txn.merchant, category: txn.category, count: 1, lastAmount: txn.amount });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
