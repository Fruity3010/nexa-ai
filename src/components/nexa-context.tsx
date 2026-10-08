"use client";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { NexaState } from "@/lib/analytics";
import { PageSkeleton } from "./loading";
import { useClientValue } from "./ui";

type Toast = { id: number; text: string; tone: "ok" | "error" };
interface Ctx {
  state: NexaState | null;
  error: string | null;
  days: number;
  setDays: (d: number) => void;
  refresh: () => Promise<void>;
  api: <T = unknown>(path: string, body?: unknown, method?: string) => Promise<T>;
  toast: (text: string, tone?: Toast["tone"]) => void;
}

const C = createContext<Ctx | null>(null);
export const useNexa = () => useContext(C)!;
export const useNexaState = () => useContext(C)!.state;

export function NexaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NexaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDaysRaw] = useState(30);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const daysRef = useRef(days);
  // Dashboard data is client-fetched; mounting after hydration avoids server/client markup mismatches.
  const mounted = useClientValue(() => true, false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?days=${daysRef.current}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`State request failed (${res.status})`);
      setState(await res.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const setDays = (d: number) => {
    daysRef.current = d;
    setDaysRaw(d);
    refresh();
  };

  useEffect(() => {
    refresh();
    // Light polling so SDK events and new escalations appear without reloads.
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const api = useCallback(async <T,>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> => {
    const res = await fetch(path, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as { error?: string }).error ?? `Request failed (${res.status})`;
      toast(msg, "error");
      throw new Error(msg);
    }
    return data as T;
  }, [toast]);

  return (
    <C.Provider value={{ state, error, days, setDays, refresh, api, toast }}>
      {mounted ? children : <div className="p-6"><PageSkeleton /></div>}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
            {t.tone === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />}
            <span className="text-slate-800">{t.text}</span>
          </div>
        ))}
      </div>
    </C.Provider>
  );
}
