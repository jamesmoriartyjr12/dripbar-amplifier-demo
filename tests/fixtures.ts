import type { AmplifierJob } from "@/lib/amplifier/interpret";

export const JOB_ID = "a2e4c7f1-3d9b-4e6a-b8c2-1f5d8e3a7b9c";

export function queuedJob(): AmplifierJob {
  return { job_id: JOB_ID, status: "queued", result: null };
}

export function doneJob(level = "consider", issues: string[] = []): AmplifierJob {
  return {
    job_id: JOB_ID,
    status: "done",
    result: {
      signal: { name: "fatigue", label: "Fatigue", level: level as never, flagged: true, score: 0.54 },
      audio_quality: { issues },
    },
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const ENV = { AMPLIFIER_ACCOUNT_ID: "acct-test", AMPLIFIER_API_KEY: "key-test" };
