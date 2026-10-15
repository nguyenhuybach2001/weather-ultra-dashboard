import { configured, database, json } from "@/lib/push-server";
export const runtime = "nodejs";
export async function GET() {
  if (!configured()) return json({ ready: false });
  try {
    const { error } = await database()
      .from("push_subscriptions")
      .select("token_hash")
      .limit(1);
    return json(
      error
        ? { ready: false }
        : { ready: true, publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY },
    );
  } catch {
    return json({ ready: false });
  }
}
