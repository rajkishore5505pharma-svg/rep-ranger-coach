import { describe, expect, it } from "vitest";
import { initialPlankState, stepPlank, straightness, PLANK_LINE, PLANK_METER_FULL, type PlankFrame } from "@/lib/plank";
import { GRACE_FRAMES } from "@/lib/pushup";

const good = (t: number): PlankFrame => ({ hipAngle: 178, hipBreak: null, sideView: true, horizontal: true, t });
const run = (frames: PlankFrame[]) => {
  let s = initialPlankState();
  let reps = 0;
  for (const f of frames) { const r = stepPlank(s, f); s = r.state; if (r.rep) reps++; }
  return { s, reps };
};
const timeline = (ms: number, make: (t: number) => PlankFrame, from = 0) =>
  Array.from({ length: Math.round(ms / 33) + 1 }, (_, i) => make(from + i * 33));

describe("plank timer", () => {
  it("counts seconds held in a straight plank", () => {
    const { s } = run(timeline(3000, good));
    expect(s.reps).toBe(3); // ~3.0 s of frames
    expect(s.status).toBe("Good Form");
  });

  it("pauses the clock when hips sag for longer than the grace period, keeping time already held", () => {
    const sag = (t: number): PlankFrame => ({ ...good(t), hipAngle: 160, hipBreak: "sag" });
    const { s } = run([...timeline(2000, good), ...timeline(3000, sag, 2033)]);
    expect(s.status).toBe("Hips Sagging");
    expect(s.reps).toBeLessThanOrEqual(2);
    expect(s.reps).toBeGreaterThanOrEqual(1);
  });

  it("ignores a brief hip slip", () => {
    const frames = timeline(3000, good).map((f, i) => (i > 30 && i < 30 + GRACE_FRAMES ? { ...f, hipBreak: "pike" as const } : f));
    const { s } = run(frames);
    expect(s.status).toBe("Good Form");
    expect(s.reps).toBe(3);
  });

  it("never runs while standing or facing the camera", () => {
    expect(run(timeline(3000, (t) => ({ ...good(t), horizontal: false }))).s.reps).toBe(0);
    const front = run(timeline(3000, (t) => ({ ...good(t), sideView: false })));
    expect(front.s.reps).toBe(0);
    expect(front.s.status).toBe("Turn Sideways");
  });

  it("meter fills the bar before perfect straightness so a good plank reads high", () => {
    expect(straightness(170)).toBeCloseTo(PLANK_LINE);
    expect(straightness(180)).toBeCloseTo(PLANK_LINE * 1.25);
    // the bar is full at 1.05 straightness instead of the old 1.25
    expect(PLANK_METER_FULL).toBeCloseTo(1.05);
    expect(straightness(170) / PLANK_METER_FULL).toBeGreaterThanOrEqual(0.9);
    // a clearly sagging 160° plank still reads below the 80% target line
    expect(straightness(160) / PLANK_METER_FULL).toBeLessThan(0.8);
  });
});
