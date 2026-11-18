import { createFileRoute } from "@tanstack/react-router";
import { ExerciseTracker, type ExerciseConfig } from "@/components/ExerciseTracker";
import { PLANK_CUE_EVERY, PLANK_LINE, PLANK_METER_FULL, initialPlankState, measurePlank, stepPlank, type PlankFrame, type PlankState } from "@/lib/plank";
import { PLANK_ALERTS } from "@/lib/voice-coach";

export const Route = createFileRoute("/plank")({
  head: () => ({
    meta: [
      { title: "Plank Timer — RageBit" },
      { name: "description", content: "Time your plank with your phone camera. The clock only runs while your body stays in a straight line." },
      { property: "og:title", content: "RageBit — AI Plank Timer" },
      { property: "og:description", content: "Camera plank timer with a live hip-line meter and sag/pike checks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlankPage,
});

const PLANK: ExerciseConfig<PlankState, PlankFrame> = {
  exercise: "plank",
  initial: initialPlankState,
  measure: (pose) => measurePlank(pose, performance.now()),
  step: stepPlank,
  minDepth: PLANK_LINE,
  meter: { fullAt: PLANK_METER_FULL },
  readouts: (f) => [{ text: `Spine ${Math.round(f.hipAngle)}°`, badOn: ["Hips Sagging", "Hips Piking"] }],
  broken: (f) => f.sideView === false || f.hipBreak !== null,
  setupHint: "Prop the phone on the floor about 1.5–2 m away, side-on, so your whole body from head to feet is in view.",
  startCue: "Let's go! Get into your plank and hold.",
  alerts: PLANK_ALERTS,
  depthLabel: "Line",
  unit: "seconds",
  cueEvery: PLANK_CUE_EVERY,
};

function PlankPage() {
  return <ExerciseTracker config={PLANK} />;
}
