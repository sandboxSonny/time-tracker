import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/clients";
import { addClient, deleteClientIfUnused, importClients, listClients, setClientArchived } from "~/db.server";
import { requireAuth } from "~/session.server";
import { disconnectZoho, fetchZohoClientNames, isZohoConnected, missingZohoConfig, ZohoError } from "~/zoho.server";

const ZOHO_NOTICES: Record<string, { error?: boolean; text: string }> = {
  connected: { text: "Connected to Zoho Books. You can now import your clients." },
  denied: { error: true, text: "Zoho Books access was not granted." },
  state: { error: true, text: "The Zoho sign-in expired or was invalid. Please try again." },
  failed: { error: true, text: "Couldn't complete the Zoho connection. Check the setup and try again." },
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const notice = ZOHO_NOTICES[new URL(request.url).searchParams.get("zoho") ?? ""] ?? null;
  return {
    clients: listClients(true),
    zoho: { missing: missingZohoConfig(), connected: isZohoConnected(), notice },
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const form = await request.formData();
  const id = Number(form.get("id"));
  switch (form.get("intent")) {
    case "add": {
      const name = String(form.get("name") ?? "")
        .trim()
        .slice(0, 100);
      if (!name) return { error: "Enter a name." };
      try {
        addClient(name);
      } catch {
        return { error: "That client already exists." };
      }
      return null;
    }
    case "zoho-import": {
      try {
        const { added, existing } = importClients(await fetchZohoClientNames());
        return {
          zohoMessage: `Imported ${added} new client${added === 1 ? "" : "s"} (${existing} already in the list).`,
        };
      } catch (e) {
        if (e instanceof ZohoError) return { zohoError: e.message };
        console.error("Zoho import failed:", e);
        return { zohoError: "Couldn't reach Zoho Books. Try again in a moment." };
      }
    }
    case "zoho-disconnect":
      await disconnectZoho();
      return { zohoMessage: "Disconnected from Zoho Books." };
    case "archive":
      setClientArchived(id, true);
      break;
    case "restore":
      setClientArchived(id, false);
      break;
    case "delete":
      deleteClientIfUnused(id);
      break;
  }
  return null;
}

export default function Clients({ loaderData, actionData }: Route.ComponentProps) {
  const { clients, zoho } = loaderData;
  const importing = useNavigation().formData?.get("intent") === "zoho-import";
  const btn = (intent: string, id: number, label: string, cls = "") => (
    <Form method="post" className="inline">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={id} />
      <button className={`btn btn-ghost btn-xs ${cls}`}>{label}</button>
    </Form>
  );
  return (
    <div className="space-y-4 lg:max-w-2xl lg:space-y-6">
      <h1 className="hidden text-2xl font-bold lg:block">Clients</h1>
      <Form method="post" className="card bg-base-100 shadow-sm" key={clients.length}>
        <input type="hidden" name="intent" value="add" />
        <div className="card-body flex-row items-center gap-3">
          <input name="name" placeholder="New client name" className="input flex-1" required />
          <button className="btn btn-primary">Add</button>
        </div>
        {actionData && "error" in actionData && <p className="px-6 pb-4 text-error text-sm">{actionData.error}</p>}
      </Form>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          {zoho.missing.length ? (
            <p className="text-sm opacity-70">
              Zoho Books isn&apos;t set up yet. Add <code>{zoho.missing.join(" and ")}</code> to the server&apos;s
              environment (see the README), then restart.
            </p>
          ) : zoho.connected ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm opacity-70">Connected to Zoho Books. Existing clients are kept when importing.</p>
              <div className="flex shrink-0 gap-2">
                <Form method="post">
                  <input type="hidden" name="intent" value="zoho-import" />
                  <button className="btn btn-soft" disabled={importing}>
                    {importing && <span className="loading loading-spinner loading-sm" />}
                    Import from Zoho
                  </button>
                </Form>
                <Form method="post" onSubmit={(e) => !confirm("Disconnect from Zoho Books?") && e.preventDefault()}>
                  <input type="hidden" name="intent" value="zoho-disconnect" />
                  <button className="btn btn-ghost text-error">Disconnect</button>
                </Form>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm opacity-70">Connect Zoho Books to import your client list.</p>
              <Form method="post" action="/zoho/connect">
                <button className="btn btn-soft shrink-0">Connect Zoho Books</button>
              </Form>
            </div>
          )}
          {actionData && "zohoMessage" in actionData && (
            <p className="text-sm text-success">{actionData.zohoMessage}</p>
          )}
          {actionData && "zohoError" in actionData && <p className="text-sm text-error">{actionData.zohoError}</p>}
          {!actionData && zoho.notice && (
            <p className={`text-sm ${zoho.notice.error ? "text-error" : "text-success"}`}>{zoho.notice.text}</p>
          )}
        </div>
      </div>
      <ul className="menu w-full rounded-box bg-base-100 shadow-sm">
        {clients.map((c) => (
          <li key={c.id} className="flex-row items-center justify-between">
            <span className={c.archived ? "opacity-50" : ""}>
              {c.name} <span className="badge badge-ghost">{c.entry_count} entries</span>
              {c.archived ? <span className="badge ml-1">archived</span> : null}
            </span>
            <span>
              {c.archived ? btn("restore", c.id, "Restore") : btn("archive", c.id, "Archive")}
              {c.entry_count === 0 && btn("delete", c.id, "Delete", "text-error")}
            </span>
          </li>
        ))}
        {!clients.length && <li className="opacity-60 p-4">No clients yet.</li>}
      </ul>
    </div>
  );
}
