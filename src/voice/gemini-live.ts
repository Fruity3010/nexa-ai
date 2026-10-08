// GeminiLiveVoiceService: the LiveVoiceProvider backed by the Gemini Live API (@google/genai).
// Docs: https://ai.google.dev/gemini-api/docs/live-api — input 16-bit PCM (rate declared in the
// mime type, resampled server-side), output 16-bit PCM at 24 kHz.
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, type LiveServerMessage } from "@google/genai";
import { VOICE_TOOLS } from "../lib/voice/prompt";
import type { LiveVoiceProvider } from "./bridge";

export function geminiLiveProvider(opts: { apiKey: string; model: string }): LiveVoiceProvider {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  return async ({ systemInstruction, voiceName }, h) => {
    const session = await ai.live.connect({
      model: opts.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: VOICE_TOOLS.map((t) => ({ ...t })) }],
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH, // let callers barge in
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW, // don't cut off slow speakers on phone lines
            silenceDurationMs: 600,
          },
        },
        contextWindowCompression: { slidingWindow: {} },
      },
      callbacks: {
        onmessage: (m: LiveServerMessage) => {
          const sc = m.serverContent;
          if (sc?.interrupted) h.onInterrupted();
          for (const part of sc?.modelTurn?.parts ?? []) if (part.inlineData?.data) h.onAudio(Buffer.from(part.inlineData.data, "base64"));
          if (sc?.inputTranscription?.text) h.onTranscript("customer", sc.inputTranscription.text);
          if (sc?.outputTranscription?.text) h.onTranscript("agent", sc.outputTranscription.text);
          if (sc?.turnComplete) h.onTurnComplete();
          if (m.toolCall?.functionCalls?.length)
            h.onToolCall(m.toolCall.functionCalls.map((f) => ({ id: f.id ?? "", name: f.name ?? "", args: (f.args ?? {}) as Record<string, unknown> })));
          if (m.goAway) h.onGoAway();
        },
        onerror: (e: ErrorEvent) => h.onError(new Error(e.message || "Gemini Live socket error")),
        onclose: (e: CloseEvent) => h.onClose(e.reason || `closed (${e.code})`),
      },
    });
    return {
      sendAudio: (pcm16) => session.sendRealtimeInput({ audio: { data: pcm16.toString("base64"), mimeType: "audio/pcm;rate=8000" } }),
      sendText: (text) => session.sendRealtimeInput({ text }),
      sendToolResponses: (functionResponses) => session.sendToolResponse({ functionResponses }),
      close: () => session.close(),
    };
  };
}
