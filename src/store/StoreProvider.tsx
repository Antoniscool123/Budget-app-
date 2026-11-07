import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppState, MonthBudget, Settings, Transaction } from '../types';
import { clearState, createInitialState, loadState, saveState } from '../lib/storage';
import { createDemoState } from '../lib/demo';
import { deleteImage, clearImages, saveImage } from '../lib/imageStore';

interface NewTransaction extends Omit<Transaction, 'id' | 'createdAt'> {
  image?: string;
}

interface StoreValue {
  state: AppState;
  addTransaction: (input: NewTransaction) => Promise<Transaction>;
  updateTransaction: (id: string, patch: Partial<Transaction>, image?: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setBudget: (monthKey: string, budget: MonthBudget) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  loadDemoData: () => void;
  importState: (incoming: Partial<AppState>) => boolean;
  resetAll: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const lastSaved = useRef<string>('');

  // Gem når noget ændrer sig (ikke ved første render, hvor data er læst fra lageret).
  useEffect(() => {
    const serialized = JSON.stringify(state);
    if (lastSaved.current === '' ) {
      lastSaved.current = serialized;
      return;
    }
    if (lastSaved.current === serialized) return;
    lastSaved.current = serialized;
    saveState(state);
  }, [state]);

  const addTransaction = useCallback<StoreValue['addTransaction']>(async (input) => {
    const { image, ...rest } = input;
    const transaction: Transaction = {
      ...rest,
      id: makeId(),
      createdAt: new Date().toISOString(),
    };
    if (image) await saveImage(transaction.id, image);
    setState((prev) => ({ ...prev, transactions: [transaction, ...prev.transactions] }));
    return transaction;
  }, []);

  const updateTransaction = useCallback<StoreValue['updateTransaction']>(async (id, patch, image) => {
    if (image) await saveImage(id, image);
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((txn) =>
        txn.id === id ? { ...txn, ...patch, id: txn.id, createdAt: txn.createdAt } : txn,
      ),
    }));
  }, []);

  const deleteTransaction = useCallback<StoreValue['deleteTransaction']>(async (id) => {
    await deleteImage(id);
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((txn) => txn.id !== id),
    }));
  }, []);

  const setBudget = useCallback<StoreValue['setBudget']>((monthKey, budget) => {
    setState((prev) => ({
      ...prev,
      budgets: { ...prev.budgets, [monthKey]: budget },
    }));
  }, []);

  const updateSettings = useCallback<StoreValue['updateSettings']>((patch) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const loadDemoData = useCallback(() => {
    const demo = createDemoState();
    clearImages().catch(() => undefined);
    setState(demo);
    saveState(demo);
    lastSaved.current = JSON.stringify(demo);
  }, []);

  const importState = useCallback<StoreValue['importState']>((incoming) => {
    if (!incoming || !Array.isArray(incoming.transactions)) return false;
    const base = createInitialState();
    const next: AppState = {
      ...base,
      ...incoming,
      settings: { ...base.settings, ...(incoming.settings ?? {}) },
      budgets: incoming.budgets ?? {},
      transactions: incoming.transactions,
    };
    setState(next);
    return true;
  }, []);

  const resetAll = useCallback<StoreValue['resetAll']>(async () => {
    clearState();
    await clearImages();
    const fresh = createInitialState();
    setState(fresh);
    lastSaved.current = JSON.stringify(fresh);
  }, []);

  // Tema på <html> — "system" følger operativsystemet.
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = state.settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : state.settings.theme;
      root.dataset.theme = theme;
      root.style.colorScheme = theme;
    };
    apply();
    if (state.settings.theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [state.settings.theme]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      setBudget,
      updateSettings,
      loadDemoData,
      importState,
      resetAll,
    }),
    [state, addTransaction, updateTransaction, deleteTransaction, setBudget, updateSettings, loadDemoData, importState, resetAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore skal bruges inden i StoreProvider');
  return ctx;
}
