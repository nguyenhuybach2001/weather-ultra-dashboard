export const sensorLabels = { sht45: "Nhiệt độ & độ ẩm · SHT45", bmp390: "Áp suất · BMP390", scd41: "CO₂ · SCD41", sps30: "Bụi · SPS30", veml7700: "Ánh sáng · VEML7700", guva_s12sd: "UV · GUVA-S12SD" };
export type Position = "indoor" | "outdoor";
export type Placement = { mode: Position | "mixed"; sensors: Record<keyof typeof sensorLabels, Position>; camera_sky: boolean; revision?: string; applied_at?: string };
export function normalizePlacement(body: unknown): Placement | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!["indoor", "outdoor", "mixed"].includes(String(b.mode)) || typeof b.camera_sky !== "boolean") return null;
  const sensors: Record<string, Position> = {};
  for (const key of Object.keys(sensorLabels)) {
    const value = b.mode === "mixed" ? (b.sensors as Record<string, unknown> | undefined)?.[key] : b.mode;
    if (value !== "indoor" && value !== "outdoor") return null;
    sensors[key] = value;
  }
  return { mode: b.mode as Placement["mode"], sensors: sensors as Placement["sensors"], camera_sky: b.camera_sky };
}
