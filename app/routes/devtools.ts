// Chrome DevTools probes this URL; answer quietly instead of letting the router log "No route matches".
export function loader() {
  return new Response(null, { status: 404 });
}
