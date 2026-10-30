export type Pt = { x: number; y: number; visibility?: number };
export type HipBreak = "sag" | "pike";
export type FormStatus =
  | "Get in position"
  | "Turn Sideways"
  | "Good Form"
  | "Go Lower"
  | "Hips Sagging"
  | "Hips Piking";

export const DOWN_ANGLE = 100;
export const UP_ANGLE = 160;
/** Max allowed deviation from a straight 180° shoulder-hip-ankle line. */
export const PLANK_TOLERANCE = 10;
/** Shoulder/hip horizontal overlap ratio below which the view counts as a side profile. */
export const SIDE_VIEW_MAX = 0.45;
/** Chest descent relative to arm length measured at the top. */
export const MIN_DEPTH = 0.65;
export const MIN_VISIBILITY = 0.5;
export const EMA_ALPHA = 0.35;

const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Coordinates use image-height units, correcting the camera's aspect ratio. */
export function smoothPose(previous: (Pt | null)[], raw: Pt[], aspect: number): (Pt | null)[] {
  return raw.map((p, i) => {
    if ((p.visibility ?? 0) < MIN_VISIBILITY || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const current = { ...p, x: p.x * aspect };
    const old = previous[i];
    return old ? {
      ...current,
      x: old.x + EMA_ALPHA * (current.x - old.x),
      y: old.y + EMA_ALPHA * (current.y - old.y),
    } : current;
  });
}

export function measurePose(pose: (Pt | null)[]): Frame | null {
  const quality = (indices: number[]) => indices.every((i) => pose[i])
    ? indices.reduce((sum, i) => sum + (pose[i]?.visibility ?? 0), 0) : -1;
  const left = quality([11, 13, 15, 23]) >= quality([12, 14, 16, 24]);
  const [s, e, w, h, a, k] = left ? [11, 13, 15, 23, 27, 25] : [12, 14, 16, 24, 28, 26];
  const shoulder = pose[s], elbow = pose[e], wrist = pose[w], hip = pose[h];
  const leg = pose[a] ?? pose[k];
  const ls = pose[11], rs = pose[12], lh = pose[23], rh = pose[24];
  if (!shoulder || !elbow || !wrist || !hip || !leg || !ls || !rs || !lh || !rh) return null;
  const armLength = distance(shoulder, elbow) + distance(elbow, wrist);
  if (armLength < 1e-4) return null;
  return {
    elbow: angle(shoulder, elbow, wrist),
    hip: hipAlignment(shoulder, hip, leg),
    sideView: isSideProfile(ls, rs, lh, rh),
    shoulderY: shoulder.y,
    armLength,
    // Plank = body line closer to horizontal than vertical; standing arm bends never count.
    horizontal: Math.abs(leg.y - shoulder.y) < Math.abs(leg.x - shoulder.x),
  };
}

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
  const dx = a.x - s.x, dy = a.y - s.y;
  // Orient the signed cross product to image-down, independent of facing direction.
  const signed = (dx * (h.y - s.y) - dy * (h.x - s.x)) * (dx < 0 ? -1 : 1);
  return { angle: ang, break: signed > 0 ? "sag" : "pike" };
}

/** True when the camera sees a side profile: left/right shoulders and hips nearly overlap horizontally. */
export function isSideProfile(ls: Pt, rs: Pt, lh: Pt, rh: Pt): boolean {
  const span = (Math.abs(ls.x - rs.x) + Math.abs(lh.x - rh.x)) / 2;
  const torso = Math.hypot((ls.x + rs.x - lh.x - rh.x) / 2, (ls.y + rs.y - lh.y - rh.y) / 2);
  return torso > 1e-4 && span / torso < SIDE_VIEW_MAX;
}

export type Frame = {
  elbow: number;
  hip: { angle: number; break: HipBreak | null } | null;
  /** null = body not visible enough to judge orientation. */
  sideView: boolean | null;
  shoulderY: number | null;
  armLength: number | null;
  /** false = upright (standing/kneeling up), not in a plank. */
  horizontal?: boolean;
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
  topArmLength: number | null;
  ready: boolean;
};

export const initialRepState = (): RepState => ({
  reps: 0,
  phase: "up",
  minAngle: 180,
  status: "Get in position",
  invalid: false,
  topY: null,
  maxDepth: null,
  topArmLength: null,
  ready: false,
});

/** Advance the counter with one frame of pose measurements. */
export function step(s: RepState, f: Frame | null): { state: RepState; rep: boolean } {
  if (!f || f.sideView === null || !f.hip || f.shoulderY === null || f.armLength === null || f.horizontal === false) {
    return { state: { ...initialRepState(), reps: s.reps }, rep: false };
  }
  const next = { ...s, minAngle: Math.min(s.minAngle, f.elbow) };
  let rep = false;

  // Side-view lockdown: no tracking while facing the camera.
  if (f.sideView === false) {
    next.status = "Turn Sideways";
    next.phase = "up";
    next.minAngle = 180;
    next.invalid = true;
    next.maxDepth = null;
    next.topY = null;
    next.topArmLength = null;
    next.ready = false;
    return { state: next, rep };
  }

  // Plank break: a sag or pike during the descent voids the rep.
  if (f.hip?.break) {
    next.status = f.hip.break === "sag" ? "Hips Sagging" : "Hips Piking";
    next.invalid = true;
    if (next.phase === "up") next.ready = false;
    return { state: next, rep };
  }

  if (s.phase === "up" && f.elbow > UP_ANGLE) {
    next.ready = true;
    next.invalid = false;
    if (next.topY === null || f.shoulderY <= next.topY) {
      next.topY = f.shoulderY;
      next.topArmLength = f.armLength;
    }
  }
  if (next.ready && next.topY !== null && next.topArmLength !== null && next.topArmLength > 1e-4) {
    const depth = (f.shoulderY - next.topY) / next.topArmLength;
    next.maxDepth = Math.max(next.maxDepth ?? 0, depth);
  }

  if (s.phase === "up" && next.ready && f.elbow < DOWN_ANGLE) {
    next.phase = "down";
    next.status = "Good Form";
  } else if (s.phase === "down" && f.elbow > UP_ANGLE) {
    next.phase = "up";
    next.minAngle = 180;
    const deepEnough = next.maxDepth !== null && next.maxDepth + 1e-9 >= MIN_DEPTH;
    if (!s.invalid && deepEnough) {
      next.reps = s.reps + 1;
      rep = true;
      next.status = "Good Form";
    } else {
      next.status = deepEnough ? "Good Form" : "Go Lower";
    }
    next.invalid = false;
    next.maxDepth = null;
    next.topY = f.shoulderY;
    next.topArmLength = f.armLength;
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
