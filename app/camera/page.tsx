import Link from "next/link";

export default function CameraPage() {
  const cameraUrl =
    process.env.NEXT_PUBLIC_CAMERA_URL ??
    "http://192.168.0.106:5001";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl p-5">

        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              LIVE CAMERA
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Weather Ultra Camera Monitoring
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
          >
            Home
          </Link>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <div className="font-semibold">
                Weather Ultra Camera
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Raspberry Pi 5 • 640×480 • 15 FPS
              </div>
            </div>

            <div className="text-sm font-medium text-emerald-400">
              ● LIVE
            </div>
          </div>

          <div className="flex min-h-[300px] items-center justify-center bg-black">
            <img
              src={`${cameraUrl}/stream`}
              alt="Weather Ultra Live Camera"
              className="h-auto w-full object-contain"
            />
          </div>
        </section>

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
          Camera stream được truyền trực tiếp từ Raspberry Pi.
        </div>

      </div>
    </main>
  );
}
