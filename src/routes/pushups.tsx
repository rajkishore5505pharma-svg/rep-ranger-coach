import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, History, MessageCircle, Mic, MicOff, Pause, Play, RotateCcw, Save, SwitchCamera, Volume2, VolumeX } from "lucide-react";
import { createGate, cuesFor, speak, unlockSpeech } from "@/lib/voice-coach";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { MIN_DEPTH, initialRepState, measurePose, smoothPose, step, type FormStatus, type Pt } from "@/lib/pushup";
import { emptyBadges, saveWorkout, tallyBadge } from "@/lib/history";

export const Route = createFileRoute("/pushups")({
  head: () => ({
    meta: [
      { title: "Push-Up Tracker — RageBit" },
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
  const smoothedRef = useRef<(Pt | null)[]>([]);
  const lastVideoTimeRef = useRef(-1);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [camOn, setCamOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [reps, setReps] = useState(0);
  const [status, setStatus] = useState<FormStatus>("Get in position");
  const [elbow, setElbow] = useState<number | null>(null);
  const [hipAngle, setHipAngle] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);
  const [depth, setDepth] = useState(0);
  const badgesRef = useRef(emptyBadges());
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  const [voiceOn, setVoiceOn] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const voiceOnRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const gateRef = useRef(createGate());
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {
      const en = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
      setVoices(en);
      setVoiceName((cur) => cur || localStorage.getItem("ragebit-voice") || en.find((v) => v.lang === "en-US")?.name || en[0]?.name || "");
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  useEffect(() => {
    voiceRef.current = voices.find((v) => v.name === voiceName) ?? null;
    if (voiceName) localStorage.setItem("ragebit-voice", voiceName);
  }, [voices, voiceName]);
  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    unlockSpeech();
    if (next) speak("Voice coach on.", voiceRef.current, true);
    else window.speechSynthesis?.cancel();
  }
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
      smoothedRef.current = [];
      lastVideoTimeRef.current = -1;
      const v = videoRef.current;
      if (!v) { stream.getTracks().forEach((t) => t.stop()); return; }
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
    if (v && c && lm && v.readyState >= 2 && v.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = v.currentTime;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }
      ctx.clearRect(0, 0, c.width, c.height);
      const raw = lm.detectForVideo(v, performance.now()).landmarks[0];
      const pose = raw ? smoothPose(smoothedRef.current, raw, c.width / c.height) : [];
      smoothedRef.current = pose;
      const measurement = measurePose(pose);
      setElbow(measurement ? Math.round(measurement.elbow) : null);
      setHipAngle(measurement?.hip ? Math.round(measurement.hip.angle) : null);
      if (raw) {

        // Neon green skeleton for solid form, neon red when orientation or plank form breaks.
        const broken = measurement?.sideView === false || measurement?.hip?.break != null;
        const css = getComputedStyle(c);
        const cyan = css.getPropertyValue("--primary").trim();
        const lime = css.getPropertyValue("--secondary").trim();
        const red = css.getPropertyValue("--destructive").trim();
        ctx.lineWidth = 4;
        ctx.strokeStyle = broken ? red : measurement ? lime : cyan;
        for (const [a, b] of EDGES) {
          const start = pose[a], end = pose[b];
          if (!start || !end) continue;
          ctx.beginPath();
          ctx.moveTo(start.x * c.height, start.y * c.height);
          ctx.lineTo(end.x * c.height, end.y * c.height);
          ctx.stroke();
        }
        ctx.fillStyle = broken ? red : lime;
        for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
          const point = pose[i];
          if (!point) continue;
          ctx.beginPath();
          ctx.arc(point.x * c.height, point.y * c.height, 6, 0, Math.PI * 2);
          ctx.fill();
        }

      }
        if (runningRef.current) {
          const r = step(stateRef.current, measurement);
          badgesRef.current = tallyBadge(badgesRef.current, stateRef.current.status, r.state.status);
          if (voiceOnRef.current) {
            const now = performance.now();
            for (const cue of cuesFor(stateRef.current.status, r.state.status, r.rep, r.state.reps)) {
              if (gateRef.current(cue, now)) speak(cue.text, voiceRef.current, cue.urgent);
            }
          }
          stateRef.current = r.state;
          setStatus(r.state.status);
          setDepth(r.state.depth);
          if (r.rep) {
            setReps(r.state.reps);
            setPulse((p) => p + 1);
            if (soundRef.current) beep();
          }
        }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function reset() {
    stateRef.current = initialRepState();
    badgesRef.current = emptyBadges();
    startedAtRef.current = null;
    setReps(0);
    setStatus("Get in position");
    setHipAngle(null);
    setDepth(0);
  }

  function save() {
    if (stateRef.current.reps === 0) return;
    saveWorkout({
      id: `${Date.now()}`,
      startedAt: startedAtRef.current ?? Date.now(),
      endedAt: Date.now(),
      reps: stateRef.current.reps,
      badges: badgesRef.current,
    });
    setRunning(false);
    reset();
    toast.success("Workout saved to history");
  }

  function toggleRun() {
    if (!running && startedAtRef.current === null) startedAtRef.current = Date.now();
    unlockSpeech();
    // Mobile Chrome only allows speech that is first started from a tap.
    if (!running && voiceOnRef.current) speak("Let's go! Get into your plank.", voiceRef.current, true);
    setRunning((r) => !r);
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
      <Toaster position="top-center" />
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <Link to="/" aria-label="Home" className="text-2xl font-black uppercase tracking-tight">
          RAGE<span className="text-primary neon-glow">BIT</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant={voiceOn ? "default" : "ghost"}
            size="icon"
            className="rounded-sm"
            aria-label={voiceOn ? "Mute voice coach" : "Unmute voice coach"}
            onClick={toggleVoice}
          >
            {voiceOn ? <Mic /> : <MicOff />}
          </Button>
          {voices.length > 0 && (
            <select
              aria-label="Coach voice"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="h-8 max-w-24 rounded-sm border border-border bg-card px-2 text-xs text-foreground"
            >
              {voices.map((v) => (
                <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
          )}
          {reps > 0 && (
            <Button variant="secondary" size="sm" className="rounded-sm font-bold" onClick={save}>
              <Save /> Save
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Switch camera" onClick={flip}>
            <SwitchCamera />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Workout history" asChild>
            <Link to="/history"><History /></Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Open AI chat" asChild>
            <Link to="/chat"><MessageCircle /></Link>
          </Button>
        </div>
      </header>

      <div className="relative mx-4 flex-1 overflow-hidden rounded-sm border border-border bg-card">
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
              <span
                className={`rounded-sm px-3 py-1.5 font-mono text-sm font-extrabold uppercase tracking-wider ${statusTone} ${
                  status !== "Good Form" && status !== "Get in position" ? "animate-pulse" : ""
                }`}
              >
                {status}
              </span>
              <div className="flex flex-col items-end gap-1.5">
                {elbow !== null && (
                  <span className="rounded-sm bg-background/70 px-3 py-1.5 text-sm font-semibold tabular-nums">
                    <span className="font-mono">Elbow {elbow}°</span>
                  </span>
                )}
                {hipAngle !== null && (
                  <span
                    className={`rounded-sm px-3 py-1.5 text-sm font-semibold tabular-nums ${
                      status === "Hips Sagging" || status === "Hips Piking"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-background/70"
                    }`}
                  >
                    <span className="font-mono">Spine {hipAngle}°</span>
                  </span>
                )}
              </div>
            </div>
            {running && (
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5" aria-label="Chest depth">
                <div className="relative h-52 w-6 overflow-hidden rounded-sm border-2 border-primary bg-background/80">
                  <div
                    className="absolute inset-x-0 top-0 bg-primary"
                    style={{ height: `${Math.min(100, (depth / (MIN_DEPTH * 1.25)) * 100)}%` }}
                  />
                  <div className="absolute inset-x-0 h-1 bg-secondary" style={{ top: "80%" }} />
                </div>
                <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-primary">Depth</span>
              </div>
            )}
            {running && status === "Turn Sideways" && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 p-6 text-center">
                <p className="max-w-xs text-lg font-bold">
                  Turn sideways — show your side profile to unlock tracking.
                </p>
              </div>
            )}
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <div key={pulse} className="font-mono text-[7rem] leading-none font-extrabold tabular-nums text-foreground animate-in zoom-in-75 duration-300">
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
            <Button size="lg" className="h-14 rounded-sm border-2 border-primary px-8 text-base font-black uppercase tracking-wider active:translate-y-0.5" onClick={() => startCamera()} disabled={loading}>
              <Camera /> {loading ? "Starting…" : "Grant Camera Access"}
            </Button>
            {error && <p className="rounded-sm bg-destructive/15 px-4 py-3 text-sm text-destructive">{error}</p>}
            {error && (
              <Button variant="outline" className="rounded-sm" asChild>
                <a href={typeof window !== "undefined" ? window.location.href : "/"} target="_blank" rel="noopener noreferrer">
                  Open in a new tab
                </a>
              </Button>
            )}
          </div>
        )}
        {camOn && loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 font-semibold">Loading AI model…</div>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4">
        <Button variant="outline" size="icon" className="size-14 rounded-sm border-2 border-primary active:translate-y-0.5 active:bg-primary active:text-primary-foreground" aria-label="Reset counter" onClick={reset}>
          <RotateCcw />
        </Button>
        <Button
          size="lg"
          variant={running ? "secondary" : "default"}
          className="h-14 rounded-sm border-2 border-primary text-base font-black uppercase tracking-wider active:translate-y-0.5"
          disabled={!camOn || loading}
          onClick={toggleRun}
        >
          {running ? <><Pause /> Pause</> : <><Play /> Start Workout</>}
        </Button>
        <Button variant="outline" size="icon" className="size-14 rounded-sm border-2 border-primary active:translate-y-0.5 active:bg-primary active:text-primary-foreground" aria-label="Toggle sound" onClick={() => setSound((s) => !s)}>
          {sound ? <Volume2 /> : <VolumeX />}
        </Button>
      </div>
    </div>
  );
}
