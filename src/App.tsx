import { useCallback, useEffect, useState } from 'react';
import type { Tab, Transaction } from './types';
import { StoreProvider, useStore } from './store/StoreProvider';
import { ToastProvider } from './store/ToastProvider';
import { Dashboard } from './pages/Dashboard';
import { ScanPage } from './pages/ScanPage';
import { BudgetPage } from './pages/BudgetPage';
import { HistoryPage } from './pages/HistoryPage';
import { TransactionModal } from './components/TransactionModal';
import { TransactionDetail } from './components/TransactionDetail';
import { SettingsModal } from './components/SettingsModal';
import { Icon, type IconName } from './components/Icon';
import { addMonths, currentMonthKey, isFutureMonth, monthLabel } from './lib/dates';
import { summarizeMonth } from './lib/budget';
import { formatMoney } from './lib/format';

interface NavItem {
  id: Tab;
  label: string;
  short: string;
  icon: IconName;
}

const NAV: NavItem[] = [
  { id: 'overblik', label: 'Overblik', short: 'Overblik', icon: 'home' },
  { id: 'scan', label: 'Scan kvittering', short: 'Scan', icon: 'scan' },
  { id: 'budget', label: 'Budget', short: 'Budget', icon: 'wallet' },
  { id: 'historik', label: 'Historik', short: 'Historik', icon: 'list' },
];

const TITLES: Record<Tab, { title: string; subtitle: string }> = {
  overblik: { title: 'Overblik', subtitle: 'Sådan ser din økonomi ud lige nu' },
  scan: { title: 'Scan kvittering', subtitle: 'Beløbet bliver læst automatisk' },
  budget: { title: 'Budget', subtitle: 'Sæt dit månedlige beløb og kategorilofter' },
  historik: { title: 'Historik', subtitle: 'Alle dine udgifter og udviklingen over tid' },
};

function Shell() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('overblik');
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [txnModal, setTxnModal] = useState<{ open: boolean; transaction: Transaction | null }>({
    open: false,
    transaction: null,
  });
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const summary = summarizeMonth(state, monthKey);
  const currency = state.settings.currency;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [tab]);

  const openManual = useCallback(() => setTxnModal({ open: true, transaction: null }), []);
  const openDetail = useCallback((txn: Transaction) => setDetail(txn), []);

  const changeMonth = (delta: number) => {
    const next = addMonths(monthKey, delta);
    if (isFutureMonth(next)) return;
    setMonthKey(next);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            kr
          </span>
          <span className="brand-text">
            <strong>Kroner</strong>
            <span className="muted tiny">budget & kvitteringer</span>
          </span>
        </div>

        <nav className="side-nav" aria-label="Hovedmenu">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="stat-label">Tilbage i {monthLabel(monthKey, 'short').toLowerCase()}</span>
          <strong>{formatMoney(Math.max(summary.remaining, 0), currency, { compact: true })}</strong>
          <div className="bar">
            <div
              className={`bar-fill ${summary.ratio > 1 ? 'over' : ''}`}
              style={{ width: `${Math.min(100, summary.ratio * 100)}%` }}
            />
          </div>
          <span className="muted tiny">
            {formatMoney(summary.spent, currency, { compact: true })} af{' '}
            {formatMoney(summary.budget.total, currency, { compact: true })}
          </span>
        </div>

        <div className="sidebar-foot">
          <button type="button" className="side-btn" onClick={openManual}>
            <Icon name="plus" size={18} /> Ny udgift
          </button>
          <button type="button" className="side-btn" onClick={() => setSettingsOpen(true)}>
            <Icon name="settings" size={18} /> Indstillinger
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{TITLES[tab].title}</h1>
            <p className="muted tiny">{TITLES[tab].subtitle}</p>
          </div>

          <div className="topbar-actions">
            <div className="month-switcher">
              <button type="button" className="icon-btn" onClick={() => changeMonth(-1)} aria-label="Forrige måned">
                <Icon name="chevronLeft" size={18} />
              </button>
              <span className="month-label">{monthLabel(monthKey)}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => changeMonth(1)}
                aria-label="Næste måned"
                disabled={isFutureMonth(addMonths(monthKey, 1))}
              >
                <Icon name="chevronRight" size={18} />
              </button>
              {monthKey !== currentMonthKey() && (
                <button type="button" className="link-btn" onClick={() => setMonthKey(currentMonthKey())}>
                  I dag
                </button>
              )}
            </div>

            <button type="button" className="icon-btn settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Indstillinger">
              <Icon name="settings" size={19} />
            </button>
            <button type="button" className="btn btn-primary btn-sm topbar-add" onClick={openManual}>
              <Icon name="plus" size={17} /> <span>Ny udgift</span>
            </button>
          </div>
        </header>

        <main className="content">
          {tab === 'overblik' && (
            <Dashboard
              monthKey={monthKey}
              onNavigate={setTab}
              onOpenTransaction={openDetail}
              onOpenBudget={() => setTab('budget')}
            />
          )}
          {tab === 'scan' && <ScanPage onManualEntry={openManual} />}
          {tab === 'budget' && <BudgetPage monthKey={monthKey} />}
          {tab === 'historik' && (
            <HistoryPage
              monthKey={monthKey}
              onMonthChange={setMonthKey}
              onOpenTransaction={openDetail}
              onScan={() => setTab('scan')}
            />
          )}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Hovedmenu">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>

      <button type="button" className="fab" onClick={() => (tab === 'scan' ? openManual() : setTab('scan'))} aria-label="Scan kvittering">
        <Icon name="camera" size={24} />
      </button>

      <TransactionModal
        open={txnModal.open}
        transaction={txnModal.transaction}
        onClose={() => setTxnModal({ open: false, transaction: null })}
      />
      <TransactionDetail
        transaction={detail}
        onClose={() => setDetail(null)}
        onEdit={(txn) => {
          setDetail(null);
          setTxnModal({ open: true, transaction: txn });
        }}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}
