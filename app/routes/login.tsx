import { Form, redirect } from "react-router";
import type { Route } from "./+types/login";
import { checkPassword, clientIp, isAuthed, isLockedOut, login, recordFailure } from "~/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (await isAuthed(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const ip = clientIp(request);
  if (isLockedOut(ip)) return { error: "Too many attempts. Try again in 15 minutes." };
  const form = await request.formData();
  if (!checkPassword(String(form.get("password") ?? ""))) {
    recordFailure(ip);
    return { error: "Incorrect password." };
  }
  return redirect("/", { headers: await login() });
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-sm bg-base-100 shadow">
        <Form method="post" className="card-body">
          <img src="/logo.png" alt="Adams Gas Engineers" className="mx-auto mb-2 h-16 w-auto" />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="input input-bordered w-full"
            autoFocus
            required
          />
          {actionData?.error && <p className="text-error text-sm">{actionData.error}</p>}
          <button className="btn btn-primary">Sign in</button>
        </Form>
      </div>
    </main>
  );
}
