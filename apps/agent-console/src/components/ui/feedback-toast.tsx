import { useEffect, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";

import { localizeError } from "../../lib/error-localization";
import { cn } from "../../lib/utils";

type FeedbackTone = "success" | "error" | "info" | "warning";

type FeedbackToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: FeedbackTone;
};

type FeedbackToastInput = Omit<FeedbackToastItem, "id">;

let currentToasts: FeedbackToastItem[] = [];
const listeners = new Set<(items: FeedbackToastItem[]) => void>();
const dismissTimers = new Map<string, number>();

function emitToasts() {
  for (const listener of listeners) {
    listener(currentToasts);
  }
}

function dismissToast(id: string) {
  const timer = dismissTimers.get(id);
  if (timer !== undefined) {
    globalThis.clearTimeout(timer);
    dismissTimers.delete(id);
  }
  currentToasts = currentToasts.filter((item) => item.id !== id);
  emitToasts();
}

export function notifyFeedback({ title, description, tone }: FeedbackToastInput) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: FeedbackToastItem = { id, title, description, tone };
  currentToasts = [...currentToasts.slice(-3), item];
  emitToasts();
  const timer = globalThis.setTimeout(() => dismissToast(id), 4200);
  dismissTimers.set(id, timer as unknown as number);
}

export function feedbackErrorMessage(error: unknown, fallback: string) {
  return localizeError(error, fallback).message;
}

export function FeedbackToastViewport() {
  const [items, setItems] = useState<FeedbackToastItem[]>(currentToasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[80] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2">
      {items.map((item) => {
        const icon =
          item.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : item.tone === "error" ? (
            <XCircle className="h-4 w-4" />
          ) : item.tone === "warning" ? (
            <TriangleAlert className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          );

        return (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto rounded-lg border px-3 py-2.5 shadow-[0_8px_24px_rgba(36,36,40,0.08)]",
              item.tone === "success" && "border-emerald-200 bg-emerald-50/95 text-emerald-900",
              item.tone === "error" && "border-red-200 bg-red-50/95 text-red-900",
              item.tone === "warning" && "border-amber-200 bg-amber-50/95 text-amber-900",
              item.tone === "info" && "border-cyan-200 bg-cyan-50/95 text-cyan-900",
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">{icon}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold leading-5">{item.title}</div>
                {item.description ? (
                  <div className="mt-0.5 line-clamp-3 text-xs leading-4 opacity-90">{item.description}</div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => dismissToast(item.id)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-current/70 transition hover:bg-white/60 hover:text-current"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
