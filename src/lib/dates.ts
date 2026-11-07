/** Hjælpefunktioner til måneder. Månedsnøgler er "YYYY-MM". */

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m - 1 };
}

export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const { year, month } = parseMonthKey(key);
  const date = new Date(year, month, 1);
  const label = new Intl.DateTimeFormat('da-DK', {
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function addMonths(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const date = new Date(year, month + delta, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

export function daysInMonth(key: string): number {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month + 1, 0).getDate();
}

/** Antal dage tilbage i måneden — inkl. i dag. Er måneden slut, returneres 0. */
export function daysLeftInMonth(key: string): number {
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}`;
  if (key > currentKey) return daysInMonth(key);
  if (key < currentKey) return 0;
  return daysInMonth(key) - today.getDate() + 1;
}

/** Hvor stor en del af måneden der er gået (0–1). */
export function monthProgress(key: string): number {
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}`;
  const total = daysInMonth(key);
  if (key < currentKey) return 1;
  if (key > currentKey) return 0;
  return Math.min(1, today.getDate() / total);
}

export function lastMonths(count: number, from = currentMonthKey()): string[] {
  const list: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) list.push(addMonths(from, -i));
  return list;
}

export function isFutureMonth(key: string): boolean {
  return key > currentMonthKey();
}
