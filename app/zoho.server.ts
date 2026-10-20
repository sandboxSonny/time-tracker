// Zoho Books integration: OAuth (authorization code flow) + pulling customer names. Read-only.
// Requires a "Server-based Application" client in the Zoho API Console with the scope ZohoBooks.contacts.READ
// and the redirect URI <APP_URL>/zoho/callback.

import { createCookie } from "react-router";
import { deleteSetting, getSetting, setSetting } from "~/db.server";
import { cookieSecret } from "~/session.server";

const SCOPE = "ZohoBooks.contacts.READ";

const DATA_CENTRES = {
  com: { accounts: "https://accounts.zoho.com", api: "https://www.zohoapis.com" },
  eu: { accounts: "https://accounts.zoho.eu", api: "https://www.zohoapis.eu" },
  in: { accounts: "https://accounts.zoho.in", api: "https://www.zohoapis.in" },
  "com.au": { accounts: "https://accounts.zoho.com.au", api: "https://www.zohoapis.com.au" },
  jp: { accounts: "https://accounts.zoho.jp", api: "https://www.zohoapis.jp" },
  ca: { accounts: "https://accounts.zohocloud.ca", api: "https://www.zohoapis.ca" },
  sa: { accounts: "https://accounts.zoho.sa", api: "https://www.zohoapis.sa" },
} as const;

type DataCentre = keyof typeof DATA_CENTRES;

/** Errors whose message is safe to show to the user. Anything else is logged and replaced with a generic message. */
export class ZohoError extends Error {}

export const stateCookie = createCookie("__zoho_state", {
  httpOnly: true,
  sameSite: "lax",
  path: "/zoho",
  secure: process.env.NODE_ENV === "production",
  secrets: [cookieSecret],
  maxAge: 600,
});

/** Names of the required Zoho environment variables that aren't set. Zoho works once this is empty. */
export function missingZohoConfig() {
  return ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET"].filter((k) => !process.env[k]);
}

export function isZohoConfigured() {
  return missingZohoConfig().length === 0;
}

export function isZohoConnected() {
  return !!getSetting("zoho_refresh_token");
}

function urls() {
  const dc = (process.env.ZOHO_DC ?? "com") as DataCentre;
  if (!(dc in DATA_CENTRES)) throw new ZohoError(`ZOHO_DC must be one of: ${Object.keys(DATA_CENTRES).join(", ")}.`);
  return DATA_CENTRES[dc];
}

function credentials() {
  const { ZOHO_CLIENT_ID: id, ZOHO_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new ZohoError("Zoho Books isn't configured.");
  return { id, secret };
}

/** APP_URL must be set in production (the proxy hides the real https origin from the server). */
function redirectUri(request: Request) {
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
  return `${base}/zoho/callback`;
}

export function buildAuthUrl(request: Request, state: string) {
  const url = new URL(`${urls().accounts}/oauth/v2/auth`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: credentials().id,
    scope: SCOPE,
    redirect_uri: redirectUri(request),
    access_type: "offline", // needed to receive a refresh token
    prompt: "consent",
    state,
  }).toString();
  return url.toString();
}

let cached: { token: string; expires: number } | null = null;

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { id, secret } = credentials();
  const res = await fetch(`${urls().accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) {
    console.error("Zoho token request failed:", res.status, body.error);
    throw new ZohoError("Zoho rejected the request. Check the client ID/secret, redirect URI and data centre.");
  }
  cached = { token: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body;
}

/** Finishes the OAuth flow: swaps the one-time code for tokens and remembers the refresh token. */
export async function connectWithCode(request: Request, code: string) {
  const body = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(request) });
  if (!body.refresh_token) throw new ZohoError("Zoho didn't return a refresh token. Try connecting again.");
  setSetting("zoho_refresh_token", body.refresh_token);
  deleteSetting("zoho_organization_id");
}

export async function disconnectZoho() {
  const token = getSetting("zoho_refresh_token");
  deleteSetting("zoho_refresh_token");
  deleteSetting("zoho_organization_id");
  cached = null;
  if (token) {
    // Best effort: tell Zoho to invalidate it too.
    await fetch(`${urls().accounts}/oauth/v2/token/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  }
}

async function accessToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const refresh = getSetting("zoho_refresh_token");
  if (!refresh) throw new ZohoError("Zoho Books isn't connected.");
  try {
    return (await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh })).access_token!;
  } catch {
    throw new ZohoError("Zoho Books access expired or was revoked. Disconnect and connect again.");
  }
}

async function zohoGet<T extends { code: number; message: string }>(path: string, params: Record<string, string>) {
  const url = new URL(`${urls().api}/books/v3/${path}`);
  url.search = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${await accessToken()}` },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !body || body.code !== 0) {
    console.error("Zoho API request failed:", path, res.status, body?.code, body?.message);
    if (res.status === 401) cached = null;
    throw new ZohoError(`Zoho Books returned an error${body?.message ? `: ${body.message}` : ""}.`);
  }
  return body;
}

/** ZOHO_ORGANIZATION_ID if set, otherwise the account's first organisation (remembered after the first lookup). */
async function organizationId() {
  const fixed = process.env.ZOHO_ORGANIZATION_ID ?? getSetting("zoho_organization_id");
  if (fixed) return fixed;
  const body = await zohoGet<{ code: number; message: string; organizations?: { organization_id: string }[] }>(
    "organizations",
    {},
  );
  const id = body.organizations?.[0]?.organization_id;
  if (!id) throw new ZohoError("No Zoho Books organisation found on this account.");
  setSetting("zoho_organization_id", id);
  return id;
}

type ContactsPage = {
  code: number;
  message: string;
  contacts?: { contact_name?: string }[];
  page_context?: { has_more_page?: boolean };
};

/** Names of all active customers in the Zoho Books organisation. */
export async function fetchZohoClientNames(): Promise<string[]> {
  const organization_id = await organizationId();
  const names = new Set<string>();
  for (let page = 1; page <= 50; page++) {
    const body = await zohoGet<ContactsPage>("contacts", {
      organization_id,
      contact_type: "customer",
      filter_by: "Status.Active",
      per_page: "200",
      page: String(page),
    });
    for (const c of body.contacts ?? []) {
      const name = c.contact_name?.trim();
      if (name) names.add(name.slice(0, 100));
    }
    if (!body.page_context?.has_more_page) break;
  }
  return [...names];
}
