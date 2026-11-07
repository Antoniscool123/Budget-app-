import type { Tab, Transaction } from '../types';
import { useStore } from '../store/StoreProvider';
import { summarizeMonth, transactionsInMonth } from '../lib/budget';
import { detectRecurring, monthlyTotal } from '../lib/recurring';
import { formatMoney, formatPercent, formatRelativeDay } from '../lib/format';
import { currentMonthKey, monthLabel, monthProgress, todayISO } from '../lib/dates';
import { ProgressRing } from '../components/ui/ProgressRing';
import { CategoryChip, CategoryAvatar } from '../components/ui/CategoryChip';
import { ReceiptThumb } from '../components/ReceiptThumb';
import { Icon } from '../components/Icon';
import { getCategory } from '../data/categories';

interface DashboardProps {
  monthKey: string;
  onNavigate: (tab: Tab) => void;
  onOpenTransaction: (txn: Transaction) => void;
  onOpenBudget: () => void;
}

export function Dashboard({ monthKey, onNavigate, onOpenTransaction, onOpenBudget }: DashboardProps) {
  const { state, loadDemoData } = useStore();
  const currency = state.settings.currency;
  const summary = summarizeMonth(state, monthKey);
  const hasAnyData = state.transactions.length > 0;
  const isCurrent = monthKey === currentMonthKey();
  const budgetSet = summary.budget.total > 0;
  const usingDefaultBudget = Object.keys(state.budgets).length === 0;

  const tone: 'good' | 'warn' | 'bad' =
    summary.ratio > 1 ? 'bad' : summary.ratio > 0.85 || summary.pace === 'over' ? 'warn' : 'good';

  const spentPercent = summary.ratio;
  const topCategory = summary.categories.find((entry) => entry.spent > 0);
  const todaySpent = summary.transactions
    .filter((txn) => txn.date === todayISO())
    .reduce((sum, txn) => sum + txn.amount, 0);

  const recent = transactionsInMonth(state.transactions, monthKey).slice(0, 6);
  const recurring = hasAnyData ? detectRecurring(state.transactions, monthKey) : [];
  const recurringTotal = monthlyTotal(recurring);

  const paceText = (() => {
    if (!budgetSet) return 'Sæt dit månedlige beløb for at få et overblik over, hvor meget du kan bruge.';
    if (summary.remaining < 0) {
      return `Du er ${formatMoney(Math.abs(summary.remaining), currency)} over budgettet i ${monthLabel(monthKey).toLowerCase()}.`;
    }
    if (!isCurrent) {
      return `Du sluttede måneden med ${formatMoney(summary.remaining, currency)} tilbage.`;
    }
    if (summary.pace === 'over') {
      return `Du er ${formatMoney(Math.abs(summary.paceAmount), currency)} foran planen — sæt tempoet lidt ned.`;
    }
    if (summary.pace === 'under') {
      return `Du er ${formatMoney(Math.abs(summary.paceAmount), currency)} under planen. Flot!`;
    }
    return 'Du ligger præcis på planen for måneden.';
  })();

  return (
    <div className="stack">
      {!hasAnyData && (
        <section className="card onboard">
          <div className="onboard-copy">
            <span className="badge badge-accent">
              <Icon name="sparkles" size={14} /> Velkommen
            </span>
            <h2>Kom i gang på under et minut</h2>
            <p className="muted">
              Scan en kvittering og appen læser selv beløbet, datoen og butikken. Vi har startet med et
              standardbudget på {formatMoney(summary.budget.total, currency, { compact: true })} — ret det til dit eget, og se
              hvor meget du har tilbage hver dag.
            </p>
            <div className="onboard-actions">
              <button type="button" className="btn btn-primary" onClick={() => onNavigate('scan')}>
                <Icon name="scan" size={18} /> Scan første kvittering
              </button>
              <button type="button" className="btn btn-ghost" onClick={onOpenBudget}>
                <Icon name="target" size={18} /> Sæt månedsbudget
              </button>
              <button type="button" className="btn btn-ghost" onClick={loadDemoData}>
                <Icon name="sparkles" size={18} /> Se med eksempeldata
              </button>
            </div>
          </div>
        </section>
      )}

      <section className={`hero card ${tone}`}>
        <div className="hero-main">
          <div className="hero-copy">
            <p className="eyebrow">Tilbage i {monthLabel(monthKey).toLowerCase()}</p>
            <p className="hero-amount">
              {formatMoney(Math.max(summary.remaining, 0), currency, { compact: true })}
            </p>
            <p className="muted">
              {budgetSet ? `af ${formatMoney(summary.budget.total, currency, { compact: true })} budget` : 'intet budget sat endnu'}
              {summary.count > 0 && ` · ${summary.count} ${summary.count === 1 ? 'køb' : 'køb'}`}
            </p>

            <div className="hero-pills">
              <span className={`pill pill-${tone}`}>
                {budgetSet ? `${formatPercent(spentPercent)} brugt` : 'Ingen budget'}
              </span>
              {isCurrent && (
                <span className="pill">
                  <Icon name="clock" size={13} /> {summary.daysLeft} dage tilbage
                </span>
              )}
              {!isCurrent && (
                <span className="pill">
                  <Icon name="calendar" size={13} /> {summary.daysInMonth} dage
                </span>
              )}
              {usingDefaultBudget && <span className="pill">Standardbudget</span>}
            </div>
          </div>

          <ProgressRing value={budgetSet ? spentPercent : 0} tone={tone} label="Budget brugt">
            <strong>{budgetSet ? `${Math.round(spentPercent * 100)}%` : '–'}</strong>
            <span>brugt</span>
          </ProgressRing>
        </div>

        <div className="hero-stats">
          <div>
            <span className="stat-label">Brugt</span>
            <strong>{formatMoney(summary.spent, currency, { compact: true })}</strong>
          </div>
          <div>
            <span className="stat-label">{isCurrent ? 'Kan bruges pr. dag' : 'Gennemsnit pr. dag'}</span>
            <strong>
              {formatMoney(
                isCurrent ? Math.max(0, summary.dailyAllowance) : summary.averagePerDay,
                currency,
                { compact: true },
              )}
            </strong>
          </div>
          <div>
            <span className="stat-label">Forventet ved månedsslut</span>
            <strong className={summary.projectedOver > 0 && budgetSet ? 'text-bad' : ''}>
              {formatMoney(summary.projected, currency, { compact: true })}
            </strong>
          </div>
        </div>

        {isCurrent && budgetSet && summary.daysLeft > 0 && (
          <div className={`hero-daily ${summary.dailyAllowance < 0 ? 'bad' : ''}`}>
            <span className="hero-daily-icon" aria-hidden="true">
              <Icon name="clock" size={17} />
            </span>
            <span>
              Du kan bruge <strong>{formatMoney(Math.max(0, summary.dailyAllowance), currency, { compact: true })}</strong> om
              dagen de næste {summary.daysLeft} {summary.daysLeft === 1 ? 'dag' : 'dage'}
            </span>
          </div>
        )}

        <div className="budget-bar" aria-hidden="true">
          <div className="budget-bar-fill" style={{ width: `${Math.min(100, spentPercent * 100)}%` }} />
          <div
            className="budget-bar-pace"
            style={{ left: `${Math.min(100, monthProgress(monthKey) * 100)}%` }}
            title="Hvor langt måneden er"
          />
        </div>

        <div className="hero-foot">
          <p className="muted small">{paceText}</p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('scan')}>
              <Icon name="scan" size={16} /> Scan kvittering
            </button>
            {(!budgetSet || usingDefaultBudget) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenBudget}>
                Sæt dit budget
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mini-stats">
        <div className="card mini-stat">
          <span className="mini-icon teal">
            <Icon name="calendar" size={18} />
          </span>
          <div>
            <span className="stat-label">Brugt i dag</span>
            <strong>{formatMoney(todaySpent, currency, { compact: true })}</strong>
          </div>
        </div>
        <div className="card mini-stat">
          <span className="mini-icon amber">
            <Icon name="receipt" size={18} />
          </span>
          <div>
            <span className="stat-label">Største udgift</span>
            <strong>{summary.largest ? formatMoney(summary.largest.amount, currency, { compact: true }) : '–'}</strong>
            <span className="muted tiny">{summary.largest ? summary.largest.merchant : 'Ingen endnu'}</span>
          </div>
        </div>
        <div className="card mini-stat">
          <span className="mini-icon violet">
            <Icon name="tag" size={18} />
          </span>
          <div>
            <span className="stat-label">Mest brugt på</span>
            <strong>{topCategory ? topCategory.category.name : '–'}</strong>
            <span className="muted tiny">
              {topCategory ? formatMoney(topCategory.spent, currency, { compact: true }) : 'Ingen endnu'}
            </span>
          </div>
        </div>
      </section>

      {recurring.length >= 2 && (
        <section className="card">
          <header className="card-head">
            <div>
              <h3>Faste udgifter</h3>
              <p className="muted small">
                {recurring.length} udgifter går igen hver måned
                {budgetSet && ` — ca. ${formatPercent(recurringTotal / Math.max(1, summary.budget.total))} af budgettet`}
              </p>
            </div>
            <span className="badge badge-accent">{formatMoney(recurringTotal, currency, { compact: true })} / md.</span>
          </header>
          <ul className="recurring-list">
            {recurring.slice(0, 6).map((item) => (
              <li key={item.key}>
                <CategoryAvatar id={item.category} size={34} />
                <span className="recurring-info">
                  <strong>{item.merchant}</strong>
                  <span className="muted tiny">
                    {item.months.length} mdr. · sidst {formatRelativeDay(item.lastDate)}
                  </span>
                </span>
                <span className="txn-amount">{formatMoney(item.averageAmount, currency, { compact: true })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="dash-columns">
        <section className="card">
          <header className="card-head">
            <h3>Kategorier</h3>
            <button type="button" className="link-btn" onClick={onOpenBudget}>
              Rediger budget
            </button>
          </header>

          {summary.categories.length === 0 ? (
            <p className="muted small">Ingen udgifter registreret i {monthLabel(monthKey).toLowerCase()} endnu.</p>
          ) : (
            <ul className="category-list">
              {summary.categories.slice(0, 7).map((entry) => {
                const ratio = entry.limit ? entry.spent / entry.limit : 0;
                const over = entry.limit ? entry.spent > entry.limit : false;
                return (
                  <li key={entry.category.id}>
                    <div className="category-row">
                      <span className="category-name">
                        <span aria-hidden="true">{entry.category.emoji}</span> {entry.category.name}
                      </span>
                      <span className="category-amount">
                        <strong>{formatMoney(entry.spent, currency, { compact: true })}</strong>
                        {entry.limit ? (
                          <span className="muted tiny"> / {formatMoney(entry.limit, currency, { compact: true })}</span>
                        ) : (
                          <span className="muted tiny"> · {formatPercent(entry.spent / Math.max(1, summary.spent))}</span>
                        )}
                      </span>
                    </div>
                    <div className="bar">
                      <div
                        className={`bar-fill ${over ? 'over' : ''}`}
                        style={{
                          width: entry.limit
                            ? `${Math.min(100, ratio * 100)}%`
                            : `${Math.min(100, (entry.spent / Math.max(1, summary.spent)) * 100)}%`,
                          background: over ? undefined : entry.category.color,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="card-head">
            <h3>Seneste kvitteringer</h3>
            <button type="button" className="link-btn" onClick={() => onNavigate('historik')}>
              Se alle
            </button>
          </header>

          {recent.length === 0 ? (
            <p className="muted small">Der er ingen udgifter i denne måned.</p>
          ) : (
            <ul className="txn-list">
              {recent.map((txn) => (
                <li key={txn.id}>
                  <button type="button" className="txn-row" onClick={() => onOpenTransaction(txn)}>
                    <ReceiptThumb id={txn.id} category={txn.category} />
                    <span className="txn-info">
                      <span className="txn-merchant">{txn.merchant}</span>
                      <span className="txn-meta">
                        {formatRelativeDay(txn.date)} · {getCategory(txn.category).name}
                        {txn.source === 'scan' && <span className="scan-dot" title="Scannet kvittering" />}
                      </span>
                    </span>
                    <span className="txn-amount">−{formatMoney(txn.amount, currency, { compact: true })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card tip-card">
        <span className="mini-icon teal">
          <Icon name="sparkles" size={18} />
        </span>
        <div>
          <h3>Vidste du?</h3>
          <p className="muted small">
            Du kan tage et billede af kvitteringen direkte med kameraet. Alt sker på din egen enhed —
            billederne bliver aldrig sendt til en server.
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('scan')}>
          Prøv nu <Icon name="arrowRight" size={16} />
        </button>
      </section>

      {summary.categories.length > 0 && (
        <p className="footnote">
          <CategoryChip id={summary.categories[0].category.id} subtle /> er din største post i denne måned.
        </p>
      )}
    </div>
  );
}
