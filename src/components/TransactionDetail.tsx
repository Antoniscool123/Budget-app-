import { useEffect, useState } from 'react';
import type { Transaction } from '../types';
import { useStore } from '../store/StoreProvider';
import { useToast } from '../store/ToastProvider';
import { getImage } from '../lib/imageStore';
import { formatMoney, formatRelativeDay, formatDateLong } from '../lib/format';
import { getCategory } from '../data/categories';
import { Modal } from './ui/Modal';
import { Icon } from './Icon';
import { CategoryChip } from './ui/CategoryChip';

interface TransactionDetailProps {
  transaction: Transaction | null;
  onClose: () => void;
  onEdit: (txn: Transaction) => void;
}

export function TransactionDetail({ transaction, onClose, onEdit }: TransactionDetailProps) {
  const { state, deleteTransaction, addTransaction } = useStore();
  const { showToast } = useToast();
  const currency = state.settings.currency;
  const [image, setImage] = useState<string | undefined>();

  useEffect(() => {
    setImage(undefined);
    if (!transaction) return;
    let active = true;
    getImage(transaction.id).then((value) => {
      if (active) setImage(value);
    });
    return () => {
      active = false;
    };
  }, [transaction]);

  if (!transaction) return null;

  const category = getCategory(transaction.category);
  const itemsTotal = transaction.items?.reduce((sum, item) => sum + item.amount, 0) ?? 0;

  const remove = async () => {
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
      open={Boolean(transaction)}
      onClose={onClose}
      title={transaction.merchant}
      subtitle={formatDateLong(transaction.date)}
      size="md"
      footer={
        <div className="row-between">
          <button type="button" className="btn btn-danger-ghost btn-sm" onClick={remove}>
            <Icon name="trash" size={16} /> Slet
          </button>
          <div className="row-wrap">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Luk
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onEdit(transaction)}>
              <Icon name="edit" size={16} /> Rediger
            </button>
          </div>
        </div>
      }
    >
      <div className="detail-amount">
        <span className="stat-label">{formatRelativeDay(transaction.date)}</span>
        <strong>−{formatMoney(transaction.amount, currency)}</strong>
        <div className="row-wrap">
          <CategoryChip id={transaction.category} subtle />
          <span className={`badge ${transaction.source === 'scan' ? 'badge-accent' : ''}`}>
            <Icon name={transaction.source === 'scan' ? 'scan' : 'edit'} size={13} />
            {transaction.source === 'scan' ? 'Scannet' : 'Manuel'}
          </span>
        </div>
      </div>

      {image && (
        <figure className="detail-image">
          <img src={image} alt={`Kvittering fra ${transaction.merchant}`} />
          <figcaption className="muted tiny">Gemt kvitteringsbillede</figcaption>
        </figure>
      )}

      {transaction.items && transaction.items.length > 0 && (
        <div className="detail-section">
          <h4>Varer</h4>
          <ul className="item-list">
            {transaction.items.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <span>{item.name}</span>
                <span className="item-amount">{formatMoney(item.amount, currency)}</span>
              </li>
            ))}
          </ul>
          {Math.abs(itemsTotal - transaction.amount) > 0.5 && (
            <p className="muted tiny">
              Varelinjer summer til {formatMoney(itemsTotal, currency)} · bilaget er{' '}
              {formatMoney(transaction.amount, currency)}
            </p>
          )}
        </div>
      )}

      {transaction.note && (
        <div className="detail-section">
          <h4>Note</h4>
          <p className="muted small">{transaction.note}</p>
        </div>
      )}

      <div className="detail-section">
        <h4>Kategori</h4>
        <p className="muted small">
          {category.emoji} {category.name}
        </p>
      </div>
    </Modal>
  );
}
