import { formatMoney } from '../lib/format';
import { monthLabel } from '../lib/dates';
import type { Settings } from '../types';

interface TrendChartProps {
  months: string[];
  spent: Record<string, number>;
  budgets: Record<string, number>;
  currency: Settings['currency'];
  activeMonth: string;
  onSelect?: (month: string) => void;
}

export function TrendChart({ months, spent, budgets, currency, activeMonth, onSelect }: TrendChartProps) {
  const max = Math.max(
    1,
    ...months.map((month) => Math.max(spent[month] ?? 0, budgets[month] ?? 0)),
  );

  return (
    <div className="trend">
      <div className="trend-grid">
        {months.map((month) => {
          const spentValue = spent[month] ?? 0;
          const budgetValue = budgets[month] ?? 0;
          const over = budgetValue > 0 && spentValue > budgetValue;
          return (
            <button
              key={month}
              type="button"
              className={`trend-col ${month === activeMonth ? 'active' : ''}`}
              onClick={() => onSelect?.(month)}
              title={`${monthLabel(month)}: brugt ${formatMoney(spentValue, currency)}${
                budgetValue ? ` af ${formatMoney(budgetValue, currency)}` : ''
              }`}
            >
              <span className="trend-value">{Math.round(spentValue / 1000)}k</span>
              <span className="trend-track">
                <span
                  className={`trend-bar ${over ? 'over' : ''}`}
                  style={{ height: `${Math.max(2, (spentValue / max) * 100)}%` }}
                />
                {budgetValue > 0 && (
                  <span className="trend-budget" style={{ bottom: `${(budgetValue / max) * 100}%` }} />
                )}
              </span>
              <span className="trend-label">{monthLabel(month, 'short').replace(/ \d{4}/, '')}</span>
            </button>
          );
        })}
      </div>
      <div className="trend-legend">
        <span>
          <i className="dot teal" /> Forbrug
        </span>
        <span>
          <i className="dot dashed" /> Budget
        </span>
      </div>
    </div>
  );
}
