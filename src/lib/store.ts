// Central data-access layer. Demo persistence: a JSON file in .data/, falling back to
// memory when the filesystem is read-only (e.g. serverless).
// ponytail: whole-store JSON rewrite on each change; swap for Supabase/Postgres tables before real traffic.
import fs from "node:fs";
import path from "node:path";
import { buildSeed, STORE_VERSION } from "./seed";
import type { Activity, Store } from "./types";

const FILE = path.join(process.env.NEXA_DATA_DIR || path.join(process.cwd(), ".data"), "store.json");
const g = globalThis as unknown as { __nexa?: { store: Store; persisted: boolean } };

function load(): { store: Store; persisted: boolean } {
  try {
    const s = JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
    if (s.version === STORE_VERSION) return { store: s, persisted: true };
  } catch {}
  const store = buildSeed();
  return { store, persisted: write(store) };
}

function write(store: Store) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store));
    return true;
  } catch (e) {
    console.warn("[nexa] store not persisted, using memory:", (e as Error).message);
    return false;
  }
}

export function db(): Store {
  g.__nexa ??= load();
  return g.__nexa.store;
}

export const persistenceMode = () => (db(), g.__nexa!.persisted ? "file" : "memory");

/** Apply a mutation and persist. */
export function mutate<T>(fn: (s: Store) => T): T {
  const out = fn(db());
  g.__nexa!.persisted = write(g.__nexa!.store);
  return out;
}

export function resetStore() {
  g.__nexa = { store: buildSeed(), persisted: false };
  g.__nexa.persisted = write(g.__nexa.store);
}

export function logActivity(s: Store, a: Omit<Activity, "id" | "at">) {
  s.activity.unshift({ ...a, id: `act-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: new Date().toISOString() });
  s.activity.length = Math.min(s.activity.length, 100);
}

export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
