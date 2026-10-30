"use client";

import * as React from "react";
import { AlertCircle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; tone?: Tone }) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}

const TONE_STYLES: Record<Tone, { icon: React.ReactNode; ring: string }> = {
  success: {
    icon: <Check className="h-4 w-4 text-ok" />,
    ring: "border-ok-border",
  },
  error: {
    icon: <AlertCircle className="h-4 w-4 text-risk" />,
    ring: "border-risk-border",
  },
  info: {
    icon: <Info className="h-4 w-4 text-info" />,
    ring: "border-blue-200",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback<ToastContextValue["toast"]>(
    ({ title, description, tone = "info" }) => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-3), { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), 4600);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-lift animate-fade-up",
              TONE_STYLES[item.tone].ring,
            )}
          >
            <span className="mt-0.5">{TONE_STYLES[item.tone].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-5 text-ink">
                {item.title}
              </p>
              {item.description ? (
                <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded-md p-1 text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink"
              aria-label="关闭提示"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
