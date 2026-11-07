import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

/** Minimal matchMedia-stub, som jsdom mangler. */
function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    stubMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('viser forsiden med månedsbudget og navigation', () => {
    render(<App />);
    expect(screen.getAllByText('Kroner').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tilbage i/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Scan første kvittering/i })).toBeTruthy();
  });

  it('går til scan-siden og viser upload-muligheder', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Scan kvittering$/ })[0]);
    expect(screen.getByText(/Slip billedet her/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tag billede/i })).toBeTruthy();
  });

  it('kan sætte et månedligt budget', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /Budget/i })[0]);
    const input = screen.getByLabelText(/Månedligt budget/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12500' } });
    expect(input.value).toBe('12500');
    const stored = JSON.parse(localStorage.getItem('kroner.state.v1') ?? '{}');
    const budgets = Object.values(stored.budgets ?? {}) as Array<{ total: number }>;
    expect(budgets.some((budget) => budget.total === 12500)).toBe(true);
  });

  it('kan tilføje en udgift manuelt og se den i historikken', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /Ny udgift/i })[0]);
    fireEvent.change(screen.getByLabelText(/Beløb/), { target: { value: '149,95' } });
    fireEvent.change(screen.getByPlaceholderText('Fx Netto'), { target: { value: 'Testbutik' } });
    fireEvent.click(screen.getByRole('button', { name: /Gem udgift/i }));

    fireEvent.click(screen.getAllByRole('button', { name: /Historik/i })[0]);
    expect(screen.getAllByText('Testbutik').length).toBeGreaterThan(0);
    expect(screen.getByText(/−149,95/)).toBeTruthy();
  });

  it('indlæser eksempeldata og viser statistik', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Se med eksempeldata/i }));
    expect(screen.getByText(/Seneste kvitteringer/i)).toBeTruthy();
    expect(screen.getByText('Kategorier')).toBeTruthy();
    const list = screen.getByText(/Seneste kvitteringer/i).closest('section');
    expect(within(list as HTMLElement).getAllByRole('button').length).toBeGreaterThan(1);
  });
});
