import { createFileRoute } from "@tanstack/react-router";
import { ExerciseTracker, type ExerciseConfig } from "@/components/ExerciseTracker";
import { LEAN_MAX, SQUAT_DEPTH, initialSquatState, measureSquat, stepSquat, type SquatFrame, type SquatState } from "@/lib/squat";
import { SQUAT_ALERTS } from "@/lib/voice-coach";

export const Route = createFileRoute("/squats")({
  head: () => ({
    meta: [
      { title: "Squat Tracker — RageBit" },
      { name: "description", content: "Count squats with your phone camera, with a hip depth meter and live back-angle checks." },
      { property: "og:title", content: "RageBit — AI Squat Counter" },
      { property: "og:description", content: "Real-time squat rep counting, depth meter and form checks using your camera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SquatsPage,
});

const SQUATS: ExerciseConfig<SquatState, SquatFrame> = {
  exercise: "squats",
  initial: initialSquatState,
  measure: measureSquat,
  step: stepSquat,
  minDepth: SQUAT_DEPTH,
  readouts: (f) => [
    { text: `Knee ${Math.round(f.knee)}°`, badOn: [] },
    { text: `Back ${Math.round(f.lean)}°`, badOn: ["Chest Up"] },
  ],
  broken: (f) => f.sideView === false || f.lean > LEAN_MAX,
  setupHint: "Stand the phone up about 2–3 m away, side-on, so your whole body from head to feet is in view.",
  startCue: "Let's go! Stand tall and squat.",
  alerts: SQUAT_ALERTS,
  depthLabel: "Hip depth",
};

function SquatsPage() {
  return <ExerciseTracker config={SQUATS} />;
}
