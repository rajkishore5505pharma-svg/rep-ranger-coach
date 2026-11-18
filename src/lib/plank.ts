import { GRACE_FRAMES, PLANK_TOLERANCE, measurePose, type Pt } from "./pushup";

export type PlankStatus = "Get in position" | "Turn Sideways" | "Good Form" | "Hips Sagging" | "Hips Piking";

/** Meter value where the green line sits; the meter is full at 1.25 (perfectly straight). */
export const PLANK_LINE = 1;
/** Straightness that fills the meter bar — lower than the old 1.25 so a good plank reads high. */
export const PLANK_METER_FULL = PLANK_LINE * 1.05;
/** Seconds between spoken/beeped hold counts. */
export const PLANK_CUE_EVERY = 5;

export type PlankFrame = {
  /** Shoulder–hip–ankle angle (180 = straight). */
  hipAngle: number;
  hipBreak: "sag" | "pike" | null;
  sideView: boolean | null;
  horizontal: boolean;
  /** Timestamp in ms. */
  t: number;
};

/** Straightness for the meter: 1.25 at 180°, PLANK_LINE at the tolerance edge, 0 when far off. */
export function straightness(hipAngle: number) {
  const dev = Math.abs(180 - hipAngle);
  return Math.max(0, PLANK_LINE * 1.25 * (1 - (0.2 * dev) / PLANK_TOLERANCE));
}

/** Expects smoothed, aspect-corrected landmarks from smoothPose. Reuses push-up body-line geometry. */
export function measurePlank(pose: (Pt | null)[], t: number = Date.now()): PlankFrame | null {
  const f = measurePose(pose);
  if (!f || !f.hip) return null;
  return { hipAngle: f.hip.angle, hipBreak: f.hip.break, sideView: f.sideView, horizontal: f.horizontal !== false, t };
}

export type PlankState = {
  /** Whole seconds held with good form. */
  reps: number;
  status: PlankStatus;
  /** Good-form hold time in ms, including the partial second. */
  heldMs: number;
  lastT: number | null;
  depth: number;
  missFrames: number;
  offFrames: number;
  breakFrames: number;
};

export const initialPlankState = (): PlankState => ({
  reps: 0, status: "Get in position", heldMs: 0, lastT: null, depth: 0, missFrames: 0, offFrames: 0, breakFrames: 0,
});

/** Max gap between frames counted as hold time (stops a stalled camera adding time). */
const MAX_GAP_MS = 250;

/**
 * Advance the plank timer. Time only accrues in a side-on, horizontal, straight plank.
 * Brief glitches (≤ GRACE_FRAMES) keep the timer running; sustained breaks pause it (time already held is kept).
 * `rep` is true each time another whole second is completed.
 */
export function stepPlank(s: PlankState, f: PlankFrame | null): { state: PlankState; rep: boolean } {
  if (!f || f.sideView === null) {
    const missFrames = s.missFrames + 1;
    if (missFrames <= GRACE_FRAMES) return { state: { ...s, missFrames }, rep: false };
    return { state: { ...s, missFrames, lastT: null, depth: 0, status: "Get in position" }, rep: false };
  }
  const next: PlankState = { ...s, missFrames: 0 };
  const dt = s.lastT === null ? 0 : Math.min(MAX_GAP_MS, Math.max(0, f.t - s.lastT));
  next.lastT = f.t;

  if (f.sideView === false || !f.horizontal) {
    next.offFrames = s.offFrames + 1;
    next.depth = 0;
    if (next.offFrames > GRACE_FRAMES) {
      next.status = f.sideView === false ? "Turn Sideways" : "Get in position";
      return { state: next, rep: false };
    }
  } else {
    next.offFrames = 0;
    next.depth = straightness(f.hipAngle);
    if (f.hipBreak) {
      next.breakFrames = s.breakFrames + 1;
      if (next.breakFrames > GRACE_FRAMES) {
        next.status = f.hipBreak === "sag" ? "Hips Sagging" : "Hips Piking";
        return { state: next, rep: false };
      }
    } else next.breakFrames = 0;
    if (s.status === "Get in position" || s.status === "Turn Sideways" || next.breakFrames === 0) next.status = "Good Form";
  }

  if (next.status !== "Good Form") return { state: next, rep: false };
  next.heldMs = s.heldMs + dt;
  next.reps = Math.floor(next.heldMs / 1000);
  return { state: next, rep: next.reps > s.reps };
}
