import { useEffect, useRef, useState } from 'react';
import type { AppState, Settings } from '../types';
import { useStore } from '../store/StoreProvider';
import { useToast } from '../store/ToastProvider';
import { getCategory } from '../data/categories';
import { terminateOcr } from '../lib/ocr';
import { Modal } from './ui/Modal';
import { Icon } from './Icon';

const THEMES: Array<{ value: Settings['theme']; label: string; icon: 'sun' | 'moon' | 'settings' }> = [
  { value: 'light', label: 'Lys', icon: 'sun' },
  { value: 'dark', label: 'Mørk', icon: 'moon' },
  { value: 'system', label: 'Auto', icon: 'settings' },
];

const CURRENCIES: Settings['currency'][] = ['DKK', 'EUR', 'SEK', 'NOK'];

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function toCsv(state: AppState): string {
  const escape = (value: string | number | undefined) => {
    const text = String(value ?? '');
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = ['Dato', 'Butik', 'Kategori', 'Beløb (kr)', 'Kilde', 'Note', 'Varer'];
  const rows = [...state.transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((txn) =>
      [
        txn.date,
        txn.merchant,
        getCategory(txn.category).name,
        txn.amount.toFixed(2).replace('.', ','),
        txn.source === 'scan' ? 'Scannet' : 'Manuel',
        txn.note ?? '',
        txn.items?.map((item) => `${item.name} (${item.amount.toFixed(2)})`).join(', ') ?? '',
      ]
        .map(escape)
        .join(';'),
    );
  return `\uFEFF${[header.join(';'), ...rows].join('\r\n')}`;
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, updateSettings, importState, resetAll, loadDemoData } = useStore();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    navigator.storage
      ?.estimate?.()
      .then((estimate) => setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }))
      .catch(() => setStorage(null));
  }, [open]);

  const lastBackup = state.settings.lastBackupAt;
  const backupDays = lastBackup
    ? Math.round((Date.now() - new Date(lastBackup).getTime()) / (24 * 60 * 60 * 1000))
    : undefined;
  const backupLabel =
    backupDays === undefined
      ? 'Ingen backup endnu'
      : backupDays <= 0
        ? 'Sidste backup: i dag'
        : backupDays === 1
          ? 'Sidste backup: i går'
          : `Sidste backup: for ${backupDays} dage siden`;
  const backupStale = backupDays === undefined || backupDays >= 30;

  const usageMb = storage ? storage.usage / 1024 / 1024 : 0;
  const quotaMb = storage && storage.quota ? storage.quota / 1024 / 1024 : 0;
  const usageRatio = storage && storage.quota ? storage.usage / storage.quota : 0;

  const exportJson = () => {
    download(
      `kroner-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(state, null, 2),
      'application/json',
    );
    updateSettings({ lastBackupAt: new Date().toISOString() });
    showToast('Backup hentet som JSON');
  };

  const exportCsv = () => {
    download(`kroner-udgifter-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(state), 'text/csv;charset=utf-8');
    showToast('Udgifter eksporteret til CSV');
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppState>;
      if (!parsed || !Array.isArray(parsed.transactions)) {
        showToast('Filen indeholder ikke et gyldigt backup', { tone: 'error' });
        return;
      }
      importState(parsed);
      showToast(`Importerede ${parsed.transactions.length} udgifter`);
      onClose();
    } catch {
      showToast('Kunne ikke læse filen', { tone: 'error' });
    }
  };

  const doReset = async () => {
    await resetAll();
    await terminateOcr();
    setConfirmReset(false);
    showToast('Alle data er slettet', { tone: 'info' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Indstillinger" subtitle="Udseende, valuta og dine data" size="md">
      <div className="settings-section">
        <h4>Udseende</h4>
        <div className="segmented">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              type="button"
              className={state.settings.theme === theme.value ? 'active' : ''}
              onClick={() => updateSettings({ theme: theme.value })}
            >
              <Icon name={theme.icon} size={16} /> {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h4>Valuta</h4>
        <p className="muted tiny">Beløb gemmes i kroner og vises omregnet i den valuta du vælger.</p>
        <div className="segmented">
          {CURRENCIES.map((currency) => (
            <button
              key={currency}
              type="button"
              className={state.settings.currency === currency ? 'active' : ''}
              onClick={() => updateSettings({ currency })}
            >
              {currency}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h4>Dine data</h4>
        <p className="muted tiny">
          Alt gemmes lokalt i browseren. Lav en backup, før du skifter enhed eller rydder browserdata.
        </p>
        {storage && (
          <div className="storage-info">
            <div className="row-between tiny muted">
              <span>Lagerplads brugt</span>
              <span>
                {usageMb < 0.1 ? 'under 0,1' : usageMb.toFixed(1)} MB
                {quotaMb > 0 && ` af ${quotaMb.toFixed(0)} MB`}
              </span>
            </div>
            {quotaMb > 0 && (
              <div className="bar">
                <div
                  className={`bar-fill ${usageRatio > 0.8 ? 'over' : ''}`}
                  style={{ width: `${Math.min(100, usageRatio * 100)}%` }}
                />
              </div>
            )}
            {usageRatio > 0.8 && (
              <p className="hint warn">
                <Icon name="alert" size={14} /> Pladsen er næsten brugt op. Lav en backup og slet gamle
                kvitteringer.
              </p>
            )}
          </div>
        )}

        <div className={`backup-status ${backupStale ? 'stale' : ''}`}>
          <Icon name={backupStale ? 'alert' : 'check'} size={16} />
          <div>
            <strong>{backupLabel}</strong>
            <span className="muted tiny">
              {state.transactions.length} udgifter · {state.transactions.filter((txn) => txn.source === 'scan').length}{' '}
              scannede boner
            </span>
          </div>
        </div>

        <div className="settings-buttons">
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportJson}>
            <Icon name="download" size={16} /> Backup (JSON)
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>
            <Icon name="download" size={16} /> Eksportér CSV
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Importér backup
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              updateSettings({ onboarded: false });
              onClose();
            }}
          >
            <Icon name="sparkles" size={16} /> Vis introduktionen igen
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadDemoData}>
            <Icon name="sparkles" size={16} /> Indlæs eksempeldata
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importJson(file);
            event.target.value = '';
          }}
        />
      </div>

      <div className="settings-section danger">
        <h4>Nulstil</h4>
        <p className="muted tiny">
          Sletter alle udgifter, budgetter og kvitteringsbilleder fra denne browser. Kan ikke fortrydes.
        </p>
        {confirmReset ? (
          <div className="row-wrap">
            <button type="button" className="btn btn-danger btn-sm" onClick={doReset}>
              Ja, slet alt
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(false)}>
              Annullér
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={16} /> Slet alle data
          </button>
        )}
      </div>

      <div className="settings-about">
        <div className="brand-mark small" aria-hidden="true">
          kr
        </div>
        <div>
          <strong>Kroner</strong>
          <p className="muted tiny">
            Budget-app med kvitteringsscanning. OCR kører lokalt på enheden med Tesseract.js — dine
            kvitteringer uploades aldrig.
          </p>
          <p className="muted tiny shortcuts">
            <strong>Genveje:</strong> N = ny udgift · S = scan · ←/→ = skift måned · Esc = luk
          </p>
        </div>
      </div>
    </Modal>
  );
}
