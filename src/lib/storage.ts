import type { AppState, MonthBudget } from '../types';

const STORAGE_KEY = 'kroner.state.v1';

export const DEFAULT_BUDGET: MonthBudget = {
  total: 8000,
  categories: {
    dagligvarer: 3000,
    restaurant: 800,
    transport: 700,
    bolig: 1000,
    shopping: 800,
    fritid: 500,
    sundhed: 300,
    rejser: 0,
    born: 0,
    andet: 900,
  },
};

export function createInitialState(): AppState {
  return {
    version: 1,
    transactions: [],
    budgets: {},
    settings: {
      theme: 'system',
      currency: 'DKK',
      onboarded: false,
    },
  };
}

export function loadState(): AppState {
  if (typeof localStorage === 'undefined') return createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = createInitialState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      budgets: parsed.budgets ?? {},
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch (error) {
    console.warn('Kunne ikke læse gemt data', error);
    return createInitialState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Kunne ikke gemme data', error);
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Kunne ikke rydde data', error);
  }
}

/**
 * Finder budgettet for en måned. Mangler måneden, arves det seneste
 * budget fra en tidligere måned — så man kun skal sætte beløbet én gang.
 */
export function budgetForMonth(state: AppState, monthKey: string): MonthBudget {
  const exact = state.budgets[monthKey];
  if (exact) return exact;

  const earlier = Object.keys(state.budgets)
    .filter((key) => key < monthKey)
    .sort()
    .pop();
  if (earlier) return state.budgets[earlier];

  const later = Object.keys(state.budgets)
    .filter((key) => key > monthKey)
    .sort()[0];
  if (later) return state.budgets[later];

  return DEFAULT_BUDGET;
}
