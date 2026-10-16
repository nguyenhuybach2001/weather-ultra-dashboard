"use client";
import { useEffect, useState } from "react";
import { normalizePlacement, Placement, Position, sensorLabels } from "@/lib/placement";
const initial = normalizePlacement({ mode: "indoor", camera_sky: true })!;
const names = { indoor: "Trong nhà", outdoor: "Ngoài trời", mixed: "Lắp hỗn hợp", unknown: "Chưa xác định" };
type Status = { config?: Placement; applied_revision?: string; applied_at?: string };
export default function PlacementSettings() {
  const [config, setConfig] = useState<Placement>(initial);
  const [status, setStatus] = useState<Status | null>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true, initialized = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/placement", { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!active) return;
        setReady(true); setOnline(data.online); setStatus(data.status);
        if (!initialized) {
          initialized = true;
          const saved = normalizePlacement(data.desired?.config);
          if (saved) { setConfig(saved); setRevision(data.desired.revision); }
        }
      } catch { if (active) { setReady(false); setOnline(false); } }
    };
    void poll(); const timer = setInterval(poll, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  async function save() {
    setBusy(true); setMessage(""); setRevision("");
    try {
      const response = await fetch("/api/placement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config), signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRevision(data.revision); setMessage("Đã lưu trên máy chủ. Đang chờ Pi áp dụng…");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không lưu được."); }
    finally { setBusy(false); }
  }
  return <section className="panel placement-panel">
    <div className="eyebrow">BỐ TRÍ THIẾT BỊ</div><h2>Vị trí cảm biến & camera</h2>
    <p>Cho hệ thống biết số đo đến từ trong nhà hay ngoài trời.</p>
    <div className={`audio-connection ${online ? "is-online" : ""}`}>{!ready ? "Cần cấu hình bảng vị trí trên Supabase." : online ? `Pi đã kết nối · Đang áp dụng: ${status?.config?.mode ? names[status.config.mode] || names.unknown : names.unknown}` : "Pi chưa kết nối. Thay đổi chỉ có hiệu lực khi Pi nhận được."}</div>
    <fieldset className="placement-choices" disabled={busy}><legend>Vị trí lắp cảm biến</legend>{(["indoor", "outdoor", "mixed"] as const).map(mode => <label className={`placement-choice ${config.mode === mode ? "selected" : ""}`} key={mode}><input type="radio" name="placement-mode" checked={config.mode === mode} onChange={() => setConfig(c => normalizePlacement({ ...c, mode })!)} /><span>{names[mode]}</span></label>)}</fieldset>
    {config.mode === "mixed" && <div className="placement-sensors">{Object.entries(sensorLabels).map(([key, label]) => <label key={key}>{label}<select value={config.sensors[key as keyof typeof sensorLabels]} disabled={busy} onChange={e => setConfig(c => ({ ...c, sensors: { ...c.sensors, [key]: e.target.value as Position } }))}><option value="indoor">Trong nhà</option><option value="outdoor">Ngoài trời</option></select></label>)}</div>}
    <div className="audio-mute-row"><div><strong>Camera nhìn ra bầu trời</strong><p>Độc lập với vị trí cảm biến. Không tự bật phân tích ảnh.</p></div><button type="button" role="switch" className="audio-switch" aria-label="Camera nhìn ra bầu trời" aria-checked={config.camera_sky} disabled={busy} onClick={() => setConfig(c => ({ ...c, camera_sky: !c.camera_sky }))}><span /></button></div>
    <p className="morning-help">Chọn “Ngoài trời” khi cảm biến thực sự được lắp bên ngoài và che chắn phù hợp. Đổi vị trí không tự hiệu chuẩn cảm biến hoặc làm mô hình dự báo chính xác hơn.</p>
    <button className="primary-button" disabled={!ready || busy} onClick={save}>{busy ? "Đang lưu…" : "Lưu vị trí"}</button>
    <p role="status">{revision && status?.applied_revision === revision ? "Pi đã áp dụng. Mẫu mới được ghi kèm vị trí này." : message || "Lựa chọn trên chưa có hiệu lực cho đến khi lưu và Pi xác nhận."}</p>
    {status?.applied_at && <p className="morning-help">Áp dụng từ {new Date(status.applied_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}. Nhãn dữ liệu cũ được giữ nguyên.</p>}
  </section>;
}
