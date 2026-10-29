import { describe, expect, it } from "vitest";
import { angle, hipAlignment, initialRepState, isSideProfile, measurePose, smoothPose, step, type Frame, type Pt } from "@/lib/pushup";

const frame = (elbow: number, o: Partial<Frame> = {}): Frame => ({
  elbow,
  hip: { angle: 180, break: null },
  sideView: true,
  shoulderY: elbow < 100 ? 0.73 : 0.4,
  armLength: 0.5,
  ...o,
});

const run = (frames: Frame[]) => {
  let s = initialRepState();
  for (const f of frames) s = step(s, f).state;
  return s;
};

const elbows = (angles: number[]) => angles.map((a) => frame(a));

describe("push-up rep logic", () => {
  it("counts a rep when elbow goes below 100 then above 160", () => {
    expect(run(elbows([170, 120, 99, 120, 165])).reps).toBe(1);
  });

  it("does not count a shallow rep that never goes below 100", () => {
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
  const deep = (elbow: number, shoulderY: number) => frame(elbow, { shoulderY, armLength: 0.5 });

  it("counts a rep whose chest drops 65% of arm length", () => {
    const s = run([deep(170, 0.4), deep(99, 0.725), deep(165, 0.4)]);
    expect(s.reps).toBe(1);
  });

  it("rejects a rep whose chest stays too high", () => {
    const s = run([deep(170, 0.4), deep(85, 0.6), deep(165, 0.4)]);
    expect(s.reps).toBe(0);
    expect(s.status).toBe("Go Lower");
  });
});

describe("stable camera measurements", () => {
  it("accepts a horizontal side-on torso", () => {
    expect(isSideProfile({ x: 0.2, y: 0.4 }, { x: 0.21, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.61, y: 0.4 })).toBe(true);
  });

  it("classifies sag and pike identically when mirrored", () => {
    const mirror = (p: Pt) => ({ x: 1 - p.x, y: p.y });
    const s = { x: 0.2, y: 0.4 }, a = { x: 0.8, y: 0.4 };
    for (const [y, kind] of [[0.5, "sag"], [0.3, "pike"]] as const) {
      const h = { x: 0.5, y };
      expect(hipAlignment(s, h, a).break).toBe(kind);
      expect(hipAlignment(mirror(s), mirror(h), mirror(a)).break).toBe(kind);
    }
  });

  it("keeps the 10-degree plank tolerance", () => {
    const h = { x: 0, y: 0 }, s = { x: -1, y: 0 };
    const a = (degrees: number) => ({ x: Math.cos(degrees * Math.PI / 180), y: Math.sin(degrees * Math.PI / 180) });
    expect(hipAlignment(s, h, a(9)).break).toBeNull();
    expect(hipAlignment(s, h, a(11)).break).not.toBeNull();
  });

  it("smooths landmarks with EMA and corrects camera aspect ratio", () => {
    const first = smoothPose([], [{ x: 0.2, y: 0.4, visibility: 1 }], 2);
    const second = smoothPose(first, [{ x: 0.4, y: 0.6, visibility: 1 }], 2);
    expect(second[0]?.x).toBeCloseTo(0.54);
    expect(second[0]?.y).toBeCloseTo(0.47);
  });

  it("rejects visibility below 0.5 without reusing stale landmarks", () => {
    const first = smoothPose([], [{ x: 0.2, y: 0.4, visibility: 1 }], 1);
    expect(smoothPose(first, [{ x: 0.2, y: 0.4, visibility: 0.49 }], 1)[0]).toBeNull();
    expect(smoothPose([], [{ x: 0.2, y: 0.4, visibility: 0.5 }], 1)[0]).not.toBeNull();
    expect(measurePose(first)).toBeNull();
  });

  it("never counts across missing pose data", () => {
    let s = run(elbows([170, 85]));
    s = step(s, null).state;
    expect(step(s, frame(165)).state.reps).toBe(0);
  });

  it("requires measurable depth and a top position before counting", () => {
    expect(run(elbows([85, 165])).reps).toBe(0);
    expect(run(elbows([170, 85, 165]).map((f) => ({ ...f, armLength: null }))).reps).toBe(0);
  });

  it("normalizes depth across camera distances", () => {
    for (const scale of [0.5, 1, 2]) {
      const frames = elbows([170, 99, 165]).map((f) => ({ ...f, shoulderY: (f.shoulderY ?? 0) * scale, armLength: 0.5 * scale }));
      expect(run(frames).reps).toBe(1);
    }
  });

  it("clears the orientation lock before the next clean rep", () => {
    expect(run([frame(170, { sideView: false }), frame(170), frame(99), frame(165)]).reps).toBe(1);
  });

  it("counts a full landmark sequence through smoothing and measurement", () => {
    let previous: (Pt | null)[] = [], state = initialRepState();
    const pose = (down: boolean): Pt[] => {
      const y = down ? 0.65 : 0.3;
      const points = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
      for (const [s, e, w, h, a] of [[11, 13, 15, 23, 27], [12, 14, 16, 24, 28]]) {
        points[s] = { x: 0.3, y, visibility: 1 };
        points[e] = { x: down ? 0.05 : 0.3, y: down ? y : y + 0.25, visibility: 1 };
        points[w] = { x: down ? 0.05 : 0.3, y: down ? y + 0.25 : y + 0.5, visibility: 1 };
        points[h] = { x: 0.6, y, visibility: 1 };
        points[a] = { x: 0.95, y, visibility: 1 };
      }
      return points;
    };
    for (const down of [false, true, false]) {
      for (let i = 0; i < 40; i++) {
        previous = smoothPose(previous, pose(down), 1);
        state = step(state, measurePose(previous)).state;
      }
    }
    expect(state.reps).toBe(1);
    expect(state.status).toBe("Good Form");
  });
});
