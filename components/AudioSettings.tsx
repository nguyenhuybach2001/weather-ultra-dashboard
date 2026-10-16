"use client";
import { useEffect, useState } from "react";
type State = { ready: boolean; online?: boolean; desired?: { revision: string }; status?: { volume: number; muted: boolean; applied_revision?: string; test_result?: string } };
export default function AudioSettings() {
  const [state, setState] = useState<State>({ ready: false });
  const [volume, setVolume] = useState(70);
  const [muted, setMuted] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState("");
  useEffect(() => {
    let active = true, initialized = false;
    async function poll() {
      try {
        const response = await fetch("/api/audio", { cache: "no-store", signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error();
        const data: State = await response.json();
        if (!active) return;
        setState(data);
        if (!initialized && data.status) {
          setVolume(data.status.volume); setMuted(data.status.muted); initialized = true;
        }
      } catch { if (active) setState({ ready: true, online: false }); }
    }
    void poll();
    const timer = setInterval(poll, 4000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  async function save(test: boolean) {
    setBusy(true); setMessage(""); setRevision("");
    try {
      const response = await fetch("/api/audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ volume, muted, code, test }), signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRevision(data.revision);
      setMessage("Đã gửi. Đang chờ Pi xác nhận…");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không gửi được lệnh."); }
    finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>Loa tại trạm</h2>
    <p>Điều chỉnh giọng đọc phát trên Raspberry Pi.</p>
    <div className="notice">{!state.ready ? "Chưa cấu hình dịch vụ điều khiển loa." : state.online ? `Pi đã kết nối · Mức đang áp dụng: ${state.status?.muted ? "Tắt tiếng" : `${state.status?.volume}%`}` : "Pi offline hoặc chưa kết nối dịch vụ loa."}</div>
    <label className="field">Âm lượng: {volume}%
      <input aria-label="Âm lượng loa Pi" type="range" min="0" max="100" value={volume} onChange={e => setVolume(Number(e.target.value))} disabled={!state.online || busy} />
    </label>
    <label><input type="checkbox" checked={muted} onChange={e => setMuted(e.target.checked)} disabled={!state.online || busy} /> Tắt tiếng</label>
    <label className="field">Mã điều khiển loa<input type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} placeholder="Mã riêng của chủ trạm" /></label>
    <div className="button-row">
      <button className="primary-button" onClick={() => save(false)} disabled={!state.online || busy || !code}>Lưu âm lượng</button>
      <button className="secondary-button" onClick={() => save(true)} disabled={!state.online || busy || !code || muted || volume === 0}>Lưu & phát thử</button>
    </div>
    <p role="status">{revision && state.status?.applied_revision === revision ? "Pi đã áp dụng thiết lập." : message}</p>
    {state.status?.test_result && <p>Lần phát thử gần nhất: {state.status.test_result}</p>}
  </section>;
}
