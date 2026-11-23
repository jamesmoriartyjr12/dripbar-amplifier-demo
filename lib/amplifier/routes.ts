import "server-only";
import { AmplifierError, getJob, readAmplifierConfig, submitSignAnalysis, type AmplifierConfig } from "./adapter";
import { checkPresenterAccess, MAX_AUDIO_BYTES, takeBudget } from "./access";
import { interpretJob } from "./interpret";
import { isSignSlug } from "./signs";

type Env = Record<string, string | undefined>;

const SUBMIT_LIMIT = 12;
const POLL_LIMIT = 200;
const BUDGET_WINDOW_MS = 15 * 60_000;
const JOB_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

function failure(httpStatus: number, status: string, message: string) {
  return Response.json({ analysis: { kind: "failed", status, message } }, { status: httpStatus });
}

function fromError(error: unknown) {
  if (error instanceof AmplifierError) {
    return failure(error.httpStatus && error.httpStatus < 500 ? error.httpStatus : 502, error.status, error.message);
  }
  return failure(500, "adapter error", "Live analysis failed unexpectedly.");
}

function guard(request: Request, env: Env): AmplifierConfig | Response {
  const access = checkPresenterAccess(request, env);
  if (!access.ok) return failure(access.httpStatus, "presenter access required", access.message);
  const config = readAmplifierConfig(env);
  if (!config) return failure(503, "not configured", "Amplifier credentials are not configured on the server.");
  return config;
}

export async function handleAnalyze(request: Request, env: Env = process.env, overrides: Partial<AmplifierConfig> = {}) {
  const guarded = guard(request, env);
  if (guarded instanceof Response) return guarded;

  const form = await request.formData().catch(() => null);
  const sign = form?.get("sign") ?? "fatigue";
  if (!isSignSlug(sign)) return failure(400, "unsupported sign", "That sign is not enabled for this demo.");
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return failure(400, "no audio", "No audio was received.");
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return failure(413, "audio too large", "The recording is larger than this demo accepts.");
  }
  if (!takeBudget("submit", SUBMIT_LIMIT, BUDGET_WINDOW_MS)) {
    return failure(429, "demo limit reached", "Live analysis limit reached for now. Use the labeled sample.");
  }

  try {
    const job = await submitSignAnalysis({ ...guarded, ...overrides }, sign, audio);
    return Response.json({ jobId: job.job_id, analysis: interpretJob(job) });
  } catch (error) {
    return fromError(error);
  }
}

export async function handleJob(
  request: Request,
  jobId: string,
  env: Env = process.env,
  overrides: Partial<AmplifierConfig> = {},
) {
  const guarded = guard(request, env);
  if (guarded instanceof Response) return guarded;
  if (!JOB_ID_PATTERN.test(jobId)) return failure(400, "invalid job id", "That job id is not valid.");
  if (!takeBudget("poll", POLL_LIMIT, BUDGET_WINDOW_MS)) {
    return failure(429, "demo limit reached", "Polling limit reached for now.");
  }

  try {
    const job = await getJob({ ...guarded, ...overrides }, jobId);
    return Response.json({ jobId: job.job_id, analysis: interpretJob(job) });
  } catch (error) {
    return fromError(error);
  }
}
