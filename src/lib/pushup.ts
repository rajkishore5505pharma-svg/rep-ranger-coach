export type Pt = { x: number; y: number; visibility?: number };
export type FormStatus = "Get in position" | "Good Form" | "Go Lower" | "Spine Sagging";

export const DOWN_ANGLE = 90;
export const UP_ANGLE = 160;
export const BODY_STRAIGHT_MIN = 155;

export function angle(a: Pt, b: Pt, c: Pt): number {
  const ab = Math.atan2(a.y - b.y, a.x - b.x);
  const cb = Math.atan2(c.y - b.y, c.x - b.x);
  let deg = Math.abs(((ab - cb) * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

export type RepState = { reps: number; phase: "up" | "down"; minAngle: number; status: FormStatus };
export const initialRepState = (): RepState => ({ reps: 0, phase: "up", minAngle: 180, status: "Get in position" });

/** Advance the counter with one frame's elbow angle and body-line angle (shoulder-hip-ankle). */
export function step(s: RepState, elbow: number, body: number | null): { state: RepState; rep: boolean } {
  const next = { ...s, minAngle: Math.min(s.minAngle, elbow) };
  let rep = false;
  if (body !== null && body < BODY_STRAIGHT_MIN) next.status = "Spine Sagging";
  else if (s.phase === "up" && elbow < DOWN_ANGLE) {
    next.phase = "down";
    next.status = "Good Form";
  } else if (s.phase === "down" && elbow > UP_ANGLE) {
    next.phase = "up";
    next.reps = s.reps + 1;
    next.minAngle = 180;
    next.status = "Good Form";
    rep = true;
  } else if (s.phase === "up" && elbow > UP_ANGLE && s.minAngle < UP_ANGLE - 20) {
    // came back up without reaching the bottom
    next.status = "Go Lower";
    next.minAngle = 180;
  } else if (next.status === "Get in position" || next.status === "Spine Sagging") next.status = "Good Form";
  return { state: next, rep };
}
