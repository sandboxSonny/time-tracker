import { timingSafeEqual } from "node:crypto";
import { redirect } from "react-router";
import type { Route } from "./+types/zoho.callback";
import { requireAuth } from "~/session.server";
import { connectWithCode, stateCookie } from "~/zoho.server";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const params = new URL(request.url).searchParams;
  const expected = (await stateCookie.parse(request.headers.get("Cookie"))) as string | null;
  const headers = { "Set-Cookie": await stateCookie.serialize("", { maxAge: 0 }) };
  const fail = (reason: string) => redirect(`/clients?zoho=${reason}`, { headers });

  if (params.get("error")) return fail("denied");
  const state = params.get("state");
  const code = params.get("code");
  if (!expected || !state || !code || !same(expected, state)) return fail("state");

  try {
    await connectWithCode(request, code);
  } catch (e) {
    console.error("Zoho connect failed:", e);
    return fail("failed");
  }
  return redirect("/clients?zoho=connected", { headers });
}
