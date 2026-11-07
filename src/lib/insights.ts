import type { AppState, Tab } from '../types';
import { addMonths, monthLabel, monthProgress } from './dates';
import { summarizeMonth } from './budget';
import { detectRecurring, monthlyTotal } from './recurring';
import { formatMoney, formatPercent } from './format';
import type { IconName } from '../components/Icon';

export type InsightTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface Insight {
  id: string;
  tone: InsightTone;
  icon: IconName;
  title: string;
  detail: string;
  action?: { label: string; tab?: Tab; settings?: boolean };
}

const MAX_INSIGHTS = 3;
const DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromISO: string, to = Date.now()): number {
  const from = new Date(`${fromISO}T12:00:00`).getTime();
  return Math.round((to - from) / DAY);
}

/**
 * Laver korte, handlingsorienterede indsigter ud fra data.
 * Rækkefølgen er prioriteret: først tempo og budget, så sammenligning,
 * derefter vaner og til sidst tryghed (backup).
 */
export function buildInsights(state: AppState, monthKey: string): Insight[] {
  const summary = summarizeMonth(state, monthKey);
  const currency = state.settings.currency;
  const insights: Insight[] = [];
  const progress = monthProgress(monthKey);
  const budgetSet = summary.budget.total > 0 && Object.keys(state.budgets).length > 0;

  const previous = summarizeMonth(state, addMonths(monthKey, -1));
  const previousLabel = monthLabel(addMonths(monthKey, -1)).toLowerCase();

  // 1. Mangler der et budget?
  if (!budgetSet) {
    insights.push({
      id: 'budget-missing',
      tone: 'neutral',
      icon: 'target',
      title: 'Sæt dit månedsbeløb',
      detail: 'Så snart du har sat et beløb, regner appen ud, hvad du kan bruge hver dag.',
      action: { label: 'Sæt budget', tab: 'budget' },
    });
  } else if (summary.count > 0) {
    // 2. Tempo i forhold til hvor langt måneden er.
    const gap = summary.ratio - progress;
    if (gap > 0.12) {
      insights.push({
        id: 'pace-over',
        tone: 'warn',
        icon: 'alert',
        title: 'Du bruger hurtigere end planen',
        detail: `Du har brugt ${formatPercent(summary.ratio)} af budgettet, men måneden er kun ${formatPercent(progress)} gået.`,
        action: { label: 'Se historik', tab: 'historik' },
      });
    } else if (gap < -0.15 && summary.remaining > 0) {
      insights.push({
        id: 'pace-under',
        tone: 'good',
        icon: 'check',
        title: 'Du er godt med',
        detail: `Du har ${formatMoney(summary.remaining, currency, { compact: true })} tilbage — mere end planen kræver lige nu.`,
      });
    }
  }

  // 3. Sammenligning med sidste måned.
  if (previous.spent > 200 && summary.spent > 0) {
    const diff = summary.spent - previous.spent;
    const ratio = diff / previous.spent;
    if (ratio > 0.15) {
      insights.push({
        id: 'month-up',
        tone: 'bad',
        icon: 'chart',
        title: `${formatPercent(ratio)} mere end i ${previousLabel}`,
        detail: `Det er ${formatMoney(diff, currency, { compact: true })} mere indtil videre.`,
        action: { label: 'Se historik', tab: 'historik' },
      });
    } else if (ratio < -0.1) {
      insights.push({
        id: 'month-down',
        tone: 'good',
        icon: 'chart',
        title: `${formatPercent(Math.abs(ratio))} mindre end i ${previousLabel}`,
        detail: `Du har brugt ${formatMoney(Math.abs(diff), currency, { compact: true })} mindre — bliv ved.`,
      });
    }
  }

  // 4. En enkelt kategori der er steget mærkbart.
  const spike = summary.categories
    .map((entry) => {
      const before = previous.categories.find((item) => item.category.id === entry.category.id)?.spent ?? 0;
      return { category: entry.category, spent: entry.spent, before, diff: entry.spent - before };
    })
    .filter((item) => item.before >= 150 && item.diff >= 250)
    .sort((a, b) => b.diff - a.diff)[0];

  if (spike) {
    insights.push({
      id: `spike-${spike.category.id}`,
      tone: 'warn',
      icon: 'tag',
      title: `${spike.category.name} er dyrere end sidst`,
      detail: `${formatMoney(spike.diff, currency, { compact: true })} mere end i ${previousLabel} (${formatMoney(
        spike.spent,
        currency,
        { compact: true },
      )} i alt).`,
      action: { label: 'Se kategorier', tab: 'budget' },
    });
  }

  // 5. Faste udgifter fylder en stor del af budgettet.
  const recurring = detectRecurring(state.transactions, monthKey);
  const recurringTotal = monthlyTotal(recurring);
  if (recurring.length >= 2 && budgetSet && recurringTotal / summary.budget.total >= 0.25) {
    const names = recurring
      .slice(0, 2)
      .map((item) => item.merchant)
      .join(' og ');
    insights.push({
      id: 'recurring-share',
      tone: 'neutral',
      icon: 'copy',
      title: `Faste udgifter fylder ${formatPercent(recurringTotal / summary.budget.total)} af budgettet`,
      detail: `${formatMoney(recurringTotal, currency, { compact: true })} om måneden — bl.a. ${names}.`,
    });
  }

  // 6. En stor kategori uden loft.
  const unlimited = summary.categories
    .filter((entry) => !entry.limit && summary.spent > 0 && entry.spent / summary.spent >= 0.4)
    .sort((a, b) => b.spent - a.spent)[0];

  if (unlimited) {
    insights.push({
      id: `unlimited-${unlimited.category.id}`,
      tone: 'neutral',
      icon: 'target',
      title: `Sæt et loft på ${unlimited.category.name.toLowerCase()}`,
      detail: `Det er din største post med ${formatMoney(unlimited.spent, currency, { compact: true })} — ${formatPercent(
        unlimited.spent / Math.max(1, summary.spent),
      )} af forbruget.`,
      action: { label: 'Sæt loft', tab: 'budget' },
    });
  }

  // 7. Backup-hjælp, hvis der er noget at miste.
  const lastBackup = state.settings.lastBackupAt;
  const backupAge = lastBackup ? daysBetween(lastBackup.slice(0, 10)) : undefined;
  if (state.transactions.length >= 8 && (backupAge === undefined || backupAge >= 30)) {
    insights.push({
      id: 'backup',
      tone: 'neutral',
      icon: 'shield',
      title: lastBackup ? 'Lav en frisk backup' : 'Lav din første backup',
      action: { label: 'Lav backup', settings: true },
      detail: lastBackup
        ? `Sidste backup var for ${backupAge} dage siden. En fil tager kun et øjeblik.`
        : 'Alt gemmes lokalt på enheden. En backup-fil beskytter dine data, hvis du skifter telefon.',
    });
  }

  return insights.slice(0, MAX_INSIGHTS);
}
