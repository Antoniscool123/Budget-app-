import type { ReactNode } from 'react';

export function EmptyState({
  emoji,
  title,
  description,
  children,
}: {
  emoji: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-emoji" aria-hidden="true">
        {emoji}
      </div>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}
