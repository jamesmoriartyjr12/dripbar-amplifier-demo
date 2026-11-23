export type SignalLevel = "none" | "low" | "consider" | "moderate" | "elevated" | "inconclusive";

export type JobStatus = "queued" | "running" | "done" | "failed" | "timed-out";

export interface AmplifierSignal {
  name: string;
  label: string;
  level: SignalLevel;
  flagged?: boolean;
  recommended_action?: string;
  score?: number;
}

export interface AmplifierJob {
  job_id: string;
  status: JobStatus;
  result: {
    signal?: AmplifierSignal;
    audio_quality?: { issues?: string[] };
  } | null;
}

/**
 * The only shape that crosses from the server adapter to the browser.
 * Raw scores, narratives and vocal features stay on the server.
 */
export type VoiceAnalysis =
  | { kind: "pending"; status: "queued" | "running" }
  | { kind: "signal"; level: SignalLevel; issues: string[] }
  | { kind: "unsuitable"; level: SignalLevel | null; issues: string[] }
  | { kind: "failed"; status: string; message: string };

const ROUTABLE_LEVELS: SignalLevel[] = ["none", "low", "consider", "moderate", "elevated"];

export function interpretJob(job: AmplifierJob): VoiceAnalysis {
  if (job.status === "queued" || job.status === "running") {
    return { kind: "pending", status: job.status };
  }
  if (job.status === "failed" || job.status === "timed-out") {
    return { kind: "failed", status: `job ${job.status}`, message: `Amplifier job ended with status "${job.status}".` };
  }
  if (job.status !== "done") {
    return { kind: "failed", status: `job ${String(job.status)}`, message: "Unexpected job status." };
  }

  const signal = job.result?.signal;
  const issues = job.result?.audio_quality?.issues ?? [];
  if (!signal || !signal.level) {
    return { kind: "failed", status: "job done without signal", message: "The job finished without a signal." };
  }
  if (issues.length > 0 || !ROUTABLE_LEVELS.includes(signal.level)) {
    return { kind: "unsuitable", level: signal.level, issues };
  }
  return { kind: "signal", level: signal.level, issues };
}

/** A flagged level (consider and above) promotes the sign's question to the top of intake. */
export function promotesQuestion(analysis: { kind: string; level?: SignalLevel | null } | null): boolean {
  return (
    analysis?.kind === "signal" &&
    (analysis.level === "consider" || analysis.level === "moderate" || analysis.level === "elevated")
  );
}

export const LEVEL_LABELS: Record<SignalLevel, string> = {
  none: "Within normal range",
  low: "Faint indicator",
  consider: "Worth considering",
  moderate: "Notable indicator",
  elevated: "Significant indicator",
  inconclusive: "Analysis inconclusive",
};

export const ISSUE_LABELS: Record<string, string> = {
  poor_voice_quality: "voice quality was low",
  insufficient_speech: "not enough continuous speech",
  high_background_noise: "too much background noise",
  invalid_speaker: "no clear single speaker",
};
