"use client";
import {
  Bell, BarChart3, Building2, ChevronDown, Code2, FlaskConical, Globe, Headphones, LayoutDashboard, Lightbulb,
  Menu, MessagesSquare, PhoneCall, Plug, RotateCcw, Settings, Sparkles, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNexa } from "./nexa-context";
import { ago, Badge, Confirm, cx } from "./ui";

export const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/support", label: "Live Support", icon: Headphones },
  { href: "/dashboard/voice", label: "Live Voice", icon: PhoneCall },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/dashboard/research", label: "Customer Research", icon: FlaskConical },
  { href: "/dashboard/intelligence", label: "Intelligence", icon: Sparkles },
  { href: "/dashboard/analytics", label: "Website Analytics", icon: BarChart3 },
  { href: "/dashboard/recommendations", label: "Recommendations", icon: Lightbulb },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
  { href: "/dashboard/sdk", label: "Website SDK", icon: Code2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
        <rect width="24" height="24" rx="6" fill="#6d28d9" />
        <path d="M7 17V7l10 10V7" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cx("text-[17px] font-semibold tracking-tight", dark ? "text-white" : "text-slate-900")}>Nexa</span>
    </span>
  );
}

function useOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onOut]);
  return ref;
}

function Menu_({ trigger, children, align = "right" }: { trigger: ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">{trigger}</button>
      {open && <div className={cx("absolute top-full z-40 mt-1 min-w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg", align === "right" ? "right-0" : "left-0")}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { state, days, setDays, api, refresh, toast, error } = useNexa();
  const [mobileNav, setMobileNav] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const notifications = state?.activity.filter((a) => a.kind === "escalation" || a.kind === "sdk" || a.kind === "insight" || a.kind === "call").slice(0, 8) ?? [];
  const escalated = state?.conversations.filter((c) => c.status === "escalated").length ?? 0;

  const nav = (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV.map((n) => {
        const active = n.href === "/dashboard" ? path === n.href : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} onClick={() => setMobileNav(false)} aria-current={active ? "page" : undefined}
            className={cx("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm", active ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100")}>
            <n.icon size={16} />
            <span className="flex-1">{n.label}</span>
            {n.href === "/dashboard/conversations" && escalated > 0 && <span className="rounded bg-red-500/90 px-1.5 text-[10px] font-semibold text-white">{escalated}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0b1020] py-4">
      <Link href="/" className="mb-6 px-5"><Logo dark /></Link>
      {nav}
      <div className="mt-auto space-y-2 px-5 text-[11px] text-slate-500">
        <div className="rounded-md border border-white/10 p-2.5">
          <p className="font-medium text-amber-300">Demo mode</p>
          <p className="mt-0.5 leading-snug">Synthetic NovaMart data. AI: {state?.aiMode === "live" ? "Claude (live)" : "deterministic demo engine"}. Storage: {state?.persistence === "file" ? "local file" : "memory"}.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">{sidebar}</aside>
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
          <div className="relative h-full w-64">{sidebar}
            <button aria-label="Close menu" onClick={() => setMobileNav(false)} className="absolute right-2 top-3 rounded p-1 text-slate-300"><X size={18} /></button>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:px-5">
          <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={18} /></button>
          <Menu_ align="left" trigger={<><Building2 size={15} className="text-slate-500" /><span className="max-w-32 truncate font-medium">{state?.settings.org.name ?? "NovaMart"}</span><ChevronDown size={14} className="text-slate-400" /></>}>
            {(close) => (
              <div className="text-sm">
                <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Organisation</p>
                <div className="flex items-center justify-between bg-violet-50 px-3 py-2">
                  <span className="font-medium text-violet-800">{state?.settings.org.name ?? "NovaMart"}</span>
                  <Badge tone="violet">{state?.settings.org.industry}</Badge>
                </div>
                <p className="px-3 py-2 text-xs text-slate-500">This demo has one organisation. Switch its industry preset in Settings.</p>
                <Link onClick={close} href="/dashboard/settings" className="block px-3 py-2 text-violet-700 hover:bg-slate-50">Organisation settings →</Link>
              </div>
            )}
          </Menu_>
          <Badge tone="amber" className="hidden sm:inline-flex">Demo mode</Badge>
          <div className="ml-auto flex items-center gap-1">
            <label className="sr-only" htmlFor="date-filter">Date range</label>
            <select id="date-filter" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Menu_ trigger={<span className="relative"><Bell size={17} />{notifications.length > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />}</span>}>
              {(close) => (
                <div className="w-80 max-w-[85vw]">
                  <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Notifications</p>
                  {notifications.length === 0 && <p className="px-3 py-4 text-xs text-slate-500">Nothing new.</p>}
                  {notifications.map((n) => (
                    <button key={n.id} onClick={() => { close(); if (n.href) router.push(n.href); }} className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50">
                      <span className="text-slate-800">{n.text}</span>
                      <span className="mt-0.5 block text-slate-400">{ago(n.at)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Menu_>
            <Menu_ trigger={<span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800">DA</span>}>
              {(close) => (
                <div className="text-sm">
                  <div className="border-b border-slate-100 px-3 py-2"><p className="font-medium">Demo Admin</p><p className="text-xs text-slate-500">admin@novamart.example · Admin</p></div>
                  <Link onClick={close} href="/dashboard/settings" className="block px-3 py-2 hover:bg-slate-50">Settings</Link>
                  <button onClick={() => { close(); setConfirmReset(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"><RotateCcw size={14} />Reset demo data</button>
                  <Link onClick={close} href="/" className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50"><Globe size={14} />Back to website</Link>
                </div>
              )}
            </Menu_>
          </div>
        </header>
        {error && <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">Could not load data: {error}. Retrying…</div>}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} danger confirmLabel="Reset demo"
        title="Reset demo data?" body="This restores the original NovaMart dataset and removes everything created in this demo (conversations, campaigns, SDK events and setting changes)."
        onConfirm={async () => { await api("/api/reset", {}); await refresh(); toast("Demo data reset"); router.push("/dashboard"); }} />
    </div>
  );
}
