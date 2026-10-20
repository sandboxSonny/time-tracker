import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { logout } from "~/session.server";

export async function action({ request }: Route.ActionArgs) {
  return redirect("/login", { headers: await logout(request) });
}
