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
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveWorkout(w: Workout) {
  localStorage.setItem(KEY, JSON.stringify([w, ...loadHistory()]));
}

export function deleteWorkout(id: string) {
  localStorage.setItem(KEY, JSON.stringify(loadHistory().filter((w) => w.id !== id)));
}
