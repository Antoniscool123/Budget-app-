import { useMemo, useState } from 'react';
import type { CategoryId, Transaction } from '../types';
import { CATEGORIES, getCategory } from '../data/categories';
import { useStore } from '../store/StoreProvider';
import { summarizeMonth, transactionsInMonth } from '../lib/budget';
import { formatMoney, formatRelativeDay } from '../lib/format';
import { budgetForMonth } from '../lib/storage';
import { lastMonths, monthLabel } from '../lib/dates';
import { ReceiptThumb } from '../components/ReceiptThumb';
import { TrendChart } from '../components/TrendChart';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/Icon';
import { CategoryChip } from '../components/ui/CategoryChip';

interface HistoryPageProps {
  monthKey: string;
  onMonthChange: (month: string) => void;
  onOpenTransaction: (txn: Transaction) => void;
  onScan: () => void;
}

export function HistoryPage({ monthKey, onMonthChange, onOpenTransaction, onScan }: HistoryPageProps) {
  const { state } = useStore();
  const currency = state.settings.currency;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CategoryId | 'alle'>('alle');
  const [searchAll, setSearchAll] = useState(false);

  const summary = summarizeMonth(state, monthKey);
  const months = lastMonths(6);

  const spentByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const month of months) {
      map[month] = transactionsInMonth(state.transactions, month).reduce((sum, txn) => sum + txn.amount, 0);
    }
    return map;
  }, [months, state.transactions]);

  const budgetsByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const month of months) map[month] = budgetForMonth(state, month).total;
    return map;
  }, [months, state]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = searchAll
      ? [...state.transactions].sort((a, b) =>
          a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
        )
      : transactionsInMonth(state.transactions, monthKey);
    return source.filter((txn) => {
      if (filter !== 'alle' && txn.category !== filter) return false;
      if (!normalized) return true;
      const haystack = `${txn.merchant} ${txn.note ?? ''} ${getCategory(txn.category).name} ${
        txn.items?.map((item) => item.name).join(' ') ?? ''
      }`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [filter, monthKey, query, searchAll, state.transactions]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const txn of filtered) {
      const list = map.get(txn.date) ?? [];
      list.push(txn);
      map.set(txn.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const filteredTotal = filtered.reduce((sum, txn) => sum + txn.amount, 0);
  const usedCategories = CATEGORIES.filter(
    (category) => transactionsInMonth(state.transactions, monthKey).some((txn) => txn.category === category.id),
  );

  return (
    <div className="stack">
      <section className="card">
        <header className="card-head">
          <div>
            <h3>Udvikling de sidste 6 måneder</h3>
            <p className="muted small">Tryk på en måned for at se den.</p>
          </div>
          <span className="badge">{monthLabel(monthKey)}</span>
        </header>
        <TrendChart
          months={months}
          spent={spentByMonth}
          budgets={budgetsByMonth}
          currency={currency}
          activeMonth={monthKey}
          onSelect={onMonthChange}
        />
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h3>{searchAll ? 'Alle måneder' : 'Alle udgifter'}</h3>
            <p className="muted small">
              {searchAll
                ? `${filtered.length} ${filtered.length === 1 ? 'post' : 'poster'} i alt`
                : `${summary.count} ${summary.count === 1 ? 'post' : 'poster'} · ${formatMoney(
                    summary.spent,
                    currency,
                  )} i ${monthLabel(monthKey).toLowerCase()}`}
            </p>
          </div>
        </header>

        <div className="history-tools">
          <div className="history-search-row">
            <div className="search">
            <Icon name="search" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søg i butik, vare eller note"
              aria-label="Søg i udgifter"
            />
              {query && (
                <button type="button" className="icon-btn tiny" onClick={() => setQuery('')} aria-label="Ryd søgning">
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              className={`filter-chip search-scope ${searchAll ? 'active' : ''}`}
              onClick={() => setSearchAll((value) => !value)}
              aria-pressed={searchAll}
              aria-label="Søg i alle måneder"
              title="Søg i alle måneder"
            >
              <Icon name="calendar" size={13} /> {searchAll ? 'Alle' : monthLabel(monthKey, 'short')}
            </button>
          </div>
          <div className="filter-row">
            <button
              type="button"
              className={`filter-chip ${filter === 'alle' ? 'active' : ''}`}
              onClick={() => setFilter('alle')}
            >
              Alle
            </button>
            {usedCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`filter-chip ${filter === category.id ? 'active' : ''}`}
                onClick={() => setFilter(category.id)}
              >
                <span aria-hidden="true">{category.emoji}</span> {category.name}
              </button>
            ))}
          </div>
        </div>

        {grouped.length === 0 ? (
          <EmptyState
            emoji={query || filter !== 'alle' ? '🔍' : '🧾'}
            title={
              query || filter !== 'alle'
                ? 'Ingen udgifter matcher'
                : searchAll
                  ? 'Ingen udgifter endnu'
                  : 'Ingen udgifter i denne måned'
            }
            description={
              query || filter !== 'alle'
                ? 'Prøv at søge efter noget andet, eller skift kategori.'
                : 'Scan din første kvittering, og den dukker op her.'
            }
          >
            {!query && filter === 'alle' && (
              <button type="button" className="btn btn-primary" onClick={onScan}>
                <Icon name="scan" size={18} /> Scan kvittering
              </button>
            )}
          </EmptyState>
        ) : (
          <div className="history-list">
            {grouped.map(([date, transactions]) => {
              const dayTotal = transactions.reduce((sum, txn) => sum + txn.amount, 0);
              return (
                <div key={date} className="history-group">
                  <div className="history-day">
                    <span>{formatRelativeDay(date)}</span>
                    <span className="muted tiny">{formatMoney(dayTotal, currency)}</span>
                  </div>
                  <ul className="txn-list">
                    {transactions.map((txn) => (
                      <li key={txn.id}>
                        <button type="button" className="txn-row" onClick={() => onOpenTransaction(txn)}>
                          <ReceiptThumb id={txn.id} category={txn.category} />
                          <span className="txn-info">
                            <span className="txn-merchant">
                              {txn.merchant}
                              {txn.source === 'scan' && <span className="scan-dot" title="Scannet kvittering" />}
                            </span>
                            <span className="txn-meta">
                              {txn.items && txn.items.length > 0
                                ? `${txn.items.length} varer · ${getCategory(txn.category).name}`
                                : getCategory(txn.category).name}
                              {txn.note ? ` · ${txn.note}` : ''}
                            </span>
                          </span>
                          <span className="txn-amount">−{formatMoney(txn.amount, currency)}</span>
                          <Icon name="chevronRight" size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            <div className="history-total">
              <span>
                {filtered.length} {filtered.length === 1 ? 'post' : 'poster'}
                {filter !== 'alle' && <CategoryChip id={filter} subtle />}
              </span>
              <strong>{formatMoney(filteredTotal, currency)}</strong>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
