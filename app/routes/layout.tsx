import { Form, NavLink, Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { listClients, recentClientIds } from "~/db.server";
import { requireAuth } from "~/session.server";
import { LogSheet } from "~/components/LogSheet";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return { clients: listClients().map(({ id, name }) => ({ id, name })), recent: recentClientIds() };
}

const icon = {
  viewBox: "0 0 24 24",
  className: "size-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export default function Layout({ loaderData }: Route.ComponentProps) {
  const dock = ({ isActive }: { isActive: boolean }) => (isActive ? "dock-active" : "");
  const side = ({ isActive }: { isActive: boolean }) => (isActive ? "menu-active" : "");
  return (
    <div className="lg:flex lg:min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-base-300 bg-base-100 p-5 lg:flex">
        <img src="/logo.png" alt="Adams Gas Engineers" className="w-full px-2 pt-2" />
        <ul className="menu w-full gap-1 p-0 text-base">
          <li>
            <NavLink to="/" end className={side}>
              <svg {...icon}>
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              Entries
            </NavLink>
          </li>
          <li>
            <NavLink to="/clients" className={side}>
              <svg {...icon}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
              </svg>
              Clients
            </NavLink>
          </li>
        </ul>
        <Form method="post" action="/logout" className="mt-auto">
          <button className="btn btn-ghost btn-sm w-full justify-start">Sign out</button>
        </Form>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 bg-base-100/90 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg items-center px-4 py-3">
            <h1 className="flex-1">
              <img src="/logo.png" alt="Adams Gas Engineers" className="h-9 w-auto" />
            </h1>
            <Form method="post" action="/logout">
              <button className="btn btn-ghost btn-xs">Sign out</button>
            </Form>
          </div>
        </header>

        <main className="mx-auto max-w-lg space-y-4 p-4 pb-44 lg:max-w-5xl lg:space-y-6 lg:p-10 lg:pb-28">
          <Outlet />
        </main>
      </div>

      <LogSheet clients={loaderData.clients} recent={loaderData.recent} />

      <nav className="dock z-20 bg-base-100 lg:hidden">
        <NavLink to="/" end className={dock}>
          <svg {...icon}>
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          <span className="dock-label">Entries</span>
        </NavLink>
        <NavLink to="/clients" className={dock}>
          <svg {...icon}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
          </svg>
          <span className="dock-label">Clients</span>
        </NavLink>
      </nav>
    </div>
  );
}
