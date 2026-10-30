import type { FormStatus } from "@/lib/pushup";

export const COOLDOWN_MS = 2800;
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];

export const ALERTS: Partial<Record<FormStatus, string>> = {
  "Hips Sagging": "Hips up! Keep your core tight.",
  "Hips Piking": "Lower your hips! Maintain a straight line.",
  "Go Lower": "Go lower! Full range of motion.",
  "Turn Sideways": "Turn sideways to the camera.",
};

export const MILESTONES: Record<number, string> = {
  5: "Solid form, keep pushing!",
  10: "Halfway there, stay strong!",
};

export type Cue = { key: string; text: string; urgent: boolean };

/** Pick the cues for one state-machine step. Rep counts are urgent (no cooldown). */
export function cuesFor(prev: FormStatus, next: FormStatus, rep: boolean, reps: number): Cue[] {
  const out: Cue[] = [];
  if (rep) {
    out.push({ key: "rep", text: `${WORDS[reps] ?? String(reps)}!`, urgent: true });
    if (MILESTONES[reps]) out.push({ key: `milestone-${reps}`, text: MILESTONES[reps], urgent: false });
  }
  const alert = ALERTS[next];
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

export function speak(text: string, voice: SpeechSynthesisVoice | null, interrupt: boolean) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  // Chrome drops an utterance queued right after cancel(); only cancel when something is playing.
  if (interrupt && (synth.speaking || synth.pending)) synth.cancel();
  synth.resume();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.2;
  u.pitch = 1;
  u.volume = 1;
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "en-US";
  synth.speak(u);
}
