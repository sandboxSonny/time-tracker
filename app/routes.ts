import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route(".well-known/appspecific/com.chrome.devtools.json", "routes/devtools.ts"),
  route("login", "routes/login.tsx"),
  layout("routes/layout.tsx", [
    index("routes/entries.tsx"),
    route("clients", "routes/clients.tsx"),
    route("export.csv", "routes/export.ts"),
    route("zoho/connect", "routes/zoho.connect.ts"),
    route("zoho/callback", "routes/zoho.callback.ts"),
    route("logout", "routes/logout.ts"),
  ]),
] satisfies RouteConfig;
