import type { AnyStatus } from "@/lib/history";

export const COOLDOWN_MS = 2800;
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];

export type Alerts = Partial<Record<AnyStatus, string>>;

export const ALERTS: Alerts = {
  "Hips Sagging": "Hips up! Keep your core tight.",
  "Hips Piking": "Lower your hips! Maintain a straight line.",
  "Go Lower": "Go lower! Full range of motion.",
  "Turn Sideways": "Turn sideways to the camera.",
};

export const SQUAT_ALERTS: Alerts = {
  "Go Lower": "Go lower! Hips down to your knees.",
  "Chest Up": "Chest up! Keep your back straight.",
  "Turn Sideways": "Turn sideways to the camera.",
};

export const MILESTONES: Record<number, string> = {
  5: "Solid form, keep pushing!",
  10: "Halfway there, stay strong!",
};

export type Cue = { key: string; text: string; urgent: boolean };

/** Pick the cues for one state-machine step. Rep counts are urgent (no cooldown). */
export function cuesFor(prev: AnyStatus, next: AnyStatus, rep: boolean, reps: number, alerts: Alerts = ALERTS): Cue[] {
  const out: Cue[] = [];
  if (rep) {
    out.push({ key: "rep", text: `${WORDS[reps] ?? String(reps)}!`, urgent: true });
    if (MILESTONES[reps]) out.push({ key: `milestone-${reps}`, text: MILESTONES[reps], urgent: false });
  }
  const alert = alerts[next];
  if (alert && next !== prev) out.push({ key: next, text: alert, urgent: false });
  return out;
}

/** Per-alert-type cooldown gate. */
export function createGate(cooldown = COOLDOWN_MS) {
  const last = new Map<string, number>();
  return (cue: Cue, now: number) => {
    if (cue.urgent) return true;
    const t = last.get(cue.key);
    if (t !== undefined && now - t < cooldown) return false;
    last.set(cue.key, now);
    return true;
  };
}

// Chrome garbage-collects utterances that aren't referenced, silently dropping speech.
const live = new Set<SpeechSynthesisUtterance>();
let unlocked = false;

/** Call from a tap: mobile browsers block speech that wasn't first started by the user. */
export function unlockSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis || unlocked) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
  unlocked = true;
  // Chrome pauses long-running synthesis; keep it awake.
  setInterval(() => { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); }, 1000);
}

export function speak(text: string, voice: SpeechSynthesisVoice | null, interrupt: boolean) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.2;
  u.pitch = 1;
  u.volume = 1;
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "en-US";
  live.add(u);
  u.onend = u.onerror = () => live.delete(u);
  const busy = synth.speaking || synth.pending;
  if (interrupt && busy) {
    synth.cancel();
    // Speaking in the same tick as cancel() is dropped on Android Chrome.
    setTimeout(() => synth.speak(u), 60);
  } else synth.speak(u);
  synth.resume();
}
