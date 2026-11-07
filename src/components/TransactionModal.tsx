import { useEffect, useState } from 'react';
import type { CategoryId, Transaction } from '../types';
import { CATEGORIES } from '../data/categories';
import { useStore } from '../store/StoreProvider';
import { useToast } from '../store/ToastProvider';
import { formatMoney, parseAmountString } from '../lib/format';
import { todayISO } from '../lib/dates';
import { topMerchants } from '../lib/merchants';
import { findDuplicate } from '../lib/duplicates';
import { formatRelativeDay } from '../lib/format';
import { Modal } from './ui/Modal';
import { Icon } from './Icon';

interface TransactionModalProps {
  open: boolean;
  transaction?: Transaction | null;
  onClose: () => void;
}

interface FormState {
  amount: string;
  merchant: string;
  date: string;
  category: CategoryId;
  note: string;
  items: Transaction['items'];
}

const emptyForm = (): FormState => ({
  amount: '',
  merchant: '',
  date: todayISO(),
  category: 'dagligvarer',
  note: '',
  items: [],
});

export function TransactionModal({ open, transaction, onClose }: TransactionModalProps) {
  const { state, addTransaction, updateTransaction, deleteTransaction, rememberMerchantCategory } = useStore();
  const { showToast } = useToast();
  const currency = state.settings.currency;
  const [form, setForm] = useState<FormState>(emptyForm());
  const [duplicate, setDuplicate] = useState<Transaction | null>(null);
  const isEdit = Boolean(transaction);
  const suggestions = transaction ? [] : topMerchants(state.transactions, 6);

  useEffect(() => {
    if (!open) return;
    setDuplicate(null);
    if (transaction) {
      setForm({
        amount: String(transaction.amount).replace('.', ','),
        merchant: transaction.merchant,
        date: transaction.date,
        category: transaction.category,
        note: transaction.note ?? '',
        items: transaction.items,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, transaction]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (force = false) => {
    const amount = parseAmountString(form.amount);
    if (!amount || amount <= 0) {
      showToast('Indtast et beløb større end 0', { tone: 'error' });
      return;
    }
    if (!form.merchant.trim()) {
      showToast('Skriv hvilken butik udgiften er fra', { tone: 'error' });
      return;
    }

    if (!force && !isEdit) {
      const existing = findDuplicate(state.transactions, {
        amount: Math.round(amount * 100) / 100,
        merchant: form.merchant.trim(),
        date: form.date || todayISO(),
      });
      if (existing) {
        setDuplicate(existing);
        return;
      }
    }
    setDuplicate(null);

    const payload = {
      amount: Math.round(amount * 100) / 100,
      merchant: form.merchant.trim(),
      date: form.date || todayISO(),
      category: form.category,
      note: form.note.trim() || undefined,
      items: form.items && form.items.length > 0 ? form.items : undefined,
    };

    if (isEdit && transaction) {
      await updateTransaction(transaction.id, payload);
      showToast('Udgiften er opdateret');
    } else {
      await addTransaction({ ...payload, source: 'manual' });
      showToast(`${formatMoney(payload.amount, currency)} fra ${payload.merchant} gemt`);
    }
    rememberMerchantCategory(payload.merchant, payload.category);
    onClose();
  };

  const remove = async () => {
    if (!transaction) return;
    const snapshot = transaction;
    await deleteTransaction(transaction.id);
    showToast('Udgiften er slettet', {
      tone: 'info',
      action: {
        label: 'Fortryd',
        run: () => {
          void addTransaction({
            amount: snapshot.amount,
            merchant: snapshot.merchant,
            date: snapshot.date,
            category: snapshot.category,
            note: snapshot.note,
            items: snapshot.items,
            source: snapshot.source,
          });
        },
      },
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Rediger udgift' : 'Ny udgift'}
      subtitle={isEdit ? 'Ret beløb, dato eller kategori' : 'Uden kvittering — tast selv beløbet'}
      footer={
        <div className="row-between">
          <div>
            {isEdit && (
              <button type="button" className="btn btn-danger-ghost btn-sm" onClick={remove}>
                <Icon name="trash" size={16} /> Slet
              </button>
            )}
          </div>
          <div className="row-wrap">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annullér
            </button>
            <button type="button" className="btn btn-primary" onClick={() => submit()}>
              <Icon name="check" size={17} /> {isEdit ? 'Gem ændringer' : 'Gem udgift'}
            </button>
          </div>
        </div>
      }
    >
      <label className="field field-amount">
        <span>Beløb</span>
        <div className="amount-input">
          <span className="currency">kr</span>
          <input
            inputMode="decimal"
            value={form.amount}
            placeholder="0,00"
            onChange={(event) => update('amount', event.target.value)}
            autoComplete="off"
          />
        </div>
      </label>

      {suggestions.length > 0 && (
        <div className="field">
          <span>Hurtigt valg</span>
          <div className="filter-row">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.merchant}
                type="button"
                className={`filter-chip ${form.merchant === suggestion.merchant ? 'active' : ''}`}
                onClick={() => {
                  update('merchant', suggestion.merchant);
                  update('category', suggestion.category);
                }}
              >
                {suggestion.merchant}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field-row">
        <label className="field">
          <span>Butik</span>
          <input
            value={form.merchant}
            placeholder="Fx Netto"
            onChange={(event) => update('merchant', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Dato</span>
          <input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} />
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
              onClick={() => update('category', category.id)}
            >
              <span aria-hidden="true">{category.emoji}</span>
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {duplicate && (
        <div className="duplicate-warning" role="alert">
          <Icon name="alert" size={17} />
          <div>
            <strong>Det ligner en dublet</strong>
            <p className="muted tiny">
              Du har allerede {formatMoney(duplicate.amount, currency)} fra {duplicate.merchant} den{' '}
              {formatRelativeDay(duplicate.date)}.
            </p>
            <div className="row-wrap">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => submit(true)}>
                Gem alligevel
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDuplicate(null)}>
                Fortryd
              </button>
            </div>
          </div>
        </div>
      )}

      <label className="field">
        <span>Note (valgfri)</span>
        <input
          value={form.note}
          placeholder="Fx frokost med kollegaer"
          onChange={(event) => update('note', event.target.value)}
        />
      </label>
    </Modal>
  );
}
