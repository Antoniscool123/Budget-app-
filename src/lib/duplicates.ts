import type { Transaction } from '../types';
import { normalizeMerchant } from './merchants';

export interface DuplicateCandidate {
  amount: number;
  merchant: string;
  date: string;
}

/**
 * Finder en udgift der ligner den man er ved at gemme: samme butik, samme
 * beløb og inden for få dage. Det fanger typisk en kvittering der er scannet
 * to gange.
 */
export function findDuplicate(
  transactions: Transaction[],
  candidate: DuplicateCandidate,
  toleranceDays = 2,
): Transaction | undefined {
  const key = normalizeMerchant(candidate.merchant);
  if (!key || !candidate.amount) return undefined;

  const target = new Date(`${candidate.date}T12:00:00`).getTime();
  if (Number.isNaN(target)) return undefined;

  return transactions.find((txn) => {
    if (normalizeMerchant(txn.merchant) !== key) return false;
    if (Math.abs(txn.amount - candidate.amount) > 0.01) return false;
    const time = new Date(`${txn.date}T12:00:00`).getTime();
    if (Number.isNaN(time)) return false;
    return Math.abs(time - target) / 86400000 <= toleranceDays;
  });
}
