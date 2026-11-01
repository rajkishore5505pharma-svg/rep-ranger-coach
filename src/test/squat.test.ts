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
  it("counts a squat once hips drop 60% of thigh length", () => {
    expect(SQUAT_DEPTH).toBe(0.6);
    expect(run([...squat(0.7), ...squat(0.7)]).reps).toBe(2);
  });
  it("does not count a half squat and says Go Lower", () => {
    const { s, reps } = run(squat(0.4));
    expect(reps).toBe(0);
    expect(s.status).toBe("Go Lower");
  });
  it("voids a rep when the chest drops forward for longer than the grace window", () => {
    const lean = Array.from({ length: GRACE_FRAMES + 2 }, () => f(0.7, { lean: 70 }));
    const { s, reps } = run([f(0), f(0.7), ...lean, f(0)]);
    expect(reps).toBe(0);
    expect(s.status).toBe("Chest Up");
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
