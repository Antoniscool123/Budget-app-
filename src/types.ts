export type Tab = 'overblik' | 'scan' | 'budget' | 'historik';

export type CategoryId =
  | 'dagligvarer'
  | 'restaurant'
  | 'transport'
  | 'bolig'
  | 'shopping'
  | 'fritid'
  | 'sundhed'
  | 'rejser'
  | 'born'
  | 'andet';

export interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  color: string;
  /** Bruges når appen gætter kategori ud fra butikkens navn eller varetekst. */
  keywords: string[];
}

export interface ReceiptItem {
  name: string;
  amount: number;
}

export interface Transaction {
  id: string;
  /** Beløb i kroner, altid positivt. */
  amount: number;
  /** ISO-dato: YYYY-MM-DD */
  date: string;
  merchant: string;
  category: CategoryId;
  note?: string;
  items?: ReceiptItem[];
  source: 'scan' | 'manual';
  createdAt: string;
}

export interface RecurringExpense {
  /** Normaliseret butiksnavn — bruges som nøgle. */
  key: string;
  merchant: string;
  category: CategoryId;
  /** Typisk beløb pr. måned. */
  averageAmount: number;
  /** Måneder (YYYY-MM) udgiften er set i. */
  months: string[];
  lastDate: string;
  count: number;
}

export interface MonthBudget {
  /** Samlet beløb til rådighed i måneden. */
  total: number;
  /** Valgfrie delbudgetter pr. kategori. */
  categories: Partial<Record<CategoryId, number>>;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  currency: 'DKK' | 'EUR' | 'SEK' | 'NOK';
  onboarded: boolean;
  /** ISO-tidsstempel for seneste backup — bruges til at minde om en ny. */
  lastBackupAt?: string;
}

export interface AppState {
  version: number;
  transactions: Transaction[];
  /** Nøgle er måned på formen YYYY-MM. */
  budgets: Record<string, MonthBudget>;
  /** Butik (normaliseret) → kategori, så appen husker dine valg. */
  merchantCategories: Record<string, CategoryId>;
  settings: Settings;
}

export interface ParsedReceipt {
  merchant?: string;
  amount?: number;
  date?: string;
  category?: CategoryId;
  items: ReceiptItem[];
  raw: string;
  /** 0–1: hvor sikker parseren er på resultatet. */
  confidence: number;
  /** Hvilke regler der gav resultatet — vises i UI'et som "sådan blev det læst". */
  signals: string[];
}
