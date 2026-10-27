import { describe, expect, it } from "vitest";
import { angle, hipAlignment, initialRepState, isSideProfile, step, type Frame } from "@/lib/pushup";

const frame = (elbow: number, o: Partial<Frame> = {}): Frame => ({
  elbow,
  hip: null,
  sideView: true,
  shoulderY: null,
  ankleY: null,
  ...o,
});

const run = (frames: Frame[]) => {
  let s = initialRepState();
  for (const f of frames) s = step(s, f).state;
  return s;
};

const elbows = (angles: number[]) => angles.map((a) => frame(a));

describe("push-up rep logic", () => {
  it("counts a rep when elbow goes below 90 then above 160", () => {
    expect(run(elbows([170, 120, 85, 120, 165])).reps).toBe(1);
  });

  it("does not count a shallow rep that never goes below 90", () => {
    const s = run(elbows([170, 120, 100, 120, 165]));
    expect(s.reps).toBe(0);
    expect(s.status).toBe("Go Lower");
  });

  it("computes a right angle", () => {
    expect(Math.round(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }))).toBe(90);
  });
});

describe("hip alignment", () => {
  const s = { x: 0.3, y: 0.4 };
  const a = { x: 0.7, y: 0.8 };

  it("accepts a straight plank line", () => {
    const r = hipAlignment(s, { x: 0.5, y: 0.6 }, a);
    expect(Math.round(r.angle)).toBe(180);
    expect(r.break).toBeNull();
  });

  it("flags hips dropped below the line as a sag", () => {
    const r = hipAlignment(s, { x: 0.5, y: 0.7 }, a);
    expect(r.angle).toBeLessThan(170);
    expect(r.break).toBe("sag");
  });

  it("flags hips raised above the line as a pike", () => {
    const r = hipAlignment(s, { x: 0.5, y: 0.5 }, a);
    expect(r.angle).toBeLessThan(170);
    expect(r.break).toBe("pike");
  });
});

describe("side-view lockdown", () => {
  it("detects a side profile when shoulders overlap", () => {
    expect(
      isSideProfile({ x: 0.5, y: 0.3 }, { x: 0.52, y: 0.3 }, { x: 0.5, y: 0.7 }, { x: 0.52, y: 0.7 }),
    ).toBe(true);
  });

  it("rejects a head-on view with wide shoulders", () => {
    expect(
      isSideProfile({ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.35, y: 0.7 }, { x: 0.65, y: 0.7 }),
    ).toBe(false);
  });

  it("locks tracking and counts nothing while facing the camera", () => {
    const s = run(elbows([170, 120, 85, 120, 165]).map((f) => ({ ...f, sideView: false })));
    expect(s.reps).toBe(0);
    expect(s.status).toBe("Turn Sideways");
  });
});

describe("form break invalidation", () => {
  const sag = { angle: 140, break: "sag" as const };

  it("voids a rep when the hips sag during the descent", () => {
    const s = run([frame(170), frame(85), frame(100, { hip: sag }), frame(165)]);
    expect(s.reps).toBe(0);
  });

  it("reports the break while it happens", () => {
    const s = run([frame(170), frame(85), frame(100, { hip: sag })]);
    expect(s.status).toBe("Hips Sagging");
  });

  it("counts the next clean rep after a voided one", () => {
    const s = run([frame(170), frame(85), frame(100, { hip: sag }), frame(165), frame(85), frame(165)]);
    expect(s.reps).toBe(1);
  });
});

describe("chest depth enforcement", () => {
  const deep = (elbow: number, shoulderY: number) => frame(elbow, { shoulderY, ankleY: 1 });

  it("counts a rep whose chest drops at least halfway to the floor line", () => {
    const s = run([deep(170, 0.4), deep(85, 0.72), deep(165, 0.4)]);
    expect(s.reps).toBe(1);
  });

  it("rejects a rep whose chest stays too high", () => {
    const s = run([deep(170, 0.4), deep(85, 0.6), deep(165, 0.4)]);
    expect(s.reps).toBe(0);
    expect(s.status).toBe("Go Lower");
  });
});
