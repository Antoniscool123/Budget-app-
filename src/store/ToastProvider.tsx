import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; run: () => void };
}

interface ToastValue {
  showToast: (message: string, options?: { tone?: ToastTone; action?: Toast['action']; duration?: number }) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback<ToastValue['showToast']>(
    (message, options = {}) => {
      counter.current += 1;
      const id = counter.current;
      const toast: Toast = {
        id,
        message,
        tone: options.tone ?? 'success',
        action: options.action,
      };
      setToasts((prev) => [...prev.slice(-2), toast]);
      window.setTimeout(() => dismiss(id), options.duration ?? 4600);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span className="toast-icon" aria-hidden="true">
              {toast.tone === 'success' ? '✓' : toast.tone === 'error' ? '!' : 'i'}
            </span>
            <span className="toast-message">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.run();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Luk">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast skal bruges inden i ToastProvider');
  return ctx;
}
