// Restrict destinations to known browser push services; never fetch arbitrary subscriber URLs.
export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      !u.port &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname === "web.push.apple.com" ||
        u.hostname.endsWith(".push.apple.com") ||
        u.hostname === "wns.windows.com" ||
        u.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export function validToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
export function validSubscription(
  value: unknown,
): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== "object") return false;
  const s = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  return (
    validPushEndpoint(s.endpoint) &&
    !!s.keys &&
    typeof s.keys.p256dh === "string" &&
    /^[A-Za-z0-9_-]{87}={0,1}$/.test(s.keys.p256dh) &&
    typeof s.keys.auth === "string" &&
    /^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys.auth)
  );
}
export function validNotification(
  value: unknown,
): value is { title: string; body: string; tag?: string; url?: string } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === "string" &&
    v.title.length > 0 &&
    v.title.length <= 100 &&
    typeof v.body === "string" &&
    v.body.length > 0 &&
    v.body.length <= 500 &&
    (v.tag === undefined ||
      (typeof v.tag === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v.tag))) &&
    (v.url === undefined ||
      ["/", "/history", "/camera", "/system", "/settings"].includes(
        v.url as string,
      ))
  );
}
