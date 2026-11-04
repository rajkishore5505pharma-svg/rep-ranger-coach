import { exerciseOf, type Workout } from "./history";

export type Rank = { name: string; min: number };
export const RANKS: Rank[] = [
  { name: "Rookie", min: 0 },
  { name: "Bronze", min: 50 },
  { name: "Silver", min: 150 },
  { name: "Gold", min: 400 },
  { name: "Platinum", min: 800 },
  { name: "Diamond", min: 1500 },
  { name: "Rage Legend", min: 3000 },
];

/** Plank seconds are a hold time, not reps, so they never count toward rank. */
export const totalReps = (h: Workout[]) => h.reduce((n, w) => n + (exerciseOf(w) === "plank" ? 0 : w.reps), 0);

/** Current rank, next rank and progress (0..1) toward it, based on lifetime reps. */
export function rankFor(total: number) {
  let i = 0;
  while (i + 1 < RANKS.length && total >= RANKS[i + 1]!.min) i++;
  const rank = RANKS[i]!, next = RANKS[i + 1] ?? null;
  const progress = next ? (total - rank.min) / (next.min - rank.min) : 1;
  return { rank, next, progress, level: i + 1 };
}

const dayKey = (t: number) => new Date(t).toDateString();
/** Longest run of consecutive calendar days with a workout. */
export function longestStreak(h: Workout[]) {
  const days = [...new Set(h.map((w) => dayKey(w.startedAt)))].map((d) => new Date(d).getTime()).sort((a, b) => a - b);
  let best = 0, run = 0;
  days.forEach((d, i) => {
    run = i > 0 && Math.round((d - days[i - 1]!) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export type Achievement = { id: string; title: string; detail: string; unlocked: boolean };

export function achievements(h: Workout[]): Achievement[] {
  const best = Math.max(0, ...h.map((w) => w.reps));
  const total = totalReps(h);
  const clean = h.some((w) => exerciseOf(w) === "pushups" && w.reps >= 10 && (w.badges["Hips Sagging"] ?? 0) + (w.badges["Hips Piking"] ?? 0) === 0);
  const streak = longestStreak(h);
  const bestPlank = Math.max(0, ...h.filter((w) => exerciseOf(w) === "plank").map((w) => w.reps));
  const bestSquats = Math.max(0, ...h.filter((w) => exerciseOf(w) === "squats").map((w) => w.reps));
  return [
    { id: "first", title: "First Blood", detail: "Finish your first workout", unlocked: h.length >= 1 },
    { id: "ten", title: "Ten Pack", detail: "10 reps in one workout", unlocked: best >= 10 },
    { id: "25", title: "Quarter Century", detail: "25 reps in one workout", unlocked: best >= 25 },
    { id: "50", title: "Half Ton", detail: "50 reps in one workout", unlocked: best >= 50 },
    { id: "clean", title: "Clean Machine", detail: "10+ reps with no hip breaks", unlocked: clean },
    { id: "legday", title: "Leg Day", detail: "20 squats in one workout", unlocked: bestSquats >= 20 },
    { id: "ironcore", title: "Iron Core", detail: "Hold a clean plank for 60 seconds", unlocked: bestPlank >= 60 },
    { id: "streak", title: "On Fire", detail: "Train 3 days in a row", unlocked: streak >= 3 },
    { id: "century", title: "Century Club", detail: "100 lifetime reps", unlocked: total >= 100 },
    { id: "thousand", title: "Iron Will", detail: "1,000 lifetime reps", unlocked: total >= 1000 },
  ];
}

/** Achievements unlocked by adding `w` to history `h`. */
export function newlyUnlocked(h: Workout[], w: Workout): Achievement[] {
  const before = new Set(achievements(h).filter((a) => a.unlocked).map((a) => a.id));
  return achievements([w, ...h]).filter((a) => a.unlocked && !before.has(a.id));
}

/** Everything the post-workout debrief shows, derived from history before the save. */
export function debrief(h: Workout[], w: Workout) {
  const ex = exerciseOf(w);
  const prevBest = Math.max(0, ...h.filter((x) => exerciseOf(x) === ex).map((x) => x.reps));
  const before = rankFor(totalReps(h));
  const after = rankFor(totalReps([w, ...h]));
  return {
    personalBest: w.reps > prevBest,
    prevBest,
    unlocked: newlyUnlocked(h, w),
    rank: after,
    rankedUp: after.level > before.level,
  };
}

/** Daily goal: push-up + squat reps done today (plank seconds are tracked separately). */
export const DEFAULT_DAILY_GOAL = 50;
export const GOAL_STEP = 10;
export const GOAL_MIN = 10;
export const GOAL_MAX = 500;
export const clampGoal = (g: number) => Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(g / GOAL_STEP) * GOAL_STEP));

const sameDay = (a: number, b: number) => dayKey(a) === dayKey(b);

/** Today's reps, plank seconds and goal progress (0..1, capped). */
export function today(h: Workout[], goal: number, now = Date.now()) {
  const todays = h.filter((w) => sameDay(w.startedAt, now));
  const reps = totalReps(todays);
  const plankSeconds = todays.filter((w) => exerciseOf(w) === "plank").reduce((n, w) => n + w.reps, 0);
  return { reps, plankSeconds, workouts: todays.length, progress: Math.min(1, reps / goal), hit: reps >= goal, left: Math.max(0, goal - reps) };
}

/**
 * Consecutive days the goal was hit, ending today (or yesterday, so an
 * unfinished today doesn't break the streak until the day is over).
 */
export function goalStreak(h: Workout[], goal: number, now = Date.now()) {
  const perDay = new Map<string, number>();
  for (const w of h) if (exerciseOf(w) !== "plank") perDay.set(dayKey(w.startedAt), (perDay.get(dayKey(w.startedAt)) ?? 0) + w.reps);
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  if ((perDay.get(d.toDateString()) ?? 0) < goal) d.setDate(d.getDate() - 1);
  let n = 0;
  while ((perDay.get(d.toDateString()) ?? 0) >= goal) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
