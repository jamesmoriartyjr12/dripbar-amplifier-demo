import type { VoiceAnalysis } from "./interpret";
import type { VoiceRecord } from "@/lib/demo/state";
import type { SignSlug } from "./signs";

export const POLL_INTERVAL_MS = 3000;
export const MAX_WAIT_MS = 45_000;

interface Options {
  presenterKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function toRecord(analysis: VoiceAnalysis | undefined, fallbackStatus: string, sign: SignSlug): VoiceRecord | null {
  if (!analysis) return { source: "live", kind: "failed", status: fallbackStatus, message: "No analysis was returned." };
  switch (analysis.kind) {
    case "pending":
      return null;
    case "signal":
      return { source: "live", kind: "signal", sign, level: analysis.level, issues: analysis.issues };
    case "unsuitable":
      return { source: "live", kind: "unsuitable", sign, level: analysis.level, issues: analysis.issues };
    case "failed":
      return { source: "live", kind: "failed", status: analysis.status, message: analysis.message };
  }
}

async function readAnalysis(response: Response): Promise<{ jobId?: string; analysis?: VoiceAnalysis }> {
  return (await response.json().catch(() => ({}))) as { jobId?: string; analysis?: VoiceAnalysis };
}

/** Submits one recording and polls with a bounded wait. Always resolves to a record. */
export async function analyzeLive(audio: Blob, sign: SignSlug, options: Options = {}): Promise<VoiceRecord> {
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const headers: Record<string, string> = options.presenterKey ? { "x-presenter-key": options.presenterKey } : {};
  const startedAt = now();

  try {
    const form = new FormData();
    form.append("sign", sign);
    form.append("audio", audio, "intake.wav");
    options.onStatus?.("uploading");
    const submitted = await doFetch("/api/amplifier/analyze", {
      method: "POST",
      body: form,
      headers,
      signal: options.signal,
    });
    const first = await readAnalysis(submitted);
    const done = toRecord(first.analysis, `HTTP ${submitted.status}`, sign);
    if (done || !submitted.ok) return done ?? { source: "live", kind: "failed", status: `HTTP ${submitted.status}`, message: "Upload failed." };
    if (!first.jobId) return { source: "live", kind: "failed", status: "no job id", message: "Amplifier did not return a job." };
    if (first.analysis?.kind === "pending") options.onStatus?.(first.analysis.status);

    while (now() - startedAt < MAX_WAIT_MS) {
      await sleep(POLL_INTERVAL_MS);
      if (options.signal?.aborted) break;
      const polled = await doFetch(`/api/amplifier/jobs/${encodeURIComponent(first.jobId)}`, {
        headers,
        signal: options.signal,
        cache: "no-store",
      });
      const body = await readAnalysis(polled);
      const record = toRecord(body.analysis, `HTTP ${polled.status}`, sign);
      if (record) return record;
      if (body.analysis?.kind === "pending") options.onStatus?.(body.analysis.status);
    }
    return {
      source: "live",
      kind: "failed",
      status: `timeout after ${Math.round(MAX_WAIT_MS / 1000)} s`,
      message: "No result arrived within the demo's wait limit.",
    };
  } catch {
    return {
      source: "live",
      kind: "failed",
      status: options.signal?.aborted ? "cancelled" : "network error",
      message: "The live request did not complete.",
    };
  }
}
