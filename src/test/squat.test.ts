import { describe, expect, it } from "vitest";
import { GRACE_FRAMES } from "@/lib/pushup";
import { SQUAT_DEPTH, initialSquatState, stepSquat, type SquatFrame, type SquatState } from "@/lib/squat";

// Thigh length 0.25; hip at y=0.5 when standing.
const f = (depth: number, o: Partial<SquatFrame> = {}): SquatFrame => ({
  knee: depth < 0.1 ? 175 : 120 - depth * 40, lean: 20, sideView: true, hipY: 0.5 + depth * 0.25, thighLength: 0.25, upright: true, ...o,
});
const run = (frames: SquatFrame[], s: SquatState = initialSquatState()) => {
  let reps = 0;
  for (const fr of frames) { const r = stepSquat(s, fr); s = r.state; if (r.rep) reps++; }
  return { s, reps };
};
const squat = (depth: number, o: Partial<SquatFrame> = {}) => [f(0), f(depth / 2, o), f(depth, o), f(depth / 2, o), f(0)];

describe("squat counter", () => {
  it("counts a squat once hips drop 45% of thigh length", () => {
    expect(SQUAT_DEPTH).toBe(0.45);
    expect(run([...squat(0.5), ...squat(0.5)]).reps).toBe(2);
  });
  it("counts when the knee bends past 115° even if hip drop reads short", () => {
    expect(run([f(0), f(0.3, { knee: 105 }), f(0)]).reps).toBe(1);
  });
  it("counts with the far shoulder and hip hidden (true side view)", () => {
    expect(run(squat(0.5, { sideView: true })).reps).toBe(1);
  });
  it("does not say Good Form before the user has stood tall", () => {
    expect(run([f(0.3)]).s.status).toBe("Get in position");
  });
  it("does not count a quarter squat and says Go Lower", () => {
    const { s, reps } = run([f(0), f(0.15), f(0.3, { knee: 130 }), f(0.15), f(0)]);
    expect(reps).toBe(0);
    expect(s.status).toBe("Go Lower");
  });
  it("voids a rep when the chest drops forward for longer than the grace window", () => {
    const lean = Array.from({ length: GRACE_FRAMES + 2 }, () => f(0.7, { lean: 70 }));
    const mid = run([f(0), f(0.7), ...lean]);
    expect(mid.s.status).toBe("Chest Up");
    expect(run([f(0)], mid.s).reps).toBe(0);
  });
  it("ignores a forward lean that lasts only a moment", () => {
    expect(run([f(0), f(0.7), f(0.7, { lean: 70 }), f(0.7, { lean: 70 }), f(0)]).reps).toBe(1);
  });
  it("locks with Turn Sideways when facing the camera", () => {
    const front = Array.from({ length: GRACE_FRAMES + 1 }, () => f(0, { sideView: false }));
    expect(run(front).s.status).toBe("Turn Sideways");
  });
  it("never counts while lying down", () => {
    const flat = (d: number) => f(d, { upright: false });
    expect(run(Array.from({ length: 40 }, (_, i) => flat(i % 2 ? 0.8 : 0))).reps).toBe(0);
  });
});

import { measureSquat } from "@/lib/squat";
describe("squat measurement", () => {
  it("treats hidden far-side landmarks as a side view", () => {
    const pose: (null | { x: number; y: number; visibility: number })[] = Array(33).fill(null);
    pose[11] = { x: 0.5, y: 0.2, visibility: 0.9 };
    pose[23] = { x: 0.5, y: 0.5, visibility: 0.9 };
    pose[25] = { x: 0.52, y: 0.75, visibility: 0.9 };
    pose[27] = { x: 0.5, y: 0.98, visibility: 0.9 };
    const m = measureSquat(pose);
    expect(m?.sideView).toBe(true);
    expect(m?.upright).toBe(true);
  });
});
