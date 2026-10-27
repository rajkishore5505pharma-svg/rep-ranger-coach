import { describe, expect, it } from "vitest";
import { emptyBadges, tallyBadge } from "@/lib/history";

describe("workout badge tally", () => {
  it("counts a badge when the status changes to it", () => {
    expect(tallyBadge(emptyBadges(), "Good Form", "Go Lower")["Go Lower"]).toBe(1);
  });
  it("does not recount while the status stays the same", () => {
    expect(tallyBadge(emptyBadges(), "Spine Sagging", "Spine Sagging")["Spine Sagging"]).toBe(0);
  });
});
