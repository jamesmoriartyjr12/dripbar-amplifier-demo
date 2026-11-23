import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJob, readAmplifierConfig, submitSignAnalysis, AmplifierError } from "@/lib/amplifier/adapter";
import { interpretJob, promotesQuestion } from "@/lib/amplifier/interpret";
import { handleAnalyze, handleJob } from "@/lib/amplifier/routes";
import { checkPresenterAccess, resetBudgets } from "@/lib/amplifier/access";
import { analyzeLive } from "@/lib/amplifier/client";
import { doneJob, ENV, JOB_ID, json, queuedJob } from "./fixtures";

const config = { accountId: "acct-test", apiKey: "key-test", baseUrl: "https://amp.test" };

function audioForm(bytes = 1000) {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(bytes)], { type: "audio/wav" }), "intake.wav");
  return form;
}

describe("interpretJob", () => {
  it("routes a usable consider-level fatigue signal to the low-energy question", () => {
    const analysis = interpretJob(doneJob("consider"));
    expect(analysis).toEqual({ kind: "signal", level: "consider", issues: [] });
    expect(promotesQuestion(analysis)).toBe(true);
  });

  it("keeps the standard order for none and low", () => {
    expect(promotesQuestion(interpretJob(doneJob("none")))).toBe(false);
    expect(promotesQuestion(interpretJob(doneJob("low")))).toBe(false);
  });

  it("treats audio quality issues and inconclusive as unsuitable", () => {
    expect(interpretJob(doneJob("consider", ["high_background_noise"])).kind).toBe("unsuitable");
    expect(interpretJob(doneJob("inconclusive")).kind).toBe("unsuitable");
  });

  it("reports failed and timed-out jobs with their actual status", () => {
    expect(interpretJob({ job_id: JOB_ID, status: "failed", result: null })).toMatchObject({ kind: "failed", status: "job failed" });
    expect(interpretJob({ job_id: JOB_ID, status: "timed-out", result: null })).toMatchObject({ status: "job timed-out" });
    expect(interpretJob(queuedJob())).toEqual({ kind: "pending", status: "queued" });
  });
});

describe("adapter", () => {
  it("reads config only when both server variables are set", () => {
    expect(readAmplifierConfig({})).toBeNull();
    expect(readAmplifierConfig({ AMPLIFIER_ACCOUNT_ID: "a" })).toBeNull();
    expect(readAmplifierConfig(ENV)?.baseUrl).toBe("https://api.amplifierhealth.com");
  });

  it.each(["fatigue", "dehydration", "stress", "anxiety", "mood-disruption"] as const)("submits multipart audio to /v2/signs/%s/analyze with auth headers", async (sign) => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(`https://amp.test/v2/signs/${sign}/analyze`);
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-Account-ID"]).toBe("acct-test");
      expect(headers["X-API-Key"]).toBe("key-test");
      const body = init?.body as FormData;
      expect(body.get("audio")).toBeInstanceOf(Blob);
      return json(queuedJob());
    });
    const job = await submitSignAnalysis({ ...config, fetchImpl: fetchImpl as typeof fetch }, sign, new Blob(["x"]));
    expect(job.status).toBe("queued");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("refuses signs outside the demo's five", async () => {
    const fetchImpl = vi.fn();
    await expect(
      submitSignAnalysis({ ...config, fetchImpl: fetchImpl as typeof fetch }, "head-impact" as never, new Blob(["x"])),
    ).rejects.toMatchObject({ status: "unsupported sign" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("polls GET /v2/jobs/{job_id}", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe(`https://amp.test/v2/jobs/${JOB_ID}`);
      return json(doneJob());
    });
    const job = await getJob({ ...config, fetchImpl: fetchImpl as typeof fetch }, JOB_ID);
    expect(job.result?.signal?.level).toBe("consider");
  });

  it("maps bad credentials to an error carrying the HTTP status and code", async () => {
    const fetchImpl = async () => json({ code: "UNAUTHORIZED", message: "Invalid key", status: 401 }, 401);
    await expect(getJob({ ...config, fetchImpl }, JOB_ID)).rejects.toMatchObject({
      status: "HTTP 401 UNAUTHORIZED",
      httpStatus: 401,
    });
  });

  it("maps a hung request to a timeout", async () => {
    const fetchImpl = (_: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")));
      });
    const error = await getJob({ ...config, fetchImpl: fetchImpl as typeof fetch, timeoutMs: 20 }, JOB_ID).catch((e) => e);
    expect(error).toBeInstanceOf(AmplifierError);
    expect(error.status).toBe("request timeout");
  });
});

describe("route handlers", () => {
  beforeEach(() => resetBudgets());

  it("requires presenter access: localhost only unless a presenter key is set", () => {
    expect(checkPresenterAccess(new Request("http://localhost:3000/x"), {}).ok).toBe(true);
    expect(checkPresenterAccess(new Request("https://demo.example.com/x"), {}).ok).toBe(false);
    const keyed = { DEMO_PRESENTER_KEY: "sunday" };
    expect(checkPresenterAccess(new Request("https://demo.example.com/x"), keyed).ok).toBe(false);
    expect(
      checkPresenterAccess(new Request("https://demo.example.com/x", { headers: { "x-presenter-key": "sunday" } }), keyed).ok,
    ).toBe(true);
  });

  it("refuses when credentials are not configured", async () => {
    const response = await handleAnalyze(new Request("http://localhost/api", { method: "POST", body: audioForm() }), {});
    expect(response.status).toBe(503);
    expect((await response.json()).analysis.status).toBe("not configured");
  });

  it("rejects oversized audio before calling upstream", async () => {
    const fetchImpl = vi.fn();
    const response = await handleAnalyze(
      new Request("http://localhost/api", { method: "POST", body: audioForm(4 * 1024 * 1024) }),
      ENV,
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(response.status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns only the interpreted analysis, never raw scores", async () => {
    const submitted = await handleAnalyze(
      new Request("http://localhost/api", { method: "POST", body: audioForm() }),
      ENV,
      { fetchImpl: (async () => json(queuedJob())) as typeof fetch },
    );
    expect(await submitted.json()).toEqual({ jobId: JOB_ID, analysis: { kind: "pending", status: "queued" } });

    const polled = await handleJob(new Request("http://localhost/api"), JOB_ID, ENV, {
      fetchImpl: (async () => json(doneJob())) as typeof fetch,
    });
    const body = await polled.json();
    expect(body.analysis).toEqual({ kind: "signal", level: "consider", issues: [] });
    expect(JSON.stringify(body)).not.toContain("score");
  });

  it("surfaces upstream bad credentials with the real status", async () => {
    const response = await handleAnalyze(
      new Request("http://localhost/api", { method: "POST", body: audioForm() }),
      ENV,
      { fetchImpl: (async () => json({ code: "UNAUTHORIZED", message: "bad" }, 401)) as typeof fetch },
    );
    expect(response.status).toBe(401);
    expect((await response.json()).analysis.status).toBe("HTTP 401 UNAUTHORIZED");
  });

  it("forwards the requested sign and rejects unknown ones", async () => {
    const seen: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      seen.push(String(url));
      return json(queuedJob());
    }) as typeof fetch;
    const form = audioForm();
    form.append("sign", "stress");
    await handleAnalyze(new Request("http://localhost/api", { method: "POST", body: form }), ENV, { fetchImpl });
    expect(seen).toEqual(["https://api.amplifierhealth.com/v2/signs/stress/analyze"]);

    const bad = audioForm();
    bad.append("sign", "substance-use-pattern");
    const response = await handleAnalyze(new Request("http://localhost/api", { method: "POST", body: bad }), ENV, { fetchImpl });
    expect(response.status).toBe(400);
  });

  it("validates job ids", async () => {
    const response = await handleJob(new Request("http://localhost/api"), "../../etc", ENV);
    expect(response.status).toBe(400);
  });
});

describe("browser client polling", () => {
  function clock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  }

  it("polls until done and returns a live signal", async () => {
    const responses = [
      json({ jobId: JOB_ID, analysis: { kind: "pending", status: "queued" } }),
      json({ jobId: JOB_ID, analysis: { kind: "pending", status: "running" } }),
      json({ jobId: JOB_ID, analysis: { kind: "signal", level: "consider", issues: [] } }),
    ];
    const fetchImpl = vi.fn(async () => responses.shift()!);
    const record = await analyzeLive(new Blob(["x"]), "fatigue", { fetchImpl: fetchImpl as typeof fetch, ...clock() });
    expect(record).toEqual({ source: "live", kind: "signal", sign: "fatigue", level: "consider", issues: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("stops after the bounded wait", async () => {
    const fetchImpl = vi.fn(async () => json({ jobId: JOB_ID, analysis: { kind: "pending", status: "running" } }));
    const record = await analyzeLive(new Blob(["x"]), "fatigue", { fetchImpl: fetchImpl as typeof fetch, ...clock() });
    expect(record).toMatchObject({ kind: "failed", status: "timeout after 45 s" });
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(16);
  });

  it("passes through a failed submit status", async () => {
    const fetchImpl = async () =>
      json({ analysis: { kind: "failed", status: "HTTP 401 UNAUTHORIZED", message: "bad" } }, 401);
    const record = await analyzeLive(new Blob(["x"]), "fatigue", { fetchImpl: fetchImpl as typeof fetch, ...clock() });
    expect(record).toMatchObject({ kind: "failed", status: "HTTP 401 UNAUTHORIZED" });
  });
});
