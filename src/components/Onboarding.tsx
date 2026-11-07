import { useState } from 'react';
import type { Tab } from '../types';
import { useStore } from '../store/StoreProvider';
import { useToast } from '../store/ToastProvider';
import { formatNumber, formatMoney, parseAmountString } from '../lib/format';
import { currentMonthKey, monthLabel } from '../lib/dates';
import { suggestDistribution } from '../lib/budget';
import { Icon } from './Icon';

const PRESETS = [5000, 8000, 12000, 15000];

/**
 * Introduktion ved første besøg: sæt et månedsbeløb, og kom direkte i gang
 * med at scanne. Tre korte trin — man kan springe over hele vejen.
 */
export function Onboarding({
  onFinish,
  onManualEntry,
}: {
  onFinish: (tab?: Tab) => void;
  onManualEntry: () => void;
}) {
  const { state, setBudget, loadDemoData, updateSettings } = useStore();
  const { showToast } = useToast();
  const currency = state.settings.currency;
  const monthKey = currentMonthKey();

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState('8000');

  const finish = (tab?: Tab) => {
    updateSettings({ onboarded: true });
    onFinish(tab);
  };

  const saveBudgetAndContinue = () => {
    const value = Math.max(0, parseAmountString(amount) ?? 0);
    if (value > 0) {
      setBudget(monthKey, { total: value, categories: suggestDistribution(value) });
      showToast(`Budget sat til ${formatMoney(value, currency, { compact: true })} pr. måned`);
    }
    setStep(1);
  };

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Velkommen til Kroner">
      <div className="onboarding-card">
        <div className="onboarding-head">
          <span className="brand-mark" aria-hidden="true">
            kr
          </span>
          <div className="onboarding-progress" aria-hidden="true">
            <span className={step >= 0 ? 'active' : ''} />
            <span className={step >= 1 ? 'active' : ''} />
          </div>
          <button type="button" className="link-btn" onClick={() => finish()}>
            Spring over
          </button>
        </div>

        {step === 0 && (
          <>
            <div className="onboarding-copy">
              <h2>Velkommen til Kroner</h2>
              <p className="muted">
                Scan dine kvitteringer — vi læser selv beløbet, så du slipper for at taste. Først: hvor
                meget må du bruge om måneden?
              </p>
            </div>

            <label className="field field-amount onboarding-amount">
              <span>Månedligt beløb · {monthLabel(monthKey).toLowerCase()}</span>
              <div className="amount-input">
                <span className="currency">kr</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  autoFocus
                  aria-label="Månedligt beløb"
                />
              </div>
            </label>

            <div className="onboarding-presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`preset ${parseAmountString(amount) === preset ? 'active' : ''}`}
                  onClick={() => setAmount(String(preset))}
                >
                  {formatNumber(preset)} kr
                </button>
              ))}
            </div>

            <div className="onboarding-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={saveBudgetAndContinue}>
                Fortsæt <Icon name="arrowRight" size={18} />
              </button>
              <span className="muted tiny">Du kan altid ændre beløbet under Budget.</span>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="onboarding-copy">
              <h2>Klar til den første kvittering</h2>
              <p className="muted">Vælg hvordan du vil starte — det tager under et minut.</p>
            </div>

            <div className="onboarding-options">
              <button type="button" className="onboarding-option" onClick={() => finish('scan')}>
                <span className="mini-icon teal">
                  <Icon name="scan" size={20} />
                </span>
                <span>
                  <strong>Scan en kvittering</strong>
                  <span className="muted tiny">Tag et billede — beløbet bliver læst automatisk</span>
                </span>
                <Icon name="chevronRight" size={18} />
              </button>

              <button
                type="button"
                className="onboarding-option"
                onClick={() => {
                  updateSettings({ onboarded: true });
                  onManualEntry();
                }}
              >
                <span className="mini-icon violet">
                  <Icon name="edit" size={20} />
                </span>
                <span>
                  <strong>Indtast en udgift manuelt</strong>
                  <span className="muted tiny">Hvis du ikke har bonen ved hånden</span>
                </span>
                <Icon name="chevronRight" size={18} />
              </button>

              <button
                type="button"
                className="onboarding-option"
                onClick={() => {
                  loadDemoData();
                  showToast('Eksempeldata indlæst — kig dig omkring');
                  finish();
                }}
              >
                <span className="mini-icon amber">
                  <Icon name="sparkles" size={20} />
                </span>
                <span>
                  <strong>Se appen med eksempeldata</strong>
                  <span className="muted tiny">Prøv alle funktioner uden at indtaste noget</span>
                </span>
                <Icon name="chevronRight" size={18} />
              </button>
            </div>

            <div className="onboarding-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
                Tilbage
              </button>
              <button type="button" className="link-btn" onClick={() => finish()}>
                Gå direkte til overblikket
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
