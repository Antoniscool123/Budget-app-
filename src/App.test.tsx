import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function skipOnboarding() {
  const skip = screen.queryByRole('button', { name: /Spring over/i });
  if (skip) fireEvent.click(skip);
}

function storedState() {
  return JSON.parse(localStorage.getItem('kroner.state.v1') ?? '{}');
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

  describe('onboarding', () => {
    it('tager imod nye brugere og gemmer det månedlige beløb', () => {
      render(<App />);
      expect(screen.getByRole('heading', { name: 'Velkommen til Kroner' })).toBeTruthy();

      fireEvent.change(screen.getByLabelText(/Månedligt beløb/i), { target: { value: '12000' } });
      fireEvent.click(screen.getByRole('button', { name: /Fortsæt/i }));

      expect(screen.getByText(/Klar til den første kvittering/i)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Gå direkte til overblikket/i }));

      expect(screen.getAllByText(/Tilbage i/i).length).toBeGreaterThan(0);
      const state = storedState();
      const budgets = Object.values(state.budgets ?? {}) as Array<{ total: number }>;
      expect(budgets.some((budget) => budget.total === 12000)).toBe(true);
      expect(state.settings.onboarded).toBe(true);
    });

    it('kan springes over', () => {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /Spring over/i }));
      expect(screen.queryByRole('heading', { name: 'Velkommen til Kroner' })).toBeNull();
      expect(screen.getAllByText(/Tilbage i/i).length).toBeGreaterThan(0);
    });
  });

  it('viser forsiden med månedsbudget og navigation', () => {
    render(<App />);
    skipOnboarding();
    expect(screen.getAllByText('Kroner').length).toBeGreaterThan(0);
    expect(screen.getByText(/Du kan bruge/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Scan første kvittering/i })).toBeTruthy();
  });

  it('går til scan-siden og viser upload-muligheder', () => {
    render(<App />);
    skipOnboarding();
    fireEvent.click(screen.getAllByRole('button', { name: /^Scan kvittering$/ })[0]);
    expect(screen.getByText(/Slip billedet her/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tag billede/i })).toBeTruthy();
  });

  it('kan sætte et månedligt budget og bruge det på flere måneder', () => {
    render(<App />);
    skipOnboarding();
    fireEvent.click(screen.getAllByRole('button', { name: /Budget/i })[0]);

    const input = screen.getByLabelText(/Månedligt budget/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12500' } });
    expect(input.value).toBe('12500');

    let budgets = Object.values(storedState().budgets ?? {}) as Array<{ total: number }>;
    expect(budgets.some((budget) => budget.total === 12500)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Brug også de næste 6 måneder/i }));
    budgets = Object.values(storedState().budgets ?? {}) as Array<{ total: number }>;
    expect(budgets.length).toBeGreaterThanOrEqual(3);
    expect(budgets.every((budget) => budget.total === 12500)).toBe(true);
  });

  it('kan tilføje en udgift manuelt og se den i historikken', () => {
    render(<App />);
    skipOnboarding();
    fireEvent.click(screen.getAllByRole('button', { name: /Ny udgift/i })[0]);
    fireEvent.change(screen.getByLabelText(/Beløb/), { target: { value: '149,95' } });
    fireEvent.change(screen.getByPlaceholderText('Fx Netto'), { target: { value: 'Testbutik' } });
    fireEvent.click(screen.getByRole('button', { name: /Gem udgift/i }));

    fireEvent.click(screen.getAllByRole('button', { name: /Historik/i })[0]);
    expect(screen.getAllByText('Testbutik').length).toBeGreaterThan(0);
    expect(screen.getByText(/−149,95/)).toBeTruthy();
  });

  it('advarsler om dubletter før udgiften gemmes', () => {
    render(<App />);
    skipOnboarding();

    const add = () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Ny udgift/i })[0]);
      fireEvent.change(screen.getByLabelText(/Beløb/), { target: { value: '89,50' } });
      fireEvent.change(screen.getByPlaceholderText('Fx Netto'), { target: { value: 'Bageren' } });
      fireEvent.click(screen.getByRole('button', { name: /Gem udgift/i }));
    };

    add();
    add();

    expect(screen.getByText(/Det ligner en dublet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Gem alligevel/i }));
    expect(screen.queryByText(/Det ligner en dublet/i)).toBeNull();
  });

  it('kan gemme flere udgifter i træk', async () => {
    render(<App />);
    skipOnboarding();

    fireEvent.click(screen.getAllByRole('button', { name: /Ny udgift/i })[0]);
    fireEvent.change(screen.getByLabelText(/Beløb/), { target: { value: '25' } });
    fireEvent.change(screen.getByPlaceholderText('Fx Netto'), { target: { value: 'Kiosken' } });
    fireEvent.click(screen.getByRole('button', { name: /Gem & ny/i }));

    // Modalen bliver åben og felterne ryddet, så man kan taste den næste.
    await waitFor(() => expect((screen.getByLabelText(/Beløb/) as HTMLInputElement).value).toBe(''));

    fireEvent.change(screen.getByLabelText(/Beløb/), { target: { value: '30' } });
    fireEvent.change(screen.getByPlaceholderText('Fx Netto'), { target: { value: 'Bageren' } });
    fireEvent.click(screen.getByRole('button', { name: /Gem udgift/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /Gem udgift/i })).toBeNull());
    const transactions = storedState().transactions as Array<{ merchant: string }>;
    expect(transactions.map((txn) => txn.merchant)).toEqual(expect.arrayContaining(['Kiosken', 'Bageren']));
  });

  it('kan sætte datoen til i går med ét tryk', () => {
    render(<App />);
    skipOnboarding();
    fireEvent.click(screen.getAllByRole('button', { name: /Ny udgift/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'I går' }));
    const date = screen.getByLabelText('Dato') as HTMLInputElement;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(date.value).toBe(yesterday.toISOString().slice(0, 10));
  });

  it('viser backup-status i indstillinger', () => {
    render(<App />);
    skipOnboarding();
    fireEvent.click(screen.getAllByRole('button', { name: /Indstillinger/i })[0]);
    expect(screen.getByText(/Ingen backup endnu|Sidste backup/i)).toBeTruthy();
  });

  it('kan søge i alle måneder', () => {
    render(<App />);
    skipOnboarding();
    fireEvent.click(screen.getAllByRole('button', { name: /Historik/i })[0]);
    const scope = screen.getByRole('button', { name: /Søg i alle måneder/i });
    expect(scope.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(scope);
    expect(scope.getAttribute('aria-pressed')).toBe('true');
  });

  it('indlæser eksempeldata og viser statistik og faste udgifter', () => {
    render(<App />);
    skipOnboarding();
    fireEvent.click(screen.getByRole('button', { name: /Se med eksempeldata/i }));
    expect(screen.getByText(/Seneste kvitteringer/i)).toBeTruthy();
    expect(screen.getByText('Kategorier')).toBeTruthy();
    expect(screen.getAllByText(/Faste udgifter/i).length).toBeGreaterThan(0);
    const list = screen.getByText(/Seneste kvitteringer/i).closest('section');
    expect(within(list as HTMLElement).getAllByRole('button').length).toBeGreaterThan(1);
  });
});
