/*!
 * Nexa Website SDK — consent-aware customer journey events.
 * Never collects form values, keystrokes, passwords, card data or query strings.
 * Every public method is wrapped so a failure can never break the host page.
 */
declare const __NEXA_VERSION__: string;

type Props = Record<string, string | number | boolean>;
interface NexaEvent { name: string; ts: number; path: string; sessionId?: string; props: Props }
interface Config {
  projectKey: string;
  endpoint?: string;
  autoTrack?: boolean | { pageViews?: boolean; errors?: boolean; rageClicks?: boolean; forms?: boolean };
  requireConsent?: boolean;
  respectDoNotTrack?: boolean;
  anonymousSession?: boolean;
  debug?: boolean;
}

(function () {
  const w = window as unknown as { Nexa?: { version?: string }; NexaConfig?: Config };
  if (w.Nexa && w.Nexa.version) return; // already loaded

  const VERSION = __NEXA_VERSION__;
  const MAX_QUEUE = 100, BATCH = 20, FLUSH_MS = 5000, MAX_RETRIES = 3, MAX_ERRORS_PER_PAGE = 10;
  const NAME_RX = /^[a-z][a-z0-9_]{1,63}$/;
  const SENSITIVE = /pass|card|cvv|cvc|token|secret|auth|email|phone|bvn|ssn|otp|^pin$/i;

  const cfg: Config = w.NexaConfig || ({} as Config);
  const script = document.currentScript as HTMLScriptElement | null;
  const endpoint = cfg.endpoint || (script && script.src ? new URL("/api/sdk/events", script.src).href : "/api/sdk/events");
  const auto = cfg.autoTrack === false ? {} : typeof cfg.autoTrack === "object" ? cfg.autoTrack : { pageViews: true, errors: true, rageClicks: true, forms: true };
  const requireConsent = cfg.requireConsent !== false;
  const log = (...a: unknown[]) => { if (cfg.debug) console.info("[nexa]", ...a); };

  const store = {
    get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} },
  };

  let consent = store.get("nexa_consent") as "granted" | "denied" | null;
  const privacySignal = cfg.respectDoNotTrack !== false &&
    (navigator.doNotTrack === "1" || (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

  const canTrack = () => {
    if (!cfg.projectKey) return false;
    if (consent === "denied") return false;
    if (consent === "granted") return true;
    return !requireConsent && !privacySignal;
  };

  function sessionId(): string | undefined {
    if (cfg.anonymousSession === false) return undefined;
    try {
      let id = sessionStorage.getItem("nexa_sid");
      if (!id) {
        const b = new Uint8Array(12);
        crypto.getRandomValues(b);
        id = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
        sessionStorage.setItem("nexa_sid", id);
      }
      return id;
    } catch { return undefined; }
  }

  /** Path only, with identifier-like segments (emails, long tokens, numbers) redacted. */
  function safePath(p = location.pathname) {
    return p.split("/").map((s) => (/@/.test(s) || /^[A-Za-z0-9_-]{24,}$/.test(s) || /^\d{4,}$/.test(s) ? ":id" : s)).join("/").slice(0, 300);
  }

  function sanitize(props?: Record<string, unknown>): Props {
    const out: Props = {};
    if (!props || typeof props !== "object") return out;
    let n = 0;
    for (const k in props) {
      if (n >= 20) break;
      const v = props[k];
      if (!/^[a-z0-9_]{1,40}$/i.test(k) || SENSITIVE.test(k)) continue;
      if (typeof v === "string") out[k] = v.slice(0, 200);
      else if ((typeof v === "number" && isFinite(v)) || typeof v === "boolean") out[k] = v;
      else continue;
      n++;
    }
    return out;
  }

  let queue: NexaEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sending = false;

  function enqueue(name: string, props?: Record<string, unknown>) {
    if (!canTrack()) return log("dropped (no consent)", name);
    if (!NAME_RX.test(name)) return log("invalid event name", name);
    if (queue.length >= MAX_QUEUE) queue.shift(); // bounded: drop oldest
    queue.push({ name, ts: Date.now(), path: safePath(), sessionId: sessionId(), props: sanitize(props) });
    if (queue.length >= BATCH) flush();
    else if (!timer) timer = setTimeout(flush, FLUSH_MS);
  }

  function payload(events: NexaEvent[]) {
    return JSON.stringify({ projectKey: cfg.projectKey, sdkVersion: VERSION, sentAt: Date.now(), events });
  }

  async function flush(attempt = 0): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    if (sending || !queue.length || !canTrack()) return;
    const batch = queue.splice(0, BATCH);
    sending = true;
    try {
      // text/plain is a CORS-safelisted type: no preflight needed.
      const res = await fetch(endpoint, { method: "POST", body: payload(batch), headers: { "Content-Type": "text/plain" }, keepalive: true, credentials: "omit" });
      sending = false;
      if (res.status >= 500 || res.status === 429) throw new Error("retryable " + res.status);
      if (!res.ok) log("rejected", res.status); // 4xx: don't retry
    } catch (e) {
      sending = false;
      if (attempt < MAX_RETRIES) {
        queue = batch.concat(queue).slice(0, MAX_QUEUE);
        setTimeout(() => flush(attempt + 1), 1000 * 2 ** attempt + Math.random() * 500);
        return;
      }
      log("giving up after retries", e);
      return;
    }
    if (queue.length) flush();
  }

  function beaconFlush() {
    if (!queue.length || !canTrack()) return;
    try {
      const ok = navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([payload(queue.splice(0, BATCH))], { type: "text/plain" }));
      if (!ok) flush();
    } catch {}
  }

  const safe = <A extends unknown[], R>(fn: (...a: A) => R) => (...a: A): R | undefined => { try { return fn(...a); } catch (e) { log("error", e); return undefined; } };

  // ---------------------------------------------------------------- auto tracking
  let lastPath = "";
  const pageView = () => {
    const p = safePath();
    if (p === lastPath) return;
    lastPath = p;
    enqueue("page_view", { referrer_host: document.referrer ? new URL(document.referrer).host : "", viewport: innerWidth < 768 ? "mobile" : "desktop" });
  };

  function setupAuto() {
    if (auto.pageViews) {
      pageView();
      for (const m of ["pushState", "replaceState"] as const) {
        const orig = history[m];
        history[m] = function (this: History, ...args: Parameters<History["pushState"]>) {
          const r = orig.apply(this, args);
          setTimeout(safe(pageView), 0);
          return r;
        } as History["pushState"];
      }
      addEventListener("popstate", safe(pageView));
    }

    if (auto.errors) {
      let count = 0;
      const scrub = (s: string) => s.replace(/\S+@\S+/g, "[email]").replace(/\d{4,}/g, "[n]").slice(0, 200);
      addEventListener("error", safe((ev: ErrorEvent) => {
        if (++count > MAX_ERRORS_PER_PAGE || !ev.message) return;
        let source = "";
        try { source = ev.filename ? new URL(ev.filename).pathname : ""; } catch {}
        enqueue("js_error", { message: scrub(ev.message), source, line: ev.lineno || 0 });
      }));
      addEventListener("unhandledrejection", safe((ev: PromiseRejectionEvent) => {
        if (++count > MAX_ERRORS_PER_PAGE) return;
        const r = ev.reason;
        enqueue("js_error", { message: scrub(String((r && r.message) || r || "Unhandled rejection")), kind: "promise" });
      }));
    }

    if (auto.rageClicks) {
      let last: { el: Element | null; t: number; n: number; reported: boolean } = { el: null, t: 0, n: 0, reported: false };
      addEventListener("click", safe((ev: MouseEvent) => {
        const el = ev.target as Element | null;
        const now = Date.now();
        if (el === last.el && now - last.t < 700) last.n++;
        else last = { el, t: now, n: 1, reported: false };
        last.t = now;
        if (last.n >= 3 && !last.reported && el) {
          last.reported = true;
          // Describe the element structurally only; never its text content.
          const target = el.getAttribute("data-nexa-id") ? `[data-nexa-id=${el.getAttribute("data-nexa-id")}]` :
            el.id ? `#${el.id}` : el.tagName.toLowerCase() + (el.classList[0] ? `.${el.classList[0]}` : "");
          enqueue("rage_click", { target: target.slice(0, 80), clicks: last.n });
        }
      }), true);
    }

    if (auto.forms) {
      const started = new Set<HTMLFormElement>(), submitted = new Set<HTMLFormElement>();
      const formName = (f: HTMLFormElement) => (f.getAttribute("data-nexa-form") || f.id || f.getAttribute("name") || "form").slice(0, 60);
      addEventListener("focusin", safe((ev: FocusEvent) => {
        const f = (ev.target as HTMLElement | null)?.closest?.("form") as HTMLFormElement | null;
        if (!f || started.has(f) || f.hasAttribute("data-nexa-ignore")) return;
        started.add(f);
        enqueue("form_start", { form: formName(f) });
      }), true);
      addEventListener("submit", safe((ev: SubmitEvent) => {
        const f = ev.target as HTMLFormElement;
        if (!started.has(f) || f.hasAttribute("data-nexa-ignore")) return;
        submitted.add(f);
        enqueue("form_submit", { form: formName(f) });
      }), true);
      // Abandonment: started but not submitted when the page is hidden for good.
      addEventListener("pagehide", safe(() => {
        started.forEach((f) => { if (!submitted.has(f) && f.isConnected) enqueue("form_abandon", { form: formName(f) }); });
        started.clear();
      }));
    }
  }

  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") beaconFlush(); });
  addEventListener("pagehide", beaconFlush);

  // ---------------------------------------------------------------- public API
  const api = {
    version: VERSION,
    track: safe((name: string, props?: Record<string, unknown>) => enqueue(name, props)),
    feature: safe((feature: string, props?: Record<string, unknown>) => enqueue("feature_used", { ...props, feature })),
    setConsent: safe((value: "granted" | "denied") => {
      consent = value === "granted" ? "granted" : "denied";
      store.set("nexa_consent", consent);
      if (consent === "denied") queue = [];
      else { lastPath = ""; if (auto.pageViews) pageView(); }
    }),
    optOut: safe(() => {
      consent = "denied";
      store.set("nexa_consent", "denied");
      queue = [];
      try { sessionStorage.removeItem("nexa_sid"); } catch {}
    }),
    getConsent: () => consent || (canTrack() ? "not_required" : "unknown"),
    flush: safe(() => flush()),
  };
  w.Nexa = api;

  try {
    setupAuto();
    log("ready", VERSION, endpoint);
    dispatchEvent(new CustomEvent("nexa:ready", { detail: { version: VERSION } }));
  } catch (e) { log("init failed", e); }
})();
