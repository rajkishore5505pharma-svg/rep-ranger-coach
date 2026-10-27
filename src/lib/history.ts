import type { FormStatus } from "./pushup";

export type BadgeCounts = { "Good Form": number; "Go Lower": number; "Hips Sagging": number; "Hips Piking": number };
export type Workout = { id: string; startedAt: number; endedAt: number; reps: number; badges: BadgeCounts };

const KEY = "ragebit-history";

export const emptyBadges = (): BadgeCounts => ({ "Good Form": 0, "Go Lower": 0, "Hips Sagging": 0, "Hips Piking": 0 });

/** Count a badge each time the shown status changes to it. */
export function tallyBadge(counts: BadgeCounts, prev: FormStatus, next: FormStatus): BadgeCounts {
  if (prev === next || next === "Get in position" || next === "Turn Sideways") return counts;
  return { ...counts, [next]: counts[next] + 1 };
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
