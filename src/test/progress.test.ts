import { describe, expect, it } from "vitest";
import { achievements, longestStreak, rankFor } from "@/lib/progress";
import { emptyBadges, type Workout } from "@/lib/history";

const w = (reps: number, day = 0, badges = emptyBadges()): Workout => ({ id: `${reps}-${day}`, startedAt: new Date(2026, 0, 1 + day).getTime(), endedAt: 0, reps, badges });

describe("ranks", () => {
  it("starts at Rookie and climbs by lifetime reps", () => {
    expect(rankFor(0).rank.name).toBe("Rookie");
    expect(rankFor(49).rank.name).toBe("Rookie");
    expect(rankFor(50).rank.name).toBe("Bronze");
    expect(rankFor(400).rank.name).toBe("Gold");
    expect(rankFor(5000).rank.name).toBe("Rage Legend");
    expect(rankFor(5000).next).toBeNull();
  });
  it("reports progress to the next rank", () => {
    expect(rankFor(100).progress).toBeCloseTo(0.5);
  });
});

describe("achievements", () => {
  const unlocked = (h: Workout[]) => achievements(h).filter((a) => a.unlocked).map((a) => a.id);
  it("unlocks rep milestones", () => {
    expect(unlocked([w(25)])).toEqual(expect.arrayContaining(["first", "ten", "25", "clean"]));
    expect(unlocked([w(25)])).not.toContain("50");
  });
  it("needs no hip breaks for Clean Machine", () => {
    expect(unlocked([w(12, 0, { ...emptyBadges(), "Hips Sagging": 1 })])).not.toContain("clean");
  });
  it("counts a 3-day streak", () => {
    expect(longestStreak([w(1, 0), w(1, 1), w(1, 2), w(1, 5)])).toBe(3);
    expect(unlocked([w(1, 0), w(1, 2), w(1, 4)])).not.toContain("streak");
  });
});

describe("squat achievements", () => {
  const ids = (h: Workout[]) => achievements(h).filter((a) => a.unlocked).map((a) => a.id);
  it("unlocks Leg Day at 20 squats in one workout", () => {
    expect(ids([{ ...w(20), exercise: "squats" }])).toContain("legday");
    expect(ids([{ ...w(19), exercise: "squats" }])).not.toContain("legday");
    expect(ids([w(30)])).not.toContain("legday");
  });
  it("Clean Machine only counts push-up workouts", () => {
    expect(ids([{ ...w(15), exercise: "squats" }])).not.toContain("clean");
  });
});
