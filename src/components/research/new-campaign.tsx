"use client";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { Campaign } from "@/lib/types";
import { useNexa } from "../nexa-context";
import { Button, Field, inputCls, Modal } from "../ui";

const EMPTY = {
  question: "", objective: "", segment: "All customers", channel: "web_chat", targetParticipants: 10, language: "English", lengthMin: 5, retentionDays: 180,
  consentText: "Nexa will ask a few questions on behalf of NovaMart. Your answers are stored for 180 days and used only to improve the service. You can skip any question or stop at any time.",
};
const QUICK = {
  ...EMPTY,
  question: "Why are customers not using our new express checkout feature?",
  objective: "Increase express checkout adoption among signed-in customers.",
  segment: "Signed-in customers who checked out in the last 30 days without using express checkout",
  targetParticipants: 8,
};

export function NewCampaignModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { api, refresh, toast } = useNexa();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY, v: string | number) => setF({ ...f, [k]: v });

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api<{ campaign: Campaign }>("/api/research/campaigns", f);
      await refresh();
      toast("Research campaign created");
      setF(EMPTY);
      onCreated(r.campaign.id);
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New research campaign"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={busy || f.question.trim().length < 8 || f.consentText.trim().length < 10}>Create campaign</Button></>}>
      <button onClick={() => setF(QUICK)} className="mb-4 flex w-full items-start gap-2 rounded-md border border-violet-200 bg-violet-50 p-3 text-left text-sm hover:bg-violet-100">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-violet-700" />
        <span><span className="font-medium text-violet-900">Quick start:</span> <span className="text-violet-800">&ldquo;{QUICK.question}&rdquo;</span></span>
      </button>
      <div className="grid gap-3">
        <Field label="Research question"><input className={inputCls} value={f.question} onChange={(e) => set("question", e.target.value)} placeholder="What do you want to understand?" /></Field>
        <Field label="Business objective"><input className={inputCls} value={f.objective} onChange={(e) => set("objective", e.target.value)} /></Field>
        <Field label="Target customer segment"><input className={inputCls} value={f.segment} onChange={(e) => set("segment", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preferred channel">
            <select className={inputCls} value={f.channel} onChange={(e) => set("channel", e.target.value)}>
              <option value="web_chat">Web chat</option><option value="voice">Voice call</option><option value="whatsapp">WhatsApp</option><option value="email">Email link</option>
            </select>
          </Field>
          <Field label="Participants"><input type="number" min={1} max={500} className={inputCls} value={f.targetParticipants} onChange={(e) => set("targetParticipants", Number(e.target.value))} /></Field>
          <Field label="Interview language">
            <select className={inputCls} value={f.language} onChange={(e) => set("language", e.target.value)}>
              {["English", "Nigerian Pidgin", "Yoruba", "Hausa", "Igbo", "French"].map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Interview length">
            <select className={inputCls} value={f.lengthMin} onChange={(e) => set("lengthMin", Number(e.target.value))}>
              <option value={3}>~3 minutes (3 questions)</option><option value={5}>~5 minutes (4 questions)</option><option value={10}>~10 minutes (6 questions)</option>
            </select>
          </Field>
        </div>
        <Field label="Consent & privacy statement" hint="Shown before any question; nothing is recorded without a yes."><textarea className={inputCls} rows={3} value={f.consentText} onChange={(e) => set("consentText", e.target.value)} /></Field>
        <Field label="Response retention (days)"><input type="number" min={1} max={730} className={inputCls} value={f.retentionDays} onChange={(e) => set("retentionDays", Number(e.target.value))} /></Field>
      </div>
    </Modal>
  );
}
