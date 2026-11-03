import { describe, expect, it } from "vitest";
import { debrief } from "@/lib/progress";
import { cleanPercent, emptyBadges, type Exercise, type Workout } from "@/lib/history";

const w = (reps: number, exercise: Exercise = "pushups", day = 0): Workout => ({
  id: `${exercise}-${reps}-${day}`, startedAt: new Date(2026, 0, 1 + day).getTime(), endedAt: 0, reps, badges: emptyBadges(), exercise,
});

describe("workout debrief", () => {
  it("flags a personal best only when beating the same exercise's record", () => {
    expect(debrief([w(12)], w(15)).personalBest).toBe(true);
    expect(debrief([w(12)], w(12)).personalBest).toBe(false);
    expect(debrief([w(40, "squats")], w(15)).personalBest).toBe(true);
  });
  it("lists achievements unlocked by this workout only", () => {
    expect(debrief([], w(10)).unlocked.map((a) => a.id)).toEqual(["first", "ten", "clean"]);
    expect(debrief([w(10)], w(5)).unlocked).toEqual([]);
  });
  it("reports a rank-up when crossing 50 lifetime reps", () => {
    const d = debrief([w(45)], w(10, "pushups", 1));
    expect(d.rankedUp).toBe(true);
    expect(d.rank.rank.name).toBe("Bronze");
  });
  it("never ranks up from plank seconds", () => {
    expect(debrief([w(45)], w(120, "plank", 1)).rankedUp).toBe(false);
  });
});

describe("clean percent", () => {
  it("is the share of Good Form badges", () => {
    expect(cleanPercent({ ...w(10), badges: { ...emptyBadges(), "Good Form": 3, "Hips Sagging": 1 } })).toBe(75);
  });
});
