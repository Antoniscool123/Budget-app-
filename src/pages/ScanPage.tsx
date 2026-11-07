import { useCallback, useEffect, useRef, useState } from 'react';
import type { CategoryId, ParsedReceipt, ReceiptItem } from '../types';
import { CATEGORIES, getCategory } from '../data/categories';
import { prepareImage } from '../lib/image';
import { runOcr, prewarmOcr, type OcrProgress } from '../lib/ocr';
import { parseReceipt } from '../lib/receiptParser';
import { formatMoney, formatRelativeDay, parseAmountString } from '../lib/format';
import { todayISO } from '../lib/dates';
import { useStore } from '../store/StoreProvider';
import { useToast } from '../store/ToastProvider';
import { Icon } from '../components/Icon';
import { CategoryChip } from '../components/ui/CategoryChip';

type ScanPhase = 'idle' | 'processing' | 'review' | 'error';

interface ReviewState {
  previewUrl: string;
  thumbnail: string;
  parsed: ParsedReceipt;
  ocrText: string;
  ocrConfidence: number;
}

interface FormState {
  amount: string;
  merchant: string;
  date: string;
  category: CategoryId;
  note: string;
  items: ReceiptItem[];
}

const EMPTY_FORM: FormState = {
  amount: '',
  merchant: '',
  date: todayISO(),
  category: 'andet',
  note: '',
  items: [],
};

export function ScanPage({ onManualEntry }: { onManualEntry: () => void }) {
  const { state, addTransaction, deleteTransaction, loadDemoData } = useStore();
  const { showToast } = useToast();
  const currency = state.settings.currency;

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string>('');
  const [showRaw, setShowRaw] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    prewarmOcr();
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPhase('idle');
    setProgress(null);
    setReview(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowRaw(false);
    setPreviewUrl('');
  }, []);

  const startScan = useCallback(
    async (blob: Blob, label = 'kvittering') => {
      abortRef.current = false;
      setError('');
      setReview(null);
      setPhase('processing');
      setProgress({ stage: 'prepare', progress: 0.02, message: 'Forbereder billedet' });

      const objectUrl = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);

      try {
        const prepared = await prepareImage(blob);
        if (abortRef.current) return;

        setProgress({ stage: 'loading', progress: 0.06, message: 'Starter tekstgenkendelse' });
        const result = await runOcr(prepared.ocrDataUrl, (update) => {
          if (!abortRef.current) setProgress(update);
        });
        if (abortRef.current) return;

        let parsed = parseReceipt(result.text);
        let ocrText = result.text;
        let ocrConfidence = result.confidence;

        // Fandt vi intet beløb, prøver vi med en anden billedopdeling,
        // som nogle gange fanger rodede kvitteringer bedre.
        if (parsed.amount === undefined) {
          setProgress({ stage: 'recognize', progress: 0.9, message: 'Prøver en ekstra læsning' });
          try {
            const retry = await runOcr(prepared.ocrDataUrl, () => undefined, 'sparse');
            const retryParsed = parseReceipt(retry.text);
            if (retryParsed.amount !== undefined || retryParsed.confidence > parsed.confidence) {
              parsed = retryParsed;
              ocrText = retry.text;
              ocrConfidence = retry.confidence;
            }
          } catch {
            /* behold første resultat */
          }
        }
        if (abortRef.current) return;
        setReview({
          previewUrl: objectUrl,
          thumbnail: prepared.thumbnailDataUrl,
          parsed,
          ocrText,
          ocrConfidence,
        });
        setForm({
          amount: parsed.amount !== undefined ? String(parsed.amount.toFixed(2)).replace('.', ',') : '',
          merchant: parsed.merchant ?? '',
          date: parsed.date ?? todayISO(),
          category: parsed.category ?? 'andet',
          note: '',
          items: parsed.items,
        });
        setPhase('review');

        if (parsed.amount === undefined) {
          showToast('Kunne ikke finde beløbet — indtast det venligst selv', { tone: 'info' });
        } else {
          showToast(`Læste ${label}: ${formatMoney(parsed.amount, currency)}`, { tone: 'success' });
        }
      } catch (scanError) {
        console.error(scanError);
        const message =
          scanError instanceof Error && scanError.message.includes('Canvas')
            ? 'Din browser understøtter ikke billedbehandling. Prøv en anden browser.'
            : 'Tekstgenkendelsen fejlede. Prøv igen med et skarpere billede — eller indtast beløbet manuelt.';
        setError(message);
        setPhase('error');
      }
    },
    [currency, showToast],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') && !/\.(hei[cf]|jpe?g|png|webp)$/i.test(file.name)) {
        showToast('Vælg venligst et billede (jpg, png eller webp)', { tone: 'error' });
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        showToast('Billedet er for stort (maks. 25 MB)', { tone: 'error' });
        return;
      }
      startScan(file);
    },
    [showToast, startScan],
  );

  const tryExample = useCallback(async () => {
    try {
      setProgress({ stage: 'prepare', progress: 0.01, message: 'Henter eksempel-kvittering' });
      setPhase('processing');
      const response = await fetch(`${import.meta.env.BASE_URL}demo/kvittering.jpg`);
      if (!response.ok) throw new Error('Eksempel mangler');
      const blob = await response.blob();
      await startScan(blob, 'eksempel-kvitteringen');
    } catch {
      reset();
      if (state.transactions.length === 0) {
        loadDemoData();
        showToast('Eksempel-kvitteringen kunne ikke hentes — indlæste eksempeldata i stedet', { tone: 'info' });
      } else {
        showToast('Eksempel-kvitteringen kunne ikke hentes', { tone: 'error' });
      }
    }
  }, [loadDemoData, reset, startScan, showToast, state.transactions.length]);

  const save = useCallback(async () => {
    const amount = parseAmountString(form.amount);
    if (!amount || amount <= 0) {
      showToast('Indtast et beløb større end 0', { tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const transaction = await addTransaction({
        amount: Math.round(amount * 100) / 100,
        merchant: form.merchant.trim() || 'Ukendt butik',
        date: form.date || todayISO(),
        category: form.category,
        note: form.note.trim() || undefined,
        items: form.items.length > 0 ? form.items : undefined,
        source: 'scan',
        image: review?.thumbnail,
      });
      showToast(`${formatMoney(transaction.amount, currency)} gemt fra ${transaction.merchant}`, {
        tone: 'success',
        action: {
          label: 'Fortryd',
          run: () => {
            void deleteTransaction(transaction.id);
          },
        },
      });
      reset();
    } finally {
      setSaving(false);
    }
  }, [addTransaction, currency, deleteTransaction, form, reset, review, showToast]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const parsedAmount = parseAmountString(form.amount);
  const itemsSum = Math.round(form.items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const confidence = review ? Math.max(review.parsed.confidence, 0) : 0;
  const confidenceLabel =
    confidence >= 0.8 ? 'Sikker læsning' : confidence >= 0.5 ? 'Tjek beløbet efter' : 'Lav sikkerhed — tjek alt';
  const confidenceTone = confidence >= 0.8 ? 'good' : confidence >= 0.5 ? 'warn' : 'bad';

  return (
    <div className="stack">
      {phase === 'idle' && (
        <>
          <section className="card scan-intro">
            <span className="badge badge-accent">
              <Icon name="scan" size={14} /> Kvitteringsscan
            </span>
            <h2>Scan kvitteringen — vi taster beløbet for dig</h2>
            <p className="muted">
              Tag et billede af bonen, og appen finder selv totalen, datoen, butikken og varelinjerne.
              Du skal kun godkende.
            </p>
          </section>

          <div
            className={`dropzone card ${dragging ? 'dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              handleFiles(event.dataTransfer.files);
            }}
            onClick={() => uploadRef.current?.click()}
          >
            <div className="dropzone-art" aria-hidden="true">
              <div className="scan-frame">
                <div className="scan-line" />
                <Icon name="receipt" size={40} />
              </div>
            </div>
            <h3>Slip billedet her</h3>
            <p className="muted small">eller vælg en fil — jpg, png eller webp</p>
            <div className="dropzone-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  cameraRef.current?.click();
                }}
              >
                <Icon name="camera" size={18} /> Tag billede
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  uploadRef.current?.click();
                }}
              >
                <Icon name="upload" size={18} /> Vælg fil
              </button>
            </div>
          </div>

          <div className="scan-secondary">
            <button type="button" className="card action-card" onClick={tryExample}>
              <span className="mini-icon amber">
                <Icon name="sparkles" size={18} />
              </span>
              <span>
                <strong>Prøv med eksempel</strong>
                <span className="muted small">Se hvordan en scanning virker</span>
              </span>
              <Icon name="arrowRight" size={18} />
            </button>
            <button type="button" className="card action-card" onClick={onManualEntry}>
              <span className="mini-icon violet">
                <Icon name="edit" size={18} />
              </span>
              <span>
                <strong>Indtast manuelt</strong>
                <span className="muted small">Hvis du ikke har bonen</span>
              </span>
              <Icon name="arrowRight" size={18} />
            </button>
            <div className="card privacy-card">
              <span className="mini-icon teal">
                <Icon name="shield" size={18} />
              </span>
              <span>
                <strong>100 % lokalt</strong>
                <span className="muted small">Billedet forlader aldrig din enhed</span>
              </span>
            </div>
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </>
      )}

      {phase === 'processing' && (
        <section className="card processing">
          <div className="processing-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Kvittering der scannes" />
            ) : (
              <div className="processing-placeholder">
                <Icon name="receipt" size={36} />
              </div>
            )}
            <div className="processing-sweep" aria-hidden="true" />
          </div>

          <div className="processing-info">
            <h2>Læser kvitteringen …</h2>
            <p className="muted small">{progress?.message ?? 'Arbejder'}</p>
            <div className="bar bar-lg">
              <div className="bar-fill teal" style={{ width: `${Math.round((progress?.progress ?? 0.02) * 100)}%` }} />
            </div>
            <div className="row-between small muted">
              <span>{Math.round((progress?.progress ?? 0.02) * 100)} %</span>
              <span>Første gang tager det lidt længere</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Annullér
            </button>
          </div>
        </section>
      )}

      {phase === 'error' && (
        <section className="card error-card">
          <span className="mini-icon red">
            <Icon name="alert" size={20} />
          </span>
          <h2>Scanningen lykkedes ikke</h2>
          <p className="muted">{error}</p>
          <div className="row-wrap">
            <button type="button" className="btn btn-primary" onClick={reset}>
              Prøv igen
            </button>
            <button type="button" className="btn btn-ghost" onClick={onManualEntry}>
              Indtast manuelt
            </button>
          </div>
        </section>
      )}

      {phase === 'review' && review && (
        <div className="review-grid">
          <section className="card review-image">
            <header className="card-head">
              <h3>Kvitteringen</h3>
              <CategoryChip id={form.category} subtle />
            </header>
            <div className="review-image-wrap">
              <img src={review.previewUrl} alt="Scannet kvittering" />
            </div>
            <div className={`confidence confidence-${confidenceTone}`}>
              <Icon name={confidence >= 0.5 ? 'check' : 'alert'} size={16} />
              <div>
                <strong>{confidenceLabel}</strong>
                <span className="muted tiny">
                  {Math.round(confidence * 100)} % sikker · OCR-kvalitet {Math.round(review.ocrConfidence * 100)} %
                </span>
              </div>
            </div>
            <button type="button" className="link-btn" onClick={() => setShowRaw((value) => !value)}>
              {showRaw ? 'Skjul' : 'Vis'} den rå OCR-tekst
            </button>
            {showRaw && (
              <>
                <pre className="raw-text">{review.ocrText || '(ingen tekst fundet)'}</pre>
                <div className="signals">
                  {review.parsed.signals.map((signal) => (
                    <span key={signal} className="signal">
                      {signal}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="card review-form">
            <header className="card-head">
              <h3>Kontrollér og gem</h3>
              <button type="button" className="link-btn" onClick={reset}>
                Scan en ny
              </button>
            </header>

            <label className="field field-amount">
              <span>Beløb</span>
              <div className="amount-input">
                <span className="currency">kr</span>
                <input
                  inputMode="decimal"
                  value={form.amount}
                  placeholder="0,00"
                  onChange={(event) => updateForm('amount', event.target.value)}
                  autoComplete="off"
                />
              </div>
            </label>

            <div className="field-row">
              <label className="field">
                <span>Butik</span>
                <input
                  value={form.merchant}
                  placeholder="Fx Netto"
                  onChange={(event) => updateForm('merchant', event.target.value)}
                />
              </label>
              <label className="field">
                <span>Dato</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateForm('date', event.target.value)}
                />
              </label>
            </div>

            <div className="field">
              <span>Kategori</span>
              <div className="category-picker">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`category-option ${form.category === category.id ? 'selected' : ''}`}
                    style={{ ['--chip-color' as string]: category.color }}
                    onClick={() => updateForm('category', category.id)}
                  >
                    <span aria-hidden="true">{category.emoji}</span>
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {form.items.length > 0 && (
              <div className="field">
                <span>
                  Varer ({form.items.length}) ·{' '}
                  <span className="muted">sum {formatMoney(itemsSum, currency)}</span>
                </span>
                <ul className="item-list">
                  {form.items.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      <span>{item.name}</span>
                      <span className="item-amount">{formatMoney(item.amount, currency)}</span>
                      <button
                        type="button"
                        className="icon-btn tiny"
                        aria-label={`Fjern ${item.name}`}
                        onClick={() =>
                          updateForm(
                            'items',
                            form.items.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <label className="field">
              <span>Note (valgfri)</span>
              <input
                value={form.note}
                placeholder="Fx frokost med kollegaer"
                onChange={(event) => updateForm('note', event.target.value)}
              />
            </label>

            <div className="review-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={save} disabled={saving}>
                <Icon name="check" size={18} /> {saving ? 'Gemmer …' : 'Gem udgift'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Annullér
              </button>
            </div>

            {parsedAmount !== null && form.items.length > 0 && Math.abs(parsedAmount - itemsSum) > 1 && (
              <p className="hint warn">
                <Icon name="info" size={14} /> Beløbet ({formatMoney(parsedAmount, currency)}) og summen af varer
                ({formatMoney(itemsSum, currency)}) stemmer ikke helt. Det kan skyldes rabat eller pant.
              </p>
            )}
          </section>
        </div>
      )}

      {phase === 'idle' && state.transactions.length > 0 && (
        <section className="card">
          <header className="card-head">
            <h3>Seneste scanninger</h3>
            <span className="muted small">{state.transactions.filter((txn) => txn.source === 'scan').length} i alt</span>
          </header>
          <ul className="txn-list">
            {state.transactions
              .filter((txn) => txn.source === 'scan')
              .slice(0, 5)
              .map((txn) => (
                <li key={txn.id}>
                  <div className="txn-row static">
                    <span
                      className="category-avatar"
                      style={{
                        background: `color-mix(in srgb, ${getCategory(txn.category).color} 16%, transparent)`,
                        color: getCategory(txn.category).color,
                      }}
                      aria-hidden="true"
                    >
                      {getCategory(txn.category).emoji}
                    </span>
                    <span className="txn-info">
                      <span className="txn-merchant">{txn.merchant}</span>
                      <span className="txn-meta">
                        {formatRelativeDay(txn.date)} · {txn.items?.length ?? 0} varer
                      </span>
                    </span>
                    <span className="txn-amount">{formatMoney(txn.amount, currency)}</span>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
