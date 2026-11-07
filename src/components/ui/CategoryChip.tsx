import type { CategoryId } from '../../types';
import { getCategory } from '../../data/categories';

export function CategoryChip({ id, subtle = false }: { id: CategoryId; subtle?: boolean }) {
  const category = getCategory(id);
  return (
    <span
      className={`chip ${subtle ? 'chip-subtle' : ''}`}
      style={{ ['--chip-color' as string]: category.color }}
    >
      <span aria-hidden="true">{category.emoji}</span>
      {category.name}
    </span>
  );
}

export function CategoryAvatar({ id, size = 40 }: { id: CategoryId; size?: number }) {
  const category = getCategory(id);
  return (
    <span
      className="category-avatar"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${category.color} 18%, transparent)`,
        color: category.color,
        fontSize: size * 0.46,
      }}
      aria-hidden="true"
    >
      {category.emoji}
    </span>
  );
}
