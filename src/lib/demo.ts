import type { AppState, CategoryId, ReceiptItem, Transaction } from '../types';
import { addMonths, currentMonthKey, daysInMonth } from './dates';
import { createInitialState } from './storage';

/** Simpel seedet tilfældighed, så eksempeldata ser ens ud hver gang. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoShop {
  merchant: string;
  category: CategoryId;
  min: number;
  max: number;
  items: string[];
  weight: number;
}

const SHOPS: DemoShop[] = [
  {
    merchant: 'Netto',
    category: 'dagligvarer',
    min: 74,
    max: 340,
    weight: 5,
    items: ['Økologisk letmælk', 'Rugbrød', 'Æg 10 stk', 'Hakket oksekød 400 g', 'Bananer', 'Skyr natural', 'Pasta', 'Kaffe 500 g'],
  },
  {
    merchant: 'REMA 1000',
    category: 'dagligvarer',
    min: 98,
    max: 420,
    weight: 4,
    items: ['Kyllingebryst', 'Tomater', 'Løg', 'Ris', 'Fløde', 'Smør', 'Ost 45+', 'Chokolade'],
  },
  {
    merchant: 'føtex',
    category: 'dagligvarer',
    min: 120,
    max: 560,
    weight: 3,
    items: ['Fuldkornspasta', 'Laks', 'Rød peber', 'Hummus', 'Yoghurt', 'Æbler', 'Rugmel'],
  },
  {
    merchant: 'Lidl',
    category: 'dagligvarer',
    min: 65,
    max: 280,
    weight: 2,
    items: ['Brød', 'Mælk', 'Bananer', 'Kaffe', 'Pølser'],
  },
  { merchant: "McDonald's", category: 'restaurant', min: 55, max: 165, weight: 2, items: ['Big Mac Menu', 'McChicken', 'Cola', 'Pommes frites'] },
  { merchant: 'Starbucks', category: 'restaurant', min: 42, max: 95, weight: 1, items: ['Flat White', 'Croissant'] },
  { merchant: 'Wolt', category: 'restaurant', min: 145, max: 320, weight: 1, items: ['Sushi bowl', 'Levering'] },
  { merchant: 'Apotek', category: 'sundhed', min: 48, max: 240, weight: 1, items: ['Vitamin D', 'Plaster', 'Hovedpinepiller'] },
  { merchant: 'Fitness World', category: 'fritid', min: 299, max: 299, weight: 1, items: ['Månedligt medlemskab'] },
  { merchant: 'Spotify', category: 'fritid', min: 109, max: 109, weight: 1, items: ['Premium abonnement'] },
  { merchant: 'Elgiganten', category: 'shopping', min: 149, max: 899, weight: 1, items: ['USB-C kabel', 'Høretelefoner'] },
  { merchant: 'Normal', category: 'shopping', min: 45, max: 175, weight: 1, items: ['Shampoo', 'Tandpasta', 'Sæbe'] },
  { merchant: 'JYSK', category: 'shopping', min: 99, max: 450, weight: 1, items: ['Pude', 'Håndklæder'] },
  { merchant: 'Circle K', category: 'transport', min: 250, max: 620, weight: 1, items: ['Benzin 95', 'Vask'] },
  { merchant: 'DSB', category: 'transport', min: 38, max: 145, weight: 2, items: ['Rejsekort optankning'] },
  { merchant: 'Parkering', category: 'transport', min: 15, max: 68, weight: 1, items: ['Parkering 60 min'] },
];

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function makeItems(shop: DemoShop, amount: number, random: () => number): ReceiptItem[] {
  const count = Math.min(4, Math.max(1, Math.round(random() * 4)));
  const chosen: ReceiptItem[] = [];
  let remaining = amount;
  for (let i = 0; i < count; i += 1) {
    const isLast = i === count - 1;
    const value = isLast ? remaining : Math.round((remaining * (0.2 + random() * 0.4)) * 100) / 100;
    remaining = Math.round((remaining - value) * 100) / 100;
    chosen.push({ name: pick(shop.items, random), amount: Math.max(0.01, value) });
  }
  return chosen;
}

export function createDemoTransactions(): Transaction[] {
  const random = mulberry32(1337);
  const transactions: Transaction[] = [];
  const months = [addMonths(currentMonthKey(), -2), addMonths(currentMonthKey(), -1), currentMonthKey()];

  months.forEach((month, monthIndex) => {
    const days = daysInMonth(month);
    const today = new Date();
    const isCurrent = monthIndex === months.length - 1;
    const maxDay = isCurrent ? today.getDate() : days;

    // Faste udgifter i starten af måneden
    const fixed: Array<{ merchant: string; category: CategoryId; amount: number; day: number }> = [
      { merchant: 'Husleje', category: 'bolig', amount: 6200, day: 1 },
      { merchant: 'Norlys', category: 'bolig', amount: 480, day: 3 },
      { merchant: 'Netflix', category: 'fritid', amount: 129, day: 4 },
      { merchant: 'Telmore', category: 'bolig', amount: 199, day: 5 },
    ];

    for (const entry of fixed) {
      if (entry.day > maxDay) continue;
      transactions.push({
        id: `demo-${month}-${entry.merchant}`,
        amount: entry.amount,
        date: `${month}-${`${entry.day}`.padStart(2, '0')}`,
        merchant: entry.merchant,
        category: entry.category,
        source: 'manual',
        createdAt: new Date(`${month}-${`${entry.day}`.padStart(2, '0')}T09:00:00`).toISOString(),
      });
    }

    const receiptCount = isCurrent ? Math.max(6, Math.round(maxDay * 1.1)) : Math.round(26 + random() * 10);
    for (let i = 0; i < receiptCount; i += 1) {
      const day = 2 + Math.floor(random() * Math.max(1, maxDay - 1));
      const shop = pick(
        SHOPS.flatMap((shop) => Array.from({ length: shop.weight }, () => shop)),
        random,
      );
      const amount = Math.round((shop.min + random() * (shop.max - shop.min)) * 100) / 100;
      const date = `${month}-${`${day}`.padStart(2, '0')}`;
      transactions.push({
        id: `demo-${month}-${i}-${shop.merchant.replace(/\s/g, '')}`,
        amount,
        date,
        merchant: shop.merchant,
        category: shop.category,
        source: random() > 0.35 ? 'scan' : 'manual',
        items: makeItems(shop, amount, random),
        createdAt: new Date(`${date}T${`${8 + Math.floor(random() * 12)}`.padStart(2, '0')}:30:00`).toISOString(),
      });
    }
  });

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
}

export function createDemoState(): AppState {
  const base = createInitialState();
  const transactions = createDemoTransactions();
  const currentMonth = currentMonthKey();

  // Budgettet sættes 15 % over det faktiske forbrug i eksempeldataen, så
  // grafer og fremdrift ser realistiske ud.
  const spendByCategory = new Map<CategoryId, number>();
  for (const txn of transactions) {
    if (!txn.date.startsWith(currentMonth)) continue;
    spendByCategory.set(txn.category, (spendByCategory.get(txn.category) ?? 0) + txn.amount);
  }

  const categories: AppState['budgets'][string]['categories'] = {};
  let total = 0;
  for (const [category, spent] of spendByCategory) {
    const limit = Math.max(50, Math.ceil((spent * 1.15) / 50) * 50);
    categories[category] = limit;
    total += limit;
  }

  const budgets: AppState['budgets'] = {};
  for (const month of [addMonths(currentMonth, -2), addMonths(currentMonth, -1), currentMonth]) {
    budgets[month] = { total, categories };
  }

  return {
    ...base,
    transactions,
    budgets,
    settings: { ...base.settings, onboarded: true },
    version: 1,
  };
}
