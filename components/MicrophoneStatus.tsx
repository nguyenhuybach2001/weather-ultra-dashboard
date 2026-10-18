"use client";
import { useEffect, useState } from "react";
type Voice = { phase: string; capture_active: boolean; zero_signal: boolean; last_frame_at: string | null; model: string; denoise: string };
type State = { ready: boolean; online: boolean; voice: Voice | null };
export default function MicrophoneStatus() {
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch("/api/voice", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        if (!response.ok) throw new Error();
        const value: State = await response.json();
        if (active) { setState(value); setNow(Date.now()); }
      } catch { if (active) setState({ ready: true, online: false, voice: null }); }
      finally { if (active) timer = setTimeout(poll, 2000); }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, []);
  const v = state?.voice;
  const frameAge = now - Date.parse(v?.last_frame_at || "");
  const receiving = v?.capture_active && frameAge >= -5000 && frameAge < 5000 && !v.zero_signal;
  let label = "Đang kiểm tra mic…", detail = "Mic I²S trên Raspberry Pi", good = false;
  if (state) {
    if (!state.ready) { label = "Chưa cấu hình trạng thái mic"; detail = "Chưa kết nối được dịch vụ trạng thái của trạm."; }
    else if (!state.online) { label = "Trạm mất kết nối"; detail = "Không xác nhận được trạng thái mic hiện tại."; }
    else if (!v) { label = "Chưa có trạng thái mic"; detail = "Cần cập nhật backend Pi và bảng trạng thái trên Supabase."; }
    else if (v.phase === "error") { label = "Mic hoặc dịch vụ giọng nói gặp lỗi"; detail = "Kiểm tra kết nối mic và log backend trên Pi."; }
    else if (v.phase === "disabled") { label = "Trợ lý giọng nói chưa bật"; detail = "Mic chưa được dịch vụ giọng nói sử dụng."; }
    else if (v.phase === "paused") { label = "Đang tạm dừng nghe"; detail = "Loa đang bận hoặc đã tắt tiếng."; }
    else if (v.phase === "speaking") { label = "Đang trả lời"; detail = "Chờ tiếng báo ngắn rồi nói tiếp."; }
    else if (v.phase === "recognizing" || v.phase === "thinking") { label = "Đang xử lý câu hỏi"; detail = "Máy đã thu xong câu nói."; }
    else if (v.zero_signal) { label = "Chưa có tín hiệu âm thanh"; detail = "Luồng thu đang trả về im lặng hoàn toàn. Kiểm tra dây và kênh mic."; }
    else if (receiving) { label = v.phase === "listening" ? "Đang nghe bạn nói" : "Sẵn sàng · Hey Weather"; detail = "Đang nhận dữ liệu âm thanh từ mic."; good = true; }
    else { label = "Đang mở mic"; detail = "Chờ dữ liệu âm thanh để xác nhận mic sẵn sàng."; }
  }
  return <section className="panel microphone-panel" aria-label="Trạng thái mic">
    <div className="mic-heading"><span className="mic-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></span><div><h2>Mic & trợ lý giọng nói</h2><p>Trạng thái do Pi gửi về, cập nhật định kỳ.</p></div></div>
    <div className={`audio-connection ${good ? "is-online" : ""}`} role="status"><strong>{label}</strong><div>{detail}</div></div>
    {state?.online && v && <p>{v.model} · {v.denoise === "fft" ? "Lọc ồn nhẹ: bật" : "Lọc ồn bổ sung: tắt"}</p>}
    <p className="mic-hint">Gọi “Hey Weather” để bắt đầu. Hỏi tiếp sau tiếng báo; nói “thôi nhé” để kết thúc.</p>
  </section>;
}
