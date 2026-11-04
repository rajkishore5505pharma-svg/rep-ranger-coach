import type { Exercise } from "./history";

/** A routine: `sets` rounds of `target` reps (seconds for plank) with `rest` seconds between. */
export type Routine = { sets: number; target: number; rest: number };

export const DEFAULT_ROUTINES: Record<Exercise, Routine> = {
  pushups: { sets: 3, target: 10, rest: 60 },
  squats: { sets: 3, target: 15, rest: 60 },
  plank: { sets: 3, target: 30, rest: 45 },
};

export const LIMITS = {
  sets: { min: 1, max: 10, step: 1 },
  target: { min: 1, max: 100, step: 1 },
  /** Plank targets move in 5-second steps. */
  plankTarget: { min: 5, max: 300, step: 5 },
  rest: { min: 15, max: 180, step: 15 },
} as const;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

export function clampRoutine(r: Routine, exercise: Exercise): Routine {
  const t = exercise === "plank" ? LIMITS.plankTarget : LIMITS.target;
  return {
    sets: clamp(r.sets, LIMITS.sets.min, LIMITS.sets.max),
    target: clamp(r.target, t.min, t.max),
    rest: clamp(r.rest, LIMITS.rest.min, LIMITS.rest.max),
  };
}

/**
 * What happens after a counted rep in set `setIndex` (0-based) with `setReps` done in that set:
 * keep going, rest before the next set, or the whole routine is finished.
 */
export function afterRep(r: Routine, setIndex: number, setReps: number): "continue" | "rest" | "done" {
  if (setReps < r.target) return "continue";
  return setIndex + 1 >= r.sets ? "done" : "rest";
}

/** Whole seconds of rest remaining, never negative. */
export const restLeft = (endsAt: number, now: number) => Math.max(0, Math.ceil((endsAt - now) / 1000));

const key = (e: Exercise) => `ragebit-routine-${e}`;

export function loadRoutine(e: Exercise): { on: boolean; routine: Routine } {
  try {
    const v = JSON.parse(localStorage.getItem(key(e)) ?? "null");
    if (v && typeof v === "object") return { on: !!v.on, routine: clampRoutine({ ...DEFAULT_ROUTINES[e], ...v.routine }, e) };
  } catch { /* corrupt or unavailable */ }
  return { on: false, routine: DEFAULT_ROUTINES[e] };
}

export function saveRoutine(e: Exercise, on: boolean, routine: Routine) {
  try { localStorage.setItem(key(e), JSON.stringify({ on, routine })); } catch { /* storage full */ }
}
