import {
  configured,
  database,
  hash,
  json,
  readBody,
  sameOrigin,
} from "@/lib/push-server";
import { validSubscription, validToken } from "@/lib/push-validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!configured()) return json({ error: "Push is not configured" }, 503);
  if (!sameOrigin(request)) return json({ error: "Forbidden origin" }, 403);
  let body;
  try {
    body = (await readBody(request)) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body || !validToken(body.token) || !validSubscription(body.subscription))
    return json({ error: "Invalid subscription" }, 400);
  const { error } = await database()
    .from("push_subscriptions")
    .upsert(
      {
        token_hash: hash(body.token),
        endpoint: body.subscription.endpoint,
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
        device_id: "weather-ultra-01",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token_hash" },
    );
  // Endpoint uniqueness prevents one token from taking over another browser's subscription.
  return error
    ? json({ error: "Could not save subscription" }, 500)
    : json({ ok: true });
}
export async function DELETE(request: Request) {
  if (!configured()) return json({ error: "Push is not configured" }, 503);
  if (!sameOrigin(request)) return json({ error: "Forbidden origin" }, 403);
  let body;
  try {
    body = (await readBody(request)) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body || !validToken(body.token))
    return json({ error: "Invalid management token" }, 400);
  const { error } = await database()
    .from("push_subscriptions")
    .delete()
    .eq("token_hash", hash(body.token));
  return error
    ? json({ error: "Could not remove subscription" }, 500)
    : json({ ok: true });
}
