import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Flame, History, MessageCircle, Mic, MicOff, Pause, Play, RotateCcw, Save, SwitchCamera, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { createGate, cuesFor, speak, unlockSpeech, type Alerts } from "@/lib/voice-coach";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { smoothPose, type Pt } from "@/lib/pushup";
import { cleanPercent, emptyBadges, loadHistory, saveWorkout, tallyBadge, type AnyStatus, type Exercise, type Workout } from "@/lib/history";
import { debrief } from "@/lib/progress";

type Debrief = ReturnType<typeof debrief> & { workout: Workout; clean: number };
const COUNTDOWN_FROM = 3;
const COUNT_WORDS = ["Go!", "One", "Two", "Three"];

export type TrackerState = { reps: number; status: AnyStatus; depth: number };
export type Readout = { text: string; /** Statuses that highlight this chip red. */ badOn: AnyStatus[] };

/** Everything that differs between exercises; the camera, HUD and saving are shared. */
export type ExerciseConfig<S extends TrackerState, F> = {
  exercise: Exercise;
  initial: () => S;
  measure: (pose: (Pt | null)[]) => F | null;
  step: (s: S, f: F | null) => { state: S; rep: boolean };
  /** Depth that counts; the meter's green line sits at this value. */
  minDepth: number;
  readouts: (f: F) => Readout[];
  /** Form break visible this frame (skeleton turns red). */
  broken: (f: F) => boolean;
  setupHint: string;
  startCue: string;
  alerts: Alerts;
  depthLabel: string;
  /** Counter unit under the big number (default "reps"). */
  unit?: string;
  /** Beep and speak the count only every N counts (default 1); timed holds use this. */
  cueEvery?: number;
};

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

let audioCtx: AudioContext | null = null;
function beep(freq = 880, dur = 0.18) {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  } catch { /* audio unavailable */ }
}

/** Phone vibration; silently ignored where unsupported (e.g. iPhone Safari). */
function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function ExerciseTracker<S extends TrackerState, F>({ config }: { config: ExerciseConfig<S, F> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<Landmarker | null>(null);
  const stateRef = useRef<S>(config.initial());
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
  const [status, setStatus] = useState<AnyStatus>("Get in position");
  const [readouts, setReadouts] = useState<Readout[]>([]);
  const [pulse, setPulse] = useState(0);
  const [depth, setDepth] = useState(0);
  const badgesRef = useRef(emptyBadges());
  const startedAtRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [summary, setSummary] = useState<Debrief | null>(null);
  useEffect(() => () => { if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); }, []);

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
      const measurement = config.measure(pose);
      setReadouts(measurement ? config.readouts(measurement) : []);
      if (raw) {

        // Neon green skeleton for solid form, neon red when orientation or plank form breaks.
        const broken = measurement ? config.broken(measurement) : false;
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
          const r = config.step(stateRef.current, measurement);
          badgesRef.current = tallyBadge(badgesRef.current, stateRef.current.status, r.state.status);
          const announce = r.rep && r.state.reps % (config.cueEvery ?? 1) === 0;
          if (voiceOnRef.current) {
            const now = performance.now();
            for (const cue of cuesFor(stateRef.current.status, r.state.status, announce, r.state.reps, config.alerts)) {
              if (gateRef.current(cue, now)) speak(cue.text, voiceRef.current, cue.urgent);
            }
          }
          // Double buzz the moment a form warning appears, so it's felt even over gym music.
          if (r.state.status !== stateRef.current.status && config.alerts[r.state.status]) buzz([70, 50, 70]);
          stateRef.current = r.state;
          setStatus(r.state.status);
          setDepth(r.state.depth);
          if (r.rep) {
            setReps(r.state.reps);
            setPulse((p) => p + 1);
            if (announce) buzz(40);
            if (soundRef.current && announce) beep();
          }
        }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function stopCountdown() {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    countdownTimerRef.current = null;
    setCountdown(null);
  }

  function reset() {
    stopCountdown();
    stateRef.current = config.initial();
    badgesRef.current = emptyBadges();
    startedAtRef.current = null;
    setReps(0);
    setStatus("Get in position");
    setReadouts([]);
    setDepth(0);
  }

  function save() {
    if (stateRef.current.reps === 0) return;
    const before = loadHistory();
    const workout: Workout = {
      id: `${Date.now()}`,
      startedAt: startedAtRef.current ?? Date.now(),
      endedAt: Date.now(),
      reps: stateRef.current.reps,
      badges: badgesRef.current,
      exercise: config.exercise,
    };
    saveWorkout(workout);
    const d = debrief(before, workout);
    setRunning(false);
    reset();
    setSummary({ ...d, workout, clean: cleanPercent(workout) });
    buzz(d.unlocked.length || d.rankedUp || d.personalBest ? [80, 60, 80, 60, 200] : 120);
    if (voiceOnRef.current) {
      speak(d.rankedUp ? `Rank up! You're now ${d.rank.rank.name}.` : d.personalBest ? "New personal best!" : "Workout saved. Good work.", voiceRef.current, true);
    }
  }

  /** One countdown second: beep, buzz, speak; at zero, tracking starts. */
  function tick(n: number) {
    setCountdown(n);
    if (soundRef.current) beep(n === 0 ? 1320 : 660, n === 0 ? 0.35 : 0.15);
    buzz(n === 0 ? 250 : 60);
    if (voiceOnRef.current) speak(COUNT_WORDS[n] ?? String(n), voiceRef.current, true);
    if (n === 0) {
      if (startedAtRef.current === null) startedAtRef.current = Date.now();
      setRunning(true);
      countdownTimerRef.current = setTimeout(() => setCountdown(null), 700);
      return;
    }
    countdownTimerRef.current = setTimeout(() => tick(n - 1), 1000);
  }

  function toggleRun() {
    // Mobile Chrome only allows speech that is first started from a tap.
    unlockSpeech();
    if (running) { setRunning(false); return; }
    if (countdown !== null) { stopCountdown(); return; }
    tick(COUNTDOWN_FROM);
  }

  function flip() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (camOn) void startCamera(next);
  }

  const statusTone =
    status === "Good Form" ? "bg-secondary text-secondary-foreground"
    : status === "Get in position" ? "border-2 border-primary bg-background text-primary"
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
                {readouts.map((r) => (
                  <span
                    key={r.text.split(" ")[0]}
                    className={`rounded-sm px-3 py-1.5 text-sm font-semibold tabular-nums ${
                      r.badOn.includes(status) ? "bg-destructive text-destructive-foreground" : "bg-background/70"
                    }`}
                  >
                    <span className="font-mono">{r.text}</span>
                  </span>
                ))}
              </div>
            </div>
            {running && (
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5" aria-label={config.depthLabel}>
                <div className="relative h-52 w-6 overflow-hidden rounded-sm border-2 border-primary bg-background/80">
                  <div
                    className="absolute inset-x-0 top-0 bg-primary"
                    style={{ height: `${Math.min(100, (depth / (config.minDepth * 1.25)) * 100)}%` }}
                  />
                  <div className="absolute inset-x-0 h-1 bg-secondary" style={{ top: "80%" }} />
                </div>
                <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-primary">{config.depthLabel}</span>
              </div>
            )}
            {running && status === "Turn Sideways" && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 p-6 text-center">
                <p className="max-w-xs text-lg font-bold">
                  Turn sideways — show your side profile to unlock tracking.
                </p>
              </div>
            )}
            {countdown !== null && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/75 text-center" aria-live="assertive">
                <div key={countdown} className={`font-impact leading-none animate-in zoom-in-50 duration-300 ${countdown === 0 ? "text-[8rem] text-secondary" : "text-[11rem] text-primary"}`}>
                  {countdown === 0 ? "GO!" : countdown}
                </div>
                <p className="mt-2 max-w-xs font-mono text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  {config.startCue}
                </p>
              </div>
            )}
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <div key={pulse} className="font-mono text-[7rem] leading-none font-extrabold tabular-nums text-foreground animate-in zoom-in-75 duration-300">
                {reps}
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
                {running ? (config.unit ?? "reps") : "paused"}
              </div>
            </div>
          </>
        )}

        {!camOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
            <p className="text-lg font-semibold">{config.setupHint}</p>
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
          className="h-14 min-w-0 rounded-sm border-2 border-primary px-3 text-base font-black uppercase tracking-wider active:translate-y-0.5"
          disabled={!camOn || loading}
          onClick={toggleRun}
        >
          {running ? <><Pause /> Pause</> : countdown !== null ? <><X /> Cancel</> : <><Play /> Start Workout</>}
        </Button>
        <Button variant="outline" size="icon" className="size-14 rounded-sm border-2 border-primary active:translate-y-0.5 active:bg-primary active:text-primary-foreground" aria-label="Toggle sound" onClick={() => setSound((s) => !s)}>
          {sound ? <Volume2 /> : <VolumeX />}
        </Button>
      </div>

      {summary && (
        <div className="fixed inset-0 z-50 flex items-end bg-background/85 animate-in fade-in" role="dialog" aria-modal="true" aria-label="Workout summary">
          <div className="w-full border-t-2 border-primary bg-card px-5 pt-3 pb-6 animate-in slide-in-from-bottom duration-300">
            <div className="hazard -mx-5 mb-4 h-2" />
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.3em] text-primary">Set complete</p>
                <h2 className="font-impact text-4xl uppercase leading-none">Debrief</h2>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close summary" onClick={() => setSummary(null)}><X /></Button>
            </div>

            <div className="mt-4 grid grid-cols-3 border-2 border-border">
              {[
                [String(summary.workout.reps), config.unit ?? "reps"],
                [`${summary.clean}%`, "clean form"],
                [fmtDur(summary.workout.endedAt - summary.workout.startedAt), "time"],
              ].map(([v, l], i) => (
                <div key={l} className={`px-2 py-3 text-center ${i > 0 ? "border-l-2 border-border" : ""}`}>
                  <div className={`font-mono text-3xl font-extrabold tabular-nums ${i === 1 ? (summary.clean >= 70 ? "text-secondary" : "text-destructive") : "text-foreground"}`}>{v}</div>
                  <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>

            <ul className="mt-4 space-y-2">
              {summary.personalBest && (
                <li className="flex items-center gap-3 rounded-sm border-2 border-primary bg-primary/10 px-3 py-2">
                  <Flame className="size-5 text-primary" />
                  <span className="font-bold uppercase">New personal best</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">prev {summary.prevBest}</span>
                </li>
              )}
              {summary.rankedUp && (
                <li className="flex items-center gap-3 rounded-sm border-2 border-primary bg-primary/10 px-3 py-2">
                  <Trophy className="size-5 text-primary" />
                  <span className="font-bold uppercase">Rank up: {summary.rank.rank.name}</span>
                </li>
              )}
              {summary.unlocked.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-sm border-2 border-secondary bg-secondary/10 px-3 py-2">
                  <Trophy className="size-5 text-secondary" />
                  <div>
                    <div className="font-bold uppercase">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.detail}</div>
                  </div>
                </li>
              ))}
              {!summary.personalBest && !summary.rankedUp && summary.unlocked.length === 0 && (
                <li className="rounded-sm border-2 border-border px-3 py-2 text-sm text-muted-foreground">
                  {summary.rank.next
                    ? `${summary.rank.rank.name} · ${Math.round(summary.rank.progress * 100)}% to ${summary.rank.next.name}`
                    : `${summary.rank.rank.name} · max rank`}
                </li>
              )}
            </ul>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12 rounded-sm border-2 border-border font-black uppercase tracking-wider" asChild>
                <Link to="/history"><History /> History</Link>
              </Button>
              <Button className="h-12 rounded-sm border-2 border-primary font-black uppercase tracking-wider active:translate-y-0.5" onClick={() => setSummary(null)}>
                <RotateCcw /> Go again
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
