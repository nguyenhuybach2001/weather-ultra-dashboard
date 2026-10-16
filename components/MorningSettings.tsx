"use client";
import { useEffect, useState } from "react";
type Config = { enabled: boolean; time_local: string; revision: string };
type Status = { applied_revision?: string; result?: string; bulletin?: string; last_attempt_at?: string };
export default function MorningSettings() {
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState("07:00");
  const [status, setStatus] = useState<Status | null>(null);
  const [online, setOnline] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState("");
  useEffect(() => {
    let active = true, initialized = false;
    async function poll() {
      try {
        const response = await fetch("/api/morning", { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error();
        const data: { desired?: Config; status?: Status; online: boolean } = await response.json();
        if (!active) return;
        setReady(true); setOnline(data.online); setStatus(data.status || null);
        if (!initialized) {
          initialized = true;
          if (data.desired) {
            setEnabled(data.desired.enabled); setHour(data.desired.time_local);
          }
        }
      } catch { if (active) { setReady(false); setOnline(false); } }
    }
    void poll(); const timer = setInterval(poll, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  async function save(play: boolean) {
    setBusy(true); setMessage(""); setRevision("");
    try {
      const response = await fetch("/api/morning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, time_local: hour, play }), signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRevision(data.revision); setMessage("Đã lưu trên máy chủ. Đang chờ Pi nhận lịch…");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không lưu được lịch."); }
    finally { setBusy(false); }
  }
  return <section className="panel morning-panel">
    <div className="eyebrow">CHUẨN BỊ CHO NGÀY MỚI</div><h2>Bản tin cảm biến buổi sáng</h2>
    <p>Nghe nhiệt độ, độ ẩm, áp suất tại trạm và xu hướng gần đây. Chưa có mô hình AI dự báo mưa được kiểm chứng.</p>
    <div className={`audio-connection ${online ? "is-online" : ""}`}>{!ready ? "Cần kết nối bảng lịch đọc trên Supabase." : online ? "Pi đã kết nối lịch đọc" : "Pi chưa kết nối lịch đọc. Lịch mới sẽ áp dụng khi Pi nhận được."}</div>
    <div className="audio-mute-row"><div><strong>Đọc mỗi ngày</strong><p>Giọng nữ tiếng Việt · dùng âm lượng loa tại trạm</p></div><button type="button" className="audio-switch" role="switch" aria-label="Đọc dự báo mỗi ngày" aria-checked={enabled} disabled={busy} onClick={() => setEnabled(!enabled)}><span /></button></div>
    <label className="field">Giờ đọc · giờ Việt Nam (UTC+7)<input type="time" value={hour} onChange={e => setHour(e.target.value)} disabled={busy} /></label>
    <div className="button-row"><button className="primary-button" disabled={!ready || !hour || busy} onClick={() => save(false)}>Lưu lịch đọc</button><button className="secondary-button" disabled={!ready || !online || !hour || busy} onClick={() => save(true)}>Lưu & đọc ngay</button></div>
    <p role="status">{revision && status?.applied_revision === revision ? "Pi đã nhận lịch đọc." : message}</p>
    {status?.result && <p>{status.result}{status.last_attempt_at && ` · ${new Date(status.last_attempt_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`}</p>}
    {status?.bulletin && <details><summary>Nội dung bản tin gần nhất</summary><p>{status.bulletin}</p></details>}
    <p className="morning-help">Pi cần bật, có số đo mới và Internet để tạo giọng đọc. Không phát bù sau giờ hẹn quá 5 phút. Tắt tiếng sẽ bỏ qua lần đọc. Dữ liệu từ cảm biến tại trạm, không lấy dự báo Internet.</p>
  </section>;
}
