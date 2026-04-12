"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  exiting: boolean;
}

interface ToastContextType {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const variantStyles: Record<ToastVariant, string> = {
  success: "border-l-[#34d399]",
  error: "border-l-[#f87171]",
  info: "border-l-[#8b5cf6]",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "\u2713",
  error: "\u2717",
  info: "\u2139",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 250);
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-4), { id, message, variant, exiting: false }]);
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-[200] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 ${variantStyles[t.variant]} bg-[#0a0b0d]/95 backdrop-blur-sm border border-[#1a1b23] shadow-lg max-w-sm ${t.exiting ? "animate-toast-out" : "animate-toast-in"}`}
          >
            <span className="text-sm font-medium opacity-60">{variantIcons[t.variant]}</span>
            <span className="text-sm text-[#e4e4e7] flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-[#71717a] hover:text-[#e4e4e7] text-xs ml-2 transition-colors"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
