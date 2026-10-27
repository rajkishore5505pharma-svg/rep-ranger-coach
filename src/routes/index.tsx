import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, MessageCircle, Pause, Play, RotateCcw, SwitchCamera, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { angle, initialRepState, step, type FormStatus, type Pt } from "@/lib/pushup";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RageBit — AI Push-Up Counter & Form Tracker" },
      { name: "description", content: "Count push-ups in real time with your phone camera and get live form feedback." },
      { property: "og:title", content: "RageBit — AI Push-Up Counter" },
      { property: "og:description", content: "Real-time push-up rep counting and form checks using your camera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RageBit,
});

type Landmarker = { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: Pt[][] }; close: () => void };

const EDGES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (!navigator.mediaDevices?.getUserMedia) return "Camera isn't available here. Open the app in Chrome over HTTPS.";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access was blocked. Allow the camera in your browser settings — or open the app in its own tab if you're inside a preview.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No matching camera was found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return "Couldn't start the camera. Please try again.";
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
  } catch { /* audio unavailable */ }
}

function RageBit() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<Landmarker | null>(null);
  const stateRef = useRef(initialRepState());
  const runningRef = useRef(false);
  const soundRef = useRef(true);
  const rafRef = useRef(0);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [camOn, setCamOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [reps, setReps] = useState(0);
  const [status, setStatus] = useState<FormStatus>("Get in position");
  const [elbow, setElbow] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    landmarkerRef.current?.close();
  }, []);

  async function loadModel() {
    if (landmarkerRef.current) return;
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    landmarkerRef.current = (await PoseLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    })) as unknown as Landmarker;
  }

  async function startCamera(mode = facing) {
    setError(null);
    setLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setCamOn(true);
      await loadModel();
      cancelAnimationFrame(rafRef.current);
      loop();
    } catch (e) {
      setError(e instanceof Error && e.message === "unsupported" ? cameraErrorMessage(null) : cameraErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function loop() {
    const v = videoRef.current;
    const c = canvasRef.current;
    const lm = landmarkerRef.current;
    if (v && c && lm && v.readyState >= 2) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      const pose = lm.detectForVideo(v, performance.now()).landmarks[0];
      if (pose) {
        const css = getComputedStyle(c);
        const cyan = css.getPropertyValue("--primary").trim();
        const lime = css.getPropertyValue("--secondary").trim();
        ctx.lineWidth = 4;
        ctx.strokeStyle = cyan;
        for (const [a, b] of EDGES) {
          ctx.beginPath();
          ctx.moveTo(pose[a]!.x * c.width, pose[a]!.y * c.height);
          ctx.lineTo(pose[b]!.x * c.width, pose[b]!.y * c.height);
          ctx.stroke();
        }
        ctx.fillStyle = lime;
        for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
          ctx.beginPath();
          ctx.arc(pose[i]!.x * c.width, pose[i]!.y * c.height, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        const vis = (i: number) => pose[i]?.visibility ?? 0;
        const left = vis(11) + vis(13) + vis(15) >= vis(12) + vis(14) + vis(16);
        const [s, e, w, h, an] = left ? [11, 13, 15, 23, 27] : [12, 14, 16, 24, 28];
        const el = angle(pose[s]!, pose[e]!, pose[w]!);
        const body = vis(h) > 0.5 && vis(an) > 0.5 ? angle(pose[s]!, pose[h]!, pose[an]!) : null;
        setElbow(Math.round(el));
        if (runningRef.current) {
          const r = step(stateRef.current, el, body);
          stateRef.current = r.state;
          setStatus(r.state.status);
          if (r.rep) {
            setReps(r.state.reps);
            setPulse((p) => p + 1);
            if (soundRef.current) beep();
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function reset() {
    stateRef.current = initialRepState();
    setReps(0);
    setStatus("Get in position");
  }

  function flip() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (camOn) void startCamera(next);
  }

  const statusTone =
    status === "Good Form" ? "bg-secondary text-secondary-foreground"
    : status === "Get in position" ? "bg-muted text-muted-foreground"
    : "bg-destructive text-destructive-foreground";

  return (
    <div className="rage flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-2xl font-black italic tracking-tight">
          RAGE<span className="text-primary neon-glow">BIT</span>
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Switch camera" onClick={flip}>
            <SwitchCamera />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Open AI chat" asChild>
            <Link to="/chat"><MessageCircle /></Link>
          </Button>
        </div>
      </header>

      <div className="relative mx-4 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`absolute inset-0 h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`}
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`}
        />

        {camOn && (
          <>
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
              <span className={`rounded-full px-3 py-1.5 text-sm font-bold uppercase tracking-wide ${statusTone}`}>
                {status}
              </span>
              {elbow !== null && (
                <span className="rounded-full bg-background/70 px-3 py-1.5 text-sm font-semibold tabular-nums">
                  {elbow}°
                </span>
              )}
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <div key={pulse} className="text-[7rem] leading-none font-black tabular-nums text-primary neon-glow animate-in zoom-in-75 duration-300">
                {reps}
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
                {running ? "reps" : "paused"}
              </div>
            </div>
          </>
        )}

        {!camOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
            <p className="text-lg font-semibold">Prop your phone on the floor, side-on to your body.</p>
            <Button size="lg" className="h-14 rounded-full px-8 text-base font-bold" onClick={() => startCamera()} disabled={loading}>
              <Camera /> {loading ? "Starting…" : "Grant Camera Access"}
            </Button>
            {error && <p className="rounded-xl bg-destructive/15 px-4 py-3 text-sm text-destructive">{error}</p>}
          </div>
        )}
        {camOn && loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 font-semibold">Loading AI model…</div>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4">
        <Button variant="outline" size="icon" className="size-14 rounded-full" aria-label="Reset counter" onClick={reset}>
          <RotateCcw />
        </Button>
        <Button
          size="lg"
          variant={running ? "secondary" : "default"}
          className="h-14 rounded-full text-base font-bold"
          disabled={!camOn || loading}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? <><Pause /> Pause</> : <><Play /> Start Workout</>}
        </Button>
        <Button variant="outline" size="icon" className="size-14 rounded-full" aria-label="Toggle sound" onClick={() => setSound((s) => !s)}>
          {sound ? <Volume2 /> : <VolumeX />}
        </Button>
      </div>
    </div>
  );
}
