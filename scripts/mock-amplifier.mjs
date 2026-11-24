// Local stand-in for the Amplifier API so the live path can be exercised without credentials.
// Usage: node scripts/mock-amplifier.mjs [port]
// Behavior is chosen by the API key the app sends:
//   any key        -> job runs once, then finishes with the sign at level "consider"
//   "mock-bad-key" -> 401 UNAUTHORIZED
//   "mock-noisy"   -> finishes with audio_quality issue high_background_noise
//   "mock-failed"  -> job ends with status "failed"
//   "mock-slow"    -> job never leaves "running" (exercises the app's bounded wait)
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.argv[2] ?? 4010);
const jobs = new Map();

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function wavDuration(buffer) {
  const start = buffer.indexOf("RIFF");
  if (start < 0) return null;
  const view = buffer.subarray(start);
  const sampleRate = view.readUInt32LE(24);
  const channels = view.readUInt16LE(22);
  const dataBytes = view.readUInt32LE(40);
  return { sampleRate, channels, seconds: dataBytes / (sampleRate * channels * 2) };
}

createServer(async (req, res) => {
  const key = req.headers["x-api-key"];
  if (!req.headers["x-account-id"] || !key || key === "mock-bad-key") {
    return send(res, 401, { code: "UNAUTHORIZED", message: "Invalid credentials.", status: 401 });
  }

  const analyze = req.url?.match(/^\/v2\/signs\/([a-z-]+)\/analyze$/);
  if (req.method === "POST" && analyze) {
    const body = await readBody(req);
    const wav = wavDuration(body);
    const sign = analyze[1];
    const id = randomUUID();
    jobs.set(id, { sign, key, polls: 0 });
    console.log(`analyze sign=${sign} bytes=${body.length} wav=${JSON.stringify(wav)}`);
    if (wav && wav.seconds < 15) {
      return send(res, 400, { code: "AUDIO_TOO_SHORT", message: "Submit at least 15 seconds.", status: 400 });
    }
    return send(res, 200, { job_id: id, status: "queued", result: null, job_type: "sign", sign_name: sign });
  }

  const poll = req.url?.match(/^\/v2\/jobs\/([A-Za-z0-9-]+)$/);
  if (req.method === "GET" && poll) {
    const job = jobs.get(poll[1]);
    if (!job) return send(res, 404, { code: "NOT_FOUND", message: "Unknown job.", status: 404 });
    job.polls += 1;
    console.log(`poll ${poll[1]} #${job.polls}`);
    if (job.key === "mock-slow" || job.polls < 2) {
      return send(res, 200, { job_id: poll[1], status: "running", result: null });
    }
    if (job.key === "mock-failed") return send(res, 200, { job_id: poll[1], status: "failed", result: null });
    const issues = job.key === "mock-noisy" ? ["high_background_noise"] : [];
    return send(res, 200, {
      job_id: poll[1],
      status: "done",
      result: {
        signal: { name: job.sign, label: job.sign, score: 0.55, level: "consider", flagged: true, recommended_action: "consider" },
        audio_quality: { issues, voice_percentage: 80, audio_clarity: 72 },
      },
    });
  }

  send(res, 404, { code: "NOT_FOUND", message: "Not found.", status: 404 });
}).listen(port, () => console.log(`mock Amplifier listening on http://localhost:${port}`));
