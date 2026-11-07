import { useEffect, useMemo, useState } from 'react';
import type { CategoryId, MonthBudget } from '../types';
import { CATEGORIES } from '../data/categories';
import { useStore } from '../store/StoreProvider';
import { useToast } from '../store/ToastProvider';
import { summarizeMonth, suggestDistribution } from '../lib/budget';
import { formatMoney, formatNumber, parseAmountString } from '../lib/format';
import { addMonths, currentMonthKey, monthLabel } from '../lib/dates';
import { budgetForMonth } from '../lib/storage';
import { Icon } from '../components/Icon';

const PRESETS = [5000, 8000, 10000, 15000];
const MAX_TOTAL = 40000;

export function BudgetPage({ monthKey }: { monthKey: string }) {
  const { state, setBudget, applyBudgetToMonths } = useStore();
  const { showToast } = useToast();
  const currency = state.settings.currency;
  const summary = summarizeMonth(state, monthKey);
  const budget = summary.budget;

  const [totalInput, setTotalInput] = useState(String(budget.total));
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setTotalInput(String(budget.total));
    const next: Record<string, string> = {};
    for (const category of CATEGORIES) {
      next[category.id] = budget.categories[category.id] ? String(budget.categories[category.id]) : '';
    }
    setCategoryInputs(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, budget.total]);

  const commit = (next: MonthBudget) => {
    setBudget(monthKey, next);
  };

  const setTotal = (raw: string) => {
    setTotalInput(raw);
    const value = parseAmountString(raw) ?? 0;
    commit({ ...budget, total: Math.max(0, value) });
  };

  const stepTotal = (delta: number) => {
    const next = Math.max(0, budget.total + delta);
    setTotalInput(String(next));
    commit({ ...budget, total: next });
  };

  const applyToFuture = () => {
    const months = Array.from({ length: 6 }, (_, index) => addMonths(monthKey, index));
    applyBudgetToMonths(months, budget);
    showToast(`Budget anvendt på ${monthLabel(months[0], 'short')} – ${monthLabel(months[5], 'short')}`);
  };

  const applyPreset = (value: number) => {
    setTotalInput(String(value));
    const categories = suggestDistribution(value);
    const nextInputs: Record<string, string> = {};
    for (const category of CATEGORIES) {
      nextInputs[category.id] = categories[category.id] ? String(categories[category.id]) : '';
    }
    setCategoryInputs(nextInputs);
    commit({ total: value, categories });
    showToast(`Budget sat til ${formatMoney(value, currency, { compact: true })} og fordelt på kategorier`);
  };

  const setCategoryLimit = (id: CategoryId, raw: string) => {
    setCategoryInputs((prev) => ({ ...prev, [id]: raw }));
    const value = Math.max(0, parseAmountString(raw) ?? 0);
    const categories = { ...budget.categories };
    if (value > 0) categories[id] = value;
    else delete categories[id];
    commit({ ...budget, categories });
  };

  const sumCategoryLimits = useMemo(
    () => Object.values(budget.categories).reduce((sum, value) => sum + (value || 0), 0),
    [budget.categories],
  );

  const leftover = budget.total - sumCategoryLimits;
  const previousMonth = addMonths(monthKey, -1);
  const previousBudget = state.budgets[previousMonth];
  const isCurrent = monthKey === currentMonthKey();

  const copyPrevious = () => {
    const source = previousBudget ?? budgetForMonth(state, previousMonth);
    if (!source) return;
    commit({ total: source.total, categories: { ...source.categories } });
    setTotalInput(String(source.total));
    const next: Record<string, string> = {};
    for (const category of CATEGORIES) {
      next[category.id] = source.categories[category.id] ? String(source.categories[category.id]) : '';
    }
    setCategoryInputs(next);
    showToast(`Kopierede budgettet fra ${monthLabel(previousMonth).toLowerCase()}`);
  };

  return (
    <div className="budget-page">
      <section className="card budget-total-card">
        <div className="budget-total-head">
          <div>
            <p className="eyebrow">Månedligt beløb · {monthLabel(monthKey).toLowerCase()}</p>
            <p className="muted small">
              Det beløb du må bruge i alt. Resten af appen regner ud, hvad du kan bruge pr. dag.
            </p>
          </div>
          <span className="badge">
            <Icon name="target" size={14} /> {isCurrent ? 'Denne måned' : monthLabel(monthKey, 'short')}
          </span>
        </div>

        <div className="budget-input">
          <span className="currency">kr</span>
          <input
            inputMode="decimal"
            value={totalInput}
            onChange={(event) => setTotal(event.target.value)}
            aria-label="Månedligt budget"
          />
        </div>

        <input
          className="range"
          type="range"
          min={0}
          max={MAX_TOTAL}
          step={100}
          value={Math.min(budget.total, MAX_TOTAL)}
          onChange={(event) => setTotal(event.target.value)}
          aria-label="Justér budget"
        />
        <div className="row-between tiny muted">
          <span>0 kr</span>
          <span>{formatNumber(MAX_TOTAL)} kr</span>
        </div>

        <div className="step-buttons" role="group" aria-label="Justér beløb">
          {[-500, -100, 100, 500].map((delta) => (
            <button key={delta} type="button" className="step-btn" onClick={() => stepTotal(delta)}>
              {delta > 0 ? '+' : '−'}
              {formatNumber(Math.abs(delta))}
            </button>
          ))}
          <button type="button" className="step-btn wide" onClick={applyToFuture}>
            <Icon name="copy" size={14} /> Brug også de næste 6 måneder
          </button>
        </div>

        <div className="preset-row">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`preset ${budget.total === preset ? 'active' : ''}`}
              onClick={() => applyPreset(preset)}
            >
              {formatNumber(preset)} kr
            </button>
          ))}
          <button type="button" className="preset" onClick={() => applyPreset(budget.total)}>
            <Icon name="sparkles" size={14} /> Fordel automatisk
          </button>
        </div>

        <div className="budget-summary-row">
          <div>
            <span className="stat-label">Brugt indtil nu</span>
            <strong>{formatMoney(summary.spent, currency)}</strong>
          </div>
          <div>
            <span className="stat-label">Tilbage</span>
            <strong className={summary.remaining < 0 ? 'text-bad' : 'text-good'}>
              {formatMoney(summary.remaining, currency)}
            </strong>
          </div>
          <div>
            <span className="stat-label">{isCurrent ? 'Pr. dag resten af måneden' : 'Pr. dag i måneden'}</span>
            <strong>
              {formatMoney(isCurrent ? Math.max(0, summary.dailyAllowance) : summary.spent / summary.daysInMonth, currency)}
            </strong>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h3>Kategoribudgetter</h3>
            <p className="muted small">Valgfrit — sæt lofter på de poster du vil holde styr på.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyPrevious}>
            <Icon name="copy" size={15} /> Kopiér fra {monthLabel(previousMonth, 'short')}
          </button>
        </header>

        <div className={`budget-diff ${leftover < 0 ? 'bad' : leftover === 0 ? 'good' : ''}`}>
          <Icon name={leftover < 0 ? 'alert' : 'check'} size={16} />
          {leftover < 0
            ? `Kategorierne overstiger månedsbeløbet med ${formatMoney(Math.abs(leftover), currency)}`
            : leftover === 0
              ? 'Kategorierne udgør præcis hele månedsbeløbet'
              : `${formatMoney(leftover, currency)} af månedsbeløbet er ikke fordelt på kategorier`}
        </div>

        <ul className="budget-category-list">
          {CATEGORIES.map((category) => {
            const limit = budget.categories[category.id] ?? 0;
            const spentEntry = summary.categories.find((entry) => entry.category.id === category.id);
            const spent = spentEntry?.spent ?? 0;
            const ratio = limit > 0 ? spent / limit : 0;
            const over = limit > 0 && spent > limit;

            return (
              <li key={category.id}>
                <div className="budget-category-row">
                  <span
                    className="category-avatar"
                    style={{
                      background: `color-mix(in srgb, ${category.color} 16%, transparent)`,
                      color: category.color,
                    }}
                    aria-hidden="true"
                  >
                    {category.emoji}
                  </span>
                  <div className="budget-category-info">
                    <span className="budget-category-name">{category.name}</span>
                    <span className="muted tiny">
                      Brugt {formatMoney(spent, currency)}
                      {limit > 0 && ` af ${formatMoney(limit, currency)}`}
                    </span>
                    {limit > 0 && (
                      <div className="bar">
                        <div
                          className={`bar-fill ${over ? 'over' : ''}`}
                          style={{ width: `${Math.min(100, ratio * 100)}%`, background: over ? undefined : category.color }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="budget-category-input">
                    <input
                      inputMode="decimal"
                      value={categoryInputs[category.id] ?? ''}
                      placeholder="–"
                      onChange={(event) => setCategoryLimit(category.id, event.target.value)}
                      aria-label={`Budget for ${category.name}`}
                    />
                    <span className="muted tiny">kr</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card tip-card">
        <span className="mini-icon teal">
          <Icon name="sparkles" size={18} />
        </span>
        <div>
          <h3>Et godt udgangspunkt</h3>
          <p className="muted small">
            Mange danskere bruger omkring 30 % af deres rådighedsbeløb på dagligvarer, 25 % på bolig og
            10 % på transport. Tryk <strong>Fordel automatisk</strong> for at få et forslag, du kan justere.
          </p>
        </div>
      </section>
    </div>
  );
}
