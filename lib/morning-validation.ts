export function validMorning(body: Record<string, unknown>) {
  return typeof body.enabled === "boolean" && typeof body.play === "boolean" &&
    typeof body.time_local === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time_local);
}
