import { GRACE_FRAMES, angle, isSideProfile, type Pt } from "./pushup";

export type SquatStatus = "Get in position" | "Turn Sideways" | "Good Form" | "Go Lower" | "Chest Up";

/** Knee angle above which the user counts as standing tall. */
export const STAND_KNEE = 150;
/** Knee angle below which the bottom is reached even if the hip drop reads short (≈ near parallel). */
export const BOTTOM_KNEE = 115;
/** Hip drop relative to standing thigh length needed at the bottom (about halfway to parallel). */
export const SQUAT_DEPTH = 0.45;
/** Hip drop below which the user is back at the top. */
export const SQUAT_TOP = 0.2;
/** A dip deeper than this that never reaches SQUAT_DEPTH earns "Go Lower". */
export const SQUAT_SHALLOW = 0.2;
/** Max torso lean from vertical (degrees) before "Chest Up". */
export const LEAN_MAX = 55;

const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export type SquatFrame = {
  knee: number;
  /** Torso angle from vertical, degrees. */
  lean: number;
  sideView: boolean | null;
  hipY: number;
  thighLength: number;
  /** false = lying down / not on feet. */
  upright: boolean;
};

/** Expects smoothed, aspect-corrected landmarks from smoothPose. */
export function measureSquat(pose: (Pt | null)[]): SquatFrame | null {
  const quality = (indices: number[]) => indices.every((i) => pose[i])
    ? indices.reduce((sum, i) => sum + (pose[i]?.visibility ?? 0), 0) : -1;
  const left = quality([11, 23, 25, 27]) >= quality([12, 24, 26, 28]);
  const [s, h, k, a] = left ? [11, 23, 25, 27] : [12, 24, 26, 28];
  const shoulder = pose[s], hip = pose[h], knee = pose[k], ankle = pose[a];
  const ls = pose[11], rs = pose[12], lh = pose[23], rh = pose[24];
  if (!shoulder || !hip || !knee || !ankle) return null;
  const thighLength = distance(hip, knee);
  if (thighLength < 1e-4) return null;
  return {
    knee: angle(hip, knee, ankle),
    lean: (Math.atan2(Math.abs(shoulder.x - hip.x), Math.max(1e-6, hip.y - shoulder.y)) * 180) / Math.PI,
    // In a true side view the far shoulder/hip are hidden behind the body, so missing ones mean side-on.
    sideView: ls && rs && lh && rh ? isSideProfile(ls, rs, lh, rh) : true,
    hipY: hip.y,
    thighLength,
    upright: ankle.y - shoulder.y > Math.abs(ankle.x - shoulder.x),
  };
}

export type SquatState = {
  reps: number;
  phase: "up" | "down";
  status: SquatStatus;
  invalid: boolean;
  ready: boolean;
  /** Hip height while standing (smallest y) and thigh length measured there. */
  topY: number | null;
  topThigh: number | null;
  maxDepth: number;
  /** Current hip drop as a fraction of thigh length (0 = standing). */
  depth: number;
  missFrames: number;
  offFrames: number;
  leanFrames: number;
};

export const initialSquatState = (): SquatState => ({
  reps: 0, phase: "up", status: "Get in position", invalid: false, ready: false,
  topY: null, topThigh: null, maxDepth: 0, depth: 0, missFrames: 0, offFrames: 0, leanFrames: 0,
});

/** Advance the squat counter with one frame. Brief glitches (≤ GRACE_FRAMES) are ignored. */
export function stepSquat(s: SquatState, f: SquatFrame | null): { state: SquatState; rep: boolean } {
  if (!f || f.sideView === null) {
    if (s.missFrames + 1 <= GRACE_FRAMES) return { state: { ...s, missFrames: s.missFrames + 1 }, rep: false };
    return { state: { ...initialSquatState(), reps: s.reps, missFrames: s.missFrames + 1 }, rep: false };
  }
  const next: SquatState = { ...s, missFrames: 0 };
  let rep = false;

  if (f.sideView === false || !f.upright) {
    next.offFrames = s.offFrames + 1;
    if (next.offFrames <= GRACE_FRAMES) return { state: next, rep };
    return {
      state: { ...initialSquatState(), reps: s.reps, offFrames: next.offFrames, status: f.sideView === false ? "Turn Sideways" : "Get in position" },
      rep,
    };
  }
  next.offFrames = 0;

  let leanStatus: SquatStatus | null = null;
  if (f.lean > LEAN_MAX) {
    next.leanFrames = s.leanFrames + 1;
    if (next.leanFrames > GRACE_FRAMES) { next.invalid = true; leanStatus = "Chest Up"; }
  } else next.leanFrames = 0;

  const standing = f.knee > STAND_KNEE;
  if (s.phase === "up" && standing) {
    if (!next.ready) next.invalid = leanStatus !== null;
    next.ready = true;
    if (next.topY === null || f.hipY <= next.topY) { next.topY = f.hipY; next.topThigh = f.thighLength; }
  }
  let depth = 0;
  if (next.ready && next.topY !== null && next.topThigh) {
    depth = Math.max(0, (f.hipY - next.topY) / next.topThigh);
    next.maxDepth = Math.max(next.maxDepth, depth);
  }
  next.depth = depth;

  if (s.phase === "up" && next.ready && (depth >= SQUAT_DEPTH || (f.knee < BOTTOM_KNEE && depth >= SQUAT_SHALLOW))) {
    next.phase = "down";
    next.status = "Good Form";
  } else if (s.phase === "down" && (standing || depth < SQUAT_TOP)) {
    next.phase = "up";
    if (!next.invalid) { next.reps = s.reps + 1; rep = true; }
    next.status = "Good Form";
    next.invalid = false;
    next.maxDepth = 0;
    next.topY = f.hipY;
    next.topThigh = f.thighLength;
  } else if (s.phase === "up" && standing && s.maxDepth > SQUAT_SHALLOW) {
    next.status = "Go Lower";
    next.maxDepth = 0;
    next.invalid = false;
  } else if (next.ready && next.status !== "Good Form" && next.status !== "Go Lower") {
    next.status = "Good Form";
  }
  if (leanStatus && !rep) next.status = leanStatus;
  return { state: next, rep };
}
