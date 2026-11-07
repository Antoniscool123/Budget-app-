import { useEffect, useState } from 'react';
import { getImage } from '../lib/imageStore';
import type { CategoryId } from '../types';
import { CategoryAvatar } from './ui/CategoryChip';

/** Viser et lille billede af kvitteringen — eller kategori-ikonet som fallback. */
export function ReceiptThumb({ id, category, size = 44 }: { id: string; category: CategoryId; size?: number }) {
  const [src, setSrc] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    getImage(id).then((value) => {
      if (active) setSrc(value);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (!src) return <CategoryAvatar id={category} size={size} />;

  return (
    <img
      className="receipt-thumb"
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
