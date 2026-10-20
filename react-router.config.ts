import type { Config } from "@react-router/dev/config";

// Behind Railway's proxy the server sees plain http, so a form post from https://<your-domain> would fail React
// Router's origin check (a bare 400 on login). The public host is read at BUILD time from APP_URL and/or the
// RAILWAY_PUBLIC_DOMAIN variable Railway provides, and accepted in addition to the address the server believes it has.
const publicHosts = [process.env.APP_URL, process.env.RAILWAY_PUBLIC_DOMAIN].flatMap((value) => {
  if (!value) return [];
  try {
    return [new URL(value.includes("://") ? value : `https://${value}`).host];
  } catch {
    return [];
  }
});

export default {
  ssr: true,
  allowedActionOrigins: publicHosts,
} satisfies Config;
