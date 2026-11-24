import "server-only";
import { timingSafeEqual } from "node:crypto";

type Env = Record<string, string | undefined>;

export const PRESENTER_KEY_HEADER = "x-presenter-key";
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export type AccessResult = { ok: true } | { ok: false; httpStatus: number; message: string };

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Live analysis is limited to the presenter: either a matching DEMO_PRESENTER_KEY header,
 * or, when no key is configured, requests addressed to this machine.
 */
export function checkPresenterAccess(request: Request, env: Env = process.env): AccessResult {
  const key = env.DEMO_PRESENTER_KEY?.trim();
  if (key) {
    const provided = request.headers.get(PRESENTER_KEY_HEADER) ?? "";
    return safeEqual(provided, key)
      ? { ok: true }
      : { ok: false, httpStatus: 403, message: "Presenter key required for live analysis." };
  }
  return isLocalRequest(request)
    ? { ok: true }
    : { ok: false, httpStatus: 403, message: "Live analysis is only available on the presenter's machine." };
}

function hostname(value: string): string {
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return "";
  }
}

const LOOPBACK_IPS = /^(127\.|::1$|::ffff:127\.)/;

function isLocalRequest(request: Request): boolean {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? new URL(request.url).host;
  if (!LOCAL_HOSTS.has(hostname(host.split(",")[0].trim()))) return false;
  const forwardedFor = headers.get("x-forwarded-for");
  if (!forwardedFor) return true;
  return forwardedFor.split(",").every((ip) => LOOPBACK_IPS.test(ip.trim()));
}

interface Window {
  startedAt: number;
  count: number;
}

const windows = new Map<string, Window>();

/** Small in-memory budget so a demo can't run up unbounded upstream calls. */
export function takeBudget(bucket: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = windows.get(bucket);
  if (!current || now - current.startedAt > windowMs) {
    windows.set(bucket, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function resetBudgets() {
  windows.clear();
}
