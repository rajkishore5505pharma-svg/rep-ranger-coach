import { describe, expect, it } from "vitest";
import { createGate, cuesFor } from "@/lib/voice-coach";

describe("voice coach", () => {
  it("speaks rep number", () => {
    expect(cuesFor("Good Form", "Good Form", true, 3)[0].text).toBe("Three!");
  });
  it("adds milestones at 5 and 10", () => {
    expect(cuesFor("Good Form", "Good Form", true, 5).map((c) => c.text)).toContain("Solid form, keep pushing!");
    expect(cuesFor("Good Form", "Good Form", true, 10).map((c) => c.text)).toContain("Halfway there, stay strong!");
  });
  it("warns on sag, pike, depth, orientation", () => {
    expect(cuesFor("Good Form", "Hips Sagging", false, 0)[0].text).toBe("Hips up! Keep your core tight.");
    expect(cuesFor("Good Form", "Hips Piking", false, 0)[0].text).toBe("Lower your hips! Maintain a straight line.");
    expect(cuesFor("Good Form", "Go Lower", false, 0)[0].text).toBe("Go lower! Full range of motion.");
    expect(cuesFor("Good Form", "Turn Sideways", false, 0)[0].text).toBe("Turn sideways to the camera.");
  });
  it("blocks same alert within 2.8s but never rep counts", () => {
    const gate = createGate();
    const sag = { key: "Hips Sagging", text: "", urgent: false };
    expect(gate(sag, 0)).toBe(true);
    expect(gate(sag, 2000)).toBe(false);
    expect(gate(sag, 2900)).toBe(true);
    const rep = { key: "rep", text: "", urgent: true };
    expect(gate(rep, 0) && gate(rep, 10)).toBe(true);
  });
});
