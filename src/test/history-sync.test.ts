import { beforeEach, describe, expect, it } from "vitest";
import { acknowledgePending, deleteWorkout, emptyBadges, guestHistory, loadHistory, pendingWorkouts, replaceCloudHistory, saveWorkout, setHistoryOwner, type Workout } from "@/lib/history";
const workout: Workout = { id: "first", startedAt: 1000, endedAt: 5000, reps: 12, exercise: "pushups", badges: emptyBadges() };
beforeEach(() => { localStorage.clear(); setHistoryOwner(null); });
describe("account history isolation and sync", () => {
  it("keeps guest history separate until explicitly imported", () => {
    saveWorkout(workout); setHistoryOwner("alice");
    expect(loadHistory()).toEqual([]); expect(guestHistory()).toEqual([workout]);
    guestHistory().forEach(saveWorkout); expect(loadHistory()[0]?.reps).toBe(12);
  });
  it("never exposes another account's workouts", () => {
    setHistoryOwner("alice"); saveWorkout(workout); setHistoryOwner("bob");
    expect(loadHistory()).toEqual([]);
    replaceCloudHistory("alice", [workout]); expect(loadHistory()).toEqual([]);
    setHistoryOwner("alice"); expect(loadHistory()).toEqual([workout]);
  });
  it("retains a pending deletion when a stale cloud read arrives", () => {
    setHistoryOwner("alice"); saveWorkout(workout); deleteWorkout(workout.id);
    replaceCloudHistory("alice", [workout]); expect(loadHistory()).toEqual([]);
    expect(pendingWorkouts("alice")[0]?.deleted).toBe(true);
  });
  it("does not acknowledge newer changes made during sync", () => {
    setHistoryOwner("alice"); saveWorkout(workout); const sent = pendingWorkouts("alice");
    deleteWorkout(workout.id); acknowledgePending("alice", sent);
    expect(pendingWorkouts("alice")[0]?.deleted).toBe(true);
  });
  it("imports the same guest workout without duplicates", () => {
    setHistoryOwner("alice"); saveWorkout(workout); saveWorkout(workout);
    expect(loadHistory()).toHaveLength(1); expect(pendingWorkouts("alice")).toHaveLength(1);
  });
});