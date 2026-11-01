import { createFileRoute } from "@tanstack/react-router";
import { ExerciseTracker, type ExerciseConfig } from "@/components/ExerciseTracker";
import { MIN_DEPTH, initialRepState, measurePose, step, type Frame, type RepState } from "@/lib/pushup";
import { ALERTS } from "@/lib/voice-coach";

export const Route = createFileRoute("/pushups")({
  head: () => ({
    meta: [
      { title: "Push-Up Tracker — RageBit" },
      { name: "description", content: "Count push-ups in real time with your phone camera and get live form feedback." },
      { property: "og:title", content: "RageBit — AI Push-Up Counter" },
      { property: "og:description", content: "Real-time push-up rep counting and form checks using your camera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PushupsPage,
});

const PUSHUPS: ExerciseConfig<RepState, Frame> = {
  exercise: "pushups",
  initial: initialRepState,
  measure: measurePose,
  step,
  minDepth: MIN_DEPTH,
  readouts: (f) => [
    { text: `Elbow ${Math.round(f.elbow)}°`, badOn: [] },
    ...(f.hip ? [{ text: `Spine ${Math.round(f.hip.angle)}°`, badOn: ["Hips Sagging", "Hips Piking"] as RepState["status"][] }] : []),
  ],
  broken: (f) => f.sideView === false || f.hip?.break != null,
  setupHint: "Prop your phone on the floor, side-on to your body.",
  startCue: "Let's go! Get into your plank.",
  alerts: ALERTS,
  depthLabel: "Chest depth",
};

function PushupsPage() {
  return <ExerciseTracker config={PUSHUPS} />;
}
