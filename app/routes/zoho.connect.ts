import { randomBytes } from "node:crypto";
import { redirect } from "react-router";
import type { Route } from "./+types/zoho.connect";
import { requireAuth } from "~/session.server";
import { buildAuthUrl, isZohoConfigured, stateCookie } from "~/zoho.server";

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  if (!isZohoConfigured()) throw new Response("Not found", { status: 404 });
  const state = randomBytes(16).toString("hex");
  return redirect(buildAuthUrl(request, state), { headers: { "Set-Cookie": await stateCookie.serialize(state) } });
}
