import { describe, expect, it } from "vitest";
import { angle, initialRepState, step } from "@/lib/pushup";

const run = (angles: number[], body = 175) => {
  let s = initialRepState();
  for (const a of angles) s = step(s, a, body).state;
  return s;
};

describe("push-up rep logic", () => {
  it("counts a rep when elbow goes below 90 then above 160", () => {
    expect(run([170, 120, 85, 120, 165]).reps).toBe(1);
  });
  it("does not count a shallow rep that never goes below 90", () => {
    const s = run([170, 120, 100, 120, 165]);
    expect(s.reps).toBe(0);
    expect(s.status).toBe("Go Lower");
  });
  it("flags sagging hips", () => {
    expect(run([170], 140).status).toBe("Spine Sagging");
  });
  it("computes a right angle", () => {
    expect(Math.round(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }))).toBe(90);
  });
});
