"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { label } from "./ui";

// Validated reference categorical order (dataviz skill palette). Color follows the entity, never rank.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
export const CHANNEL_COLOR: Record<string, string> = { chat: SERIES[0], whatsapp: SERIES[1], voice: SERIES[2], email: SERIES[3] };
// Diverging pair blue <-> red with a neutral gray midpoint.
export const SENTIMENT_COLOR: Record<string, string> = { positive: "#2a78d6", neutral: "#b9b8b2", negative: "#e34948" };
const ACCENT = "#6d28d9";
const axis = { stroke: "#94a3b8", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = { contentStyle: { borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px rgba(15,23,42,.08)" }, labelStyle: { color: "#0f172a", fontWeight: 600 } };
const shortDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function VolumeChart({ data }: { data: Record<string, number | string>[] }) {
  const keys = ["chat", "whatsapp", "voice", "email"];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={28} {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} formatter={(v, n) => [v, label(String(n))]} />
        <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-slate-600">{label(v)}</span>} />
        {keys.map((k) => <Area isAnimationActive={false} key={k} type="monotone" dataKey={k} stackId="1" stroke={CHANNEL_COLOR[k]} strokeWidth={2} fill={CHANNEL_COLOR[k]} fillOpacity={0.18} />)}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, colors, onSelect }: { data: { name: string; value: number }[]; colors: Record<string, string>; onSelect?: (name: string) => void }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="h-40 w-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="#fff" strokeWidth={2}
              onClick={(d) => onSelect?.(String((d as { name?: string }).name))} className={onSelect ? "cursor-pointer" : undefined}>
              {data.map((d) => <Cell key={d.name} fill={colors[d.name] ?? "#94a3b8"} />)}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`, label(String(n))]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name}>
            <button onClick={() => onSelect?.(d.name)} disabled={!onSelect} className="flex w-full items-center gap-2 text-left enabled:hover:text-violet-700">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[d.name] }} />
              <span className="flex-1 truncate text-slate-700">{label(d.name)}</span>
              <span className="tabular-nums text-slate-900">{d.value}</span>
              <span className="w-10 text-right tabular-nums text-xs text-slate-500">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBar({ data, onSelect, height }: { data: { name: string; value: number }[]; onSelect?: (name: string) => void; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(120, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={150} tickFormatter={label} {...axis} tick={{ fill: "#475569", fontSize: 12 }} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "#f5f3ff" }} labelFormatter={(l) => label(String(l))} formatter={(v) => [v, "Count"]} />
        <Bar isAnimationActive={false} dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={18} onClick={(d) => onSelect?.(String((d as { name?: string }).name))} className={onSelect ? "cursor-pointer" : undefined}
          label={{ position: "right", fontSize: 11, fill: "#475569" }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLines({ data, keys, names }: { data: Record<string, number | string>[]; keys: string[]; names: Record<string, string> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="week" {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltipStyle} labelFormatter={(l) => `Week of ${l}`} formatter={(v, n) => [v, names[String(n)] ?? n]} />
        <Legend iconType="plainline" formatter={(v) => <span className="text-xs text-slate-600">{names[v] ?? v}</span>} />
        {keys.map((k, i) => <Line isAnimationActive={false} key={k} type="monotone" dataKey={k} stroke={SERIES[i % 4]} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Spark({ data, dataKey, color = ACCENT, height = 120, xKey = "date" }: { data: Record<string, number | string>[]; dataKey: string; color?: string; height?: number; xKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey={xKey} tickFormatter={(d) => (xKey === "date" ? shortDate(String(d)) : String(d))} minTickGap={28} {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltipStyle} labelFormatter={(l) => (xKey === "date" ? shortDate(String(l)) : String(l))} />
        <Area isAnimationActive={false} type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={color} fillOpacity={0.12} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Before/after impact: measured baseline from demo data, then an illustrative projection. */
export function ImpactChart({ baseline, projected, unit }: { baseline: number[]; projected: number[]; unit: string }) {
  const data = [
    ...baseline.map((v, i) => ({ week: `W-${baseline.length - i}`, baseline: v, projected: null as number | null })),
    ...projected.map((v, i) => ({ week: `W+${i + 1}`, baseline: null as number | null, projected: v })),
  ];
  data[baseline.length - 1].projected = baseline.at(-1)!;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="week" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => `${v}${unit}`} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v}${unit}`, n === "baseline" ? "Baseline (demo dataset)" : "Illustrative projection"]} />
        <Legend formatter={(v) => <span className="text-xs text-slate-600">{v === "baseline" ? "Baseline (demo dataset)" : "Illustrative projection, not measured"}</span>} />
        <Line isAnimationActive={false} dataKey="baseline" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
        <Line isAnimationActive={false} dataKey="projected" stroke={ACCENT} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, strokeDasharray: "0" }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SentimentBar({ counts }: { counts: Record<string, number> }) {
  const keys = ["positive", "neutral", "negative"];
  const total = keys.reduce((s, k) => s + (counts[k] ?? 0), 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded" role="img" aria-label={keys.map((k) => `${k} ${counts[k] ?? 0}`).join(", ")}>
        {keys.map((k) => <div key={k} title={`${label(k)}: ${counts[k] ?? 0}`} style={{ width: `${((counts[k] ?? 0) / total) * 100}%`, background: SENTIMENT_COLOR[k] }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {keys.map((k) => (
          <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SENTIMENT_COLOR[k] }} />{label(k)} <span className="tabular-nums text-slate-900">{counts[k] ?? 0}</span> ({Math.round(((counts[k] ?? 0) / total) * 100)}%)</span>
        ))}
      </div>
    </div>
  );
}

export function FunnelBars({ steps, selected, onSelect }: { steps: { step: string; label: string; sessions: number; conversionPct: number; dropPct: number }[]; selected?: string; onSelect?: (step: string) => void }) {
  const max = steps[0]?.sessions || 1;
  const worst = steps.slice(1).reduce((w, s) => (s.dropPct > w.dropPct ? s : w), steps[1] ?? steps[0]);
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <li key={s.step}>
          <button onClick={() => onSelect?.(s.step)} disabled={!onSelect} aria-pressed={selected === s.step}
            className={`group w-full rounded-md px-2 py-1.5 text-left ${selected === s.step ? "bg-violet-50 ring-1 ring-violet-300" : onSelect ? "hover:bg-slate-50" : ""}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">{i + 1}. {s.label}</span>
              <span className="tabular-nums text-slate-600">{s.sessions.toLocaleString()} sessions · {s.conversionPct}%</span>
            </div>
            <div className="mt-1 h-2.5 w-full rounded bg-slate-100">
              <div className="h-full rounded" style={{ width: `${(s.sessions / max) * 100}%`, background: s.step === worst.step ? "#e34948" : ACCENT }} />
            </div>
            {i > 0 && <p className={`mt-0.5 text-[11px] ${s.step === worst.step ? "font-medium text-red-700" : "text-slate-500"}`}>−{s.dropPct}% from previous step{s.step === worst.step ? " · largest drop-off" : ""}</p>}
          </button>
        </li>
      ))}
    </ol>
  );
}
