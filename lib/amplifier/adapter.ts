import "server-only";
import type { AmplifierJob } from "./interpret";
import { isSignSlug, type SignSlug } from "./signs";

export const DEFAULT_BASE_URL = "https://api.amplifierhealth.com";
const REQUEST_TIMEOUT_MS = 15_000;

export interface AmplifierConfig {
  accountId: string;
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Env = Record<string, string | undefined>;

export function readAmplifierConfig(env: Env = process.env): AmplifierConfig | null {
  const accountId = env.AMPLIFIER_ACCOUNT_ID?.trim();
  const apiKey = env.AMPLIFIER_API_KEY?.trim();
  if (!accountId || !apiKey) return null;
  return {
    accountId,
    apiKey,
    baseUrl: (env.AMPLIFIER_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

/** Error surfaced to the presenter with the upstream status, never the payload. */
export class AmplifierError extends Error {
  constructor(
    public readonly status: string,
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "AmplifierError";
  }
}

async function call(config: AmplifierConfig, path: string, init: RequestInit): Promise<unknown> {
  const doFetch = config.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        "X-Account-ID": config.accountId,
        "X-API-Key": config.apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(config.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new AmplifierError(
      timedOut ? "request timeout" : "network error",
      timedOut ? "Amplifier did not respond in time." : "Could not reach Amplifier.",
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const err = (body ?? {}) as { code?: unknown; message?: unknown };
    const code = typeof err.code === "string" ? err.code : "ERROR";
    const message = typeof err.message === "string" ? err.message : `Amplifier returned HTTP ${response.status}.`;
    throw new AmplifierError(`HTTP ${response.status} ${code}`, message, response.status);
  }
  return body;
}

function asJob(body: unknown): AmplifierJob {
  const job = body as Partial<AmplifierJob> | null;
  if (!job || typeof job.job_id !== "string" || typeof job.status !== "string") {
    throw new AmplifierError("invalid response", "Amplifier returned an unexpected response.");
  }
  return { job_id: job.job_id, status: job.status, result: job.result ?? null };
}

export async function submitSignAnalysis(config: AmplifierConfig, sign: SignSlug, audio: Blob): Promise<AmplifierJob> {
  if (!isSignSlug(sign)) throw new AmplifierError("unsupported sign", "That sign is not enabled for this demo.");
  const form = new FormData();
  form.append("audio", audio, "intake.wav");
  return asJob(await call(config, `/v2/signs/${sign}/analyze`, { method: "POST", body: form }));
}

export async function getJob(config: AmplifierConfig, jobId: string): Promise<AmplifierJob> {
  return asJob(await call(config, `/v2/jobs/${encodeURIComponent(jobId)}`, { method: "GET" }));
}
