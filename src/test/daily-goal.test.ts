import { describe, expect, it } from "vitest";
import { clampGoal, goalStreak, today } from "@/lib/progress";
import { emptyBadges, type Exercise, type Workout } from "@/lib/history";

const at = (day: number, hour = 10) => new Date(2026, 0, 10 + day, hour).getTime();
const w = (reps: number, day: number, exercise: Exercise = "pushups"): Workout => ({
  id: `${exercise}-${reps}-${day}`, startedAt: at(day), endedAt: at(day), reps, badges: emptyBadges(), exercise,
});
const NOW = at(0, 20);

describe("daily goal", () => {
  it("adds today's push-ups and squats, but not plank seconds or other days", () => {
    const t = today([w(20, 0), w(15, 0, "squats"), w(60, 0, "plank"), w(40, -1)], 50, NOW);
    expect(t.reps).toBe(35);
    expect(t.plankSeconds).toBe(60);
    expect(t.left).toBe(15);
    expect(t.hit).toBe(false);
  });
  it("is hit once today's reps reach the goal, with progress capped at 100%", () => {
    const t = today([w(60, 0)], 50, NOW);
    expect(t.hit).toBe(true);
    expect(t.progress).toBe(1);
    expect(t.left).toBe(0);
  });
  it("counts the streak of days the goal was hit, not broken by an unfinished today", () => {
    expect(goalStreak([w(50, -1), w(50, -2), w(10, -3)], 50, NOW)).toBe(2);
    expect(goalStreak([w(50, 0), w(50, -1), w(50, -2)], 50, NOW)).toBe(3);
    expect(goalStreak([w(50, -2)], 50, NOW)).toBe(0);
  });
  it("keeps goals in steps of 10 between 10 and 500", () => {
    expect(clampGoal(0)).toBe(10);
    expect(clampGoal(57)).toBe(60);
    expect(clampGoal(9999)).toBe(500);
  });
});
