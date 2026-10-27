export type Pt = { x: number; y: number; visibility?: number };
export type HipBreak = "sag" | "pike";
export type FormStatus =
  | "Get in position"
  | "Turn Sideways"
  | "Good Form"
  | "Go Lower"
  | "Hips Sagging"
  | "Hips Piking";

export const DOWN_ANGLE = 90;
export const UP_ANGLE = 160;
/** Max allowed deviation from a straight 180° shoulder-hip-ankle line. */
export const PLANK_TOLERANCE = 10;
/** Shoulder/hip horizontal overlap ratio below which the view counts as a side profile. */
export const SIDE_VIEW_MAX = 0.45;
/** Chest must drop at least this fraction of the shoulder-to-floor distance for a rep to count. */
export const MIN_DEPTH = 0.5;

export function angle(a: Pt, b: Pt, c: Pt): number {
  const ab = Math.atan2(a.y - b.y, a.x - b.x);
  const cb = Math.atan2(c.y - b.y, c.x - b.x);
  let deg = Math.abs(((ab - cb) * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

/**
 * Shoulder-hip-ankle alignment. Flags a break when the torso line bends more
 * than PLANK_TOLERANCE; "sag" = hips drop toward the floor, "pike" = hips rise.
 * Coordinates are normalized with y growing downward (image space).
 */
export function hipAlignment(s: Pt, h: Pt, a: Pt): { angle: number; break: HipBreak | null } {
  const ang = angle(s, h, a);
  if (180 - ang <= PLANK_TOLERANCE) return { angle: ang, break: null };
  const dx = a.x - s.x;
  const t = Math.abs(dx) < 1e-4 ? 0.5 : (h.x - s.x) / dx;
  const lineY = s.y + t * (a.y - s.y);
  return { angle: ang, break: h.y > lineY ? "sag" : "pike" };
}

/** True when the camera sees a side profile: left/right shoulders and hips nearly overlap horizontally. */
export function isSideProfile(ls: Pt, rs: Pt, lh: Pt, rh: Pt): boolean {
  const span = (Math.abs(ls.x - rs.x) + Math.abs(lh.x - rh.x)) / 2;
  const torso = Math.abs((ls.y + rs.y) / 2 - (lh.y + rh.y) / 2);
  return torso > 1e-4 && span / torso < SIDE_VIEW_MAX;
}

export type Frame = {
  elbow: number;
  hip: { angle: number; break: HipBreak | null } | null;
  /** null = body not visible enough to judge orientation. */
  sideView: boolean | null;
  shoulderY: number | null;
  ankleY: number | null;
};

export type RepState = {
  reps: number;
  phase: "up" | "down";
  minAngle: number;
  status: FormStatus;
  /** Rep in progress was voided by a form break. */
  invalid: boolean;
  /** Highest shoulder position seen (smallest y). */
  topY: number | null;
  /** Deepest chest drop ratio this rep, null when not measurable. */
  maxDepth: number | null;
};

export const initialRepState = (): RepState => ({
  reps: 0,
  phase: "up",
  minAngle: 180,
  status: "Get in position",
  invalid: false,
  topY: null,
  maxDepth: null,
});

/** Advance the counter with one frame of pose measurements. */
export function step(s: RepState, f: Frame): { state: RepState; rep: boolean } {
  const next = { ...s, minAngle: Math.min(s.minAngle, f.elbow) };
  let rep = false;

  if (f.shoulderY !== null) {
    next.topY = next.topY === null ? f.shoulderY : Math.min(next.topY, f.shoulderY);
    if (f.ankleY !== null && f.ankleY - next.topY > 0.05) {
      const depth = (f.shoulderY - next.topY) / (f.ankleY - next.topY);
      next.maxDepth = next.maxDepth === null ? depth : Math.max(next.maxDepth, depth);
    }
  }

  // Side-view lockdown: no tracking while facing the camera.
  if (f.sideView === false) {
    next.status = "Turn Sideways";
    next.phase = "up";
    next.minAngle = 180;
    next.invalid = true;
    next.maxDepth = null;
    return { state: next, rep };
  }

  // Plank break: a sag or pike during the descent voids the rep.
  if (f.hip?.break) {
    next.status = f.hip.break === "sag" ? "Hips Sagging" : "Hips Piking";
    if (next.phase === "down") next.invalid = true;
    return { state: next, rep };
  }

  if (s.phase === "up" && f.elbow < DOWN_ANGLE) {
    next.phase = "down";
    next.status = "Good Form";
  } else if (s.phase === "down" && f.elbow > UP_ANGLE) {
    next.phase = "up";
    next.minAngle = 180;
    const deepEnough = s.maxDepth === null || s.maxDepth >= MIN_DEPTH;
    if (!s.invalid && deepEnough) {
      next.reps = s.reps + 1;
      rep = true;
      next.status = "Good Form";
    } else {
      next.status = deepEnough ? "Good Form" : "Go Lower";
    }
    next.invalid = false;
    next.maxDepth = null;
  } else if (s.phase === "up" && f.elbow > UP_ANGLE && s.minAngle < UP_ANGLE - 20) {
    // came back up without reaching the bottom
    next.status = "Go Lower";
    next.minAngle = 180;
    next.maxDepth = null;
  } else if (next.status !== "Good Form") {
    next.status = "Good Form";
  }
  return { state: next, rep };
}
