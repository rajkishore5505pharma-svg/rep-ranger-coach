import type { FormStatus } from "./pushup";
import type { SquatStatus } from "./squat";
import type { PlankStatus } from "./plank";

export type Exercise = "pushups" | "squats" | "plank";
/** For planks, `reps` stores seconds held with good form. */
export type AnyStatus = FormStatus | SquatStatus | PlankStatus;
export type BadgeCounts = { "Good Form": number; "Go Lower": number; "Hips Sagging": number; "Hips Piking": number; "Chest Up"?: number };
/** `exercise` is missing on workouts saved before squats existed; those are push-ups. */
export type Workout = { id: string; startedAt: number; endedAt: number; reps: number; badges: BadgeCounts; exercise?: Exercise };

const KEY = "ragebit-history";
export const HISTORY_EVENT = "ragebit-history-changed";
let owner: string | null = null;
const historyKey = () => owner ? `${KEY}:${owner}` : KEY;
export function setHistoryOwner(id: string | null) { owner = id; window.dispatchEvent(new Event(HISTORY_EVENT)); }
export const historyOwner = () => owner;
export type PendingWorkout = { workout: Workout; deleted: boolean };
const pendingKey = (id: string) => `${KEY}:pending:${id}`;
export function pendingWorkouts(id: string): PendingWorkout[] {
  try { return JSON.parse(localStorage.getItem(pendingKey(id)) ?? "[]"); } catch { return []; }
}
export function acknowledgePending(id: string, sent: PendingWorkout[]) {
  const remaining = pendingWorkouts(id).filter((p) => !sent.some((s) => JSON.stringify(s) === JSON.stringify(p)));
  localStorage.setItem(pendingKey(id), JSON.stringify(remaining));
}
function queue(workout: Workout, deleted: boolean) {
  if (!owner) return;
  const pending = pendingWorkouts(owner).filter((p) => p.workout.id !== workout.id);
  localStorage.setItem(pendingKey(owner), JSON.stringify([...pending, { workout, deleted }]));
}
export function replaceCloudHistory(id: string, workouts: Workout[]) {
  if (owner !== id) return;
  const pending = pendingWorkouts(id);
  const pendingIds = new Set(pending.map((p) => p.workout.id));
  const merged = [...workouts.filter((w) => !pendingIds.has(w.id)), ...pending.filter((p) => !p.deleted).map((p) => p.workout)]
    .sort((a, b) => b.startedAt - a.startedAt);
  localStorage.setItem(historyKey(), JSON.stringify(merged));
  window.dispatchEvent(new Event(HISTORY_EVENT));
}
export function guestHistory(): Workout[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export const exerciseOf = (w: Workout): Exercise => w.exercise ?? "pushups";

export const emptyBadges = (): BadgeCounts => ({ "Good Form": 0, "Go Lower": 0, "Hips Sagging": 0, "Hips Piking": 0, "Chest Up": 0 });

/** Count a badge each time the shown status changes to it. */
export function tallyBadge(counts: BadgeCounts, prev: AnyStatus, next: AnyStatus): BadgeCounts {
  if (prev === next || next === "Get in position" || next === "Turn Sideways") return counts;
  return { ...counts, [next]: (counts[next] ?? 0) + 1 };
}

export function loadHistory(): Workout[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(historyKey()) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveWorkout(w: Workout) {
  queue(w, false);
  localStorage.setItem(historyKey(), JSON.stringify([w, ...loadHistory().filter((item) => item.id !== w.id)]));
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export function deleteWorkout(id: string) {
  const workout = loadHistory().find((w) => w.id === id);
  if (workout) queue(workout, true);
  localStorage.setItem(historyKey(), JSON.stringify(loadHistory().filter((w) => w.id !== id)));
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

/** Share of shown form badges that were "Good Form", 0..100. */
export function cleanPercent(w: Workout): number {
  const total = Object.values(w.badges).reduce((a: number, b) => a + (b ?? 0), 0);
  if (total === 0) return w.reps > 0 ? 100 : 0;
  return Math.min(100, Math.round(((w.badges["Good Form"] ?? 0) / total) * 100));
}
