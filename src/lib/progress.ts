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
