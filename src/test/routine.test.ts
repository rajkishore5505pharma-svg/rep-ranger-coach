import { describe, expect, it } from "vitest";
import { afterRep, clampRoutine, restLeft } from "@/lib/routine";

const r = { sets: 3, target: 10, rest: 60 };

describe("routine mode", () => {
  it("keeps going until the set's target is hit", () => {
    expect(afterRep(r, 0, 9)).toBe("continue");
  });
  it("rests after hitting the target on a set that isn't the last", () => {
    expect(afterRep(r, 0, 10)).toBe("rest");
    expect(afterRep(r, 1, 10)).toBe("rest");
  });
  it("finishes after the target on the last set", () => {
    expect(afterRep(r, 2, 10)).toBe("done");
    expect(afterRep({ ...r, sets: 1 }, 0, 10)).toBe("done");
  });
  it("counts rest down in whole seconds and never below zero", () => {
    expect(restLeft(60_000, 0)).toBe(60);
    expect(restLeft(60_000, 59_100)).toBe(1);
    expect(restLeft(60_000, 61_000)).toBe(0);
  });
  it("keeps settings within limits", () => {
    expect(clampRoutine({ sets: 0, target: 500, rest: 5 }, "pushups")).toEqual({ sets: 1, target: 100, rest: 15 });
    expect(clampRoutine({ sets: 20, target: 1, rest: 999 }, "plank")).toEqual({ sets: 10, target: 5, rest: 180 });
  });
});
