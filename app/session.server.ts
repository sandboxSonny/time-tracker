import { createCookieSessionStorage, redirect } from "react-router";
import { createHash, timingSafeEqual } from "node:crypto";

const secret = process.env.SESSION_SECRET;
if (!import.meta.env.DEV && (!secret || secret.length < 32)) {
  throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters");
}

/** Shared with other signed cookies (e.g. the Zoho OAuth state). */
export const cookieSecret = secret ?? "dev-only-secret";

const storage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    secrets: [cookieSecret],
    maxAge: 60 * 60 * 24 * 30,
  },
});

const sha = (v: string) => createHash("sha256").update(v).digest();

export function checkPassword(attempt: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD must be set");
  return timingSafeEqual(sha(attempt), sha(expected));
}

// In-memory brute-force limiter: 5 failures per IP, and 50 across all IPs, per 15 minutes.
const WINDOW = 15 * 60_000;
const failures = new Map<string, { count: number; reset: number }>();

// Railway's proxy appends the real client IP as the LAST x-forwarded-for entry; earlier entries are client-supplied.
export function clientIp(request: Request) {
  const parts = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  return parts[parts.length - 1]?.trim() || "unknown";
}

function bump(key: string) {
  const f = failures.get(key);
  if (!f || f.reset <= Date.now()) failures.set(key, { count: 1, reset: Date.now() + WINDOW });
  else f.count++;
}
function over(key: string, max: number) {
  const f = failures.get(key);
  return !!f && f.reset > Date.now() && f.count >= max;
}

export function isLockedOut(ip: string) {
  return over(`ip:${ip}`, 5) || over("global", 50);
}
export function recordFailure(ip: string) {
  const now = Date.now();
  for (const [k, v] of failures) if (v.reset <= now) failures.delete(k);
  bump(`ip:${ip}`);
  bump("global");
}

export async function requireAuth(request: Request) {
  const session = await storage.getSession(request.headers.get("Cookie"));
  if (!session.get("authed")) throw redirect("/login");
}

export async function isAuthed(request: Request) {
  const session = await storage.getSession(request.headers.get("Cookie"));
  return !!session.get("authed");
}

export async function login() {
  const session = await storage.getSession();
  session.set("authed", true);
  return { "Set-Cookie": await storage.commitSession(session) };
}

export async function logout(request: Request) {
  const session = await storage.getSession(request.headers.get("Cookie"));
  return { "Set-Cookie": await storage.destroySession(session) };
}
