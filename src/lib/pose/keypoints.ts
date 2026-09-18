/**
 * Keypoint helpers — lookups, visibility, distance, midpoint.
 * All functions accept normalized (0..1) keypoint coordinates.
 */
import type { KeypointName, PoseKeypoint } from "@/types/pose";

export function getKeypoint(
  keypoints: PoseKeypoint[] | ReadonlyArray<PoseKeypoint>,
  name: KeypointName,
): PoseKeypoint | undefined {
  return keypoints.find((k) => k.name === name);
}

export function isKeypointVisible(
  keypoints: ReadonlyArray<PoseKeypoint>,
  name: KeypointName,
  minScore = 0.3,
): boolean {
  const kp = getKeypoint(keypoints, name);
  return !!kp && kp.score >= minScore;
}

export function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function midPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Compute the angle at vertex `b` formed by points a -> b -> c.
 * Returns degrees 0..360 (clockwise from a's perspective).
 * If any of the three points is missing, returns NaN.
 */
export function angleAt(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined,
  c: { x: number; y: number } | undefined,
): number {
  if (!a || !b || !c) return NaN;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (mag1 === 0 || mag2 === 0) return NaN;
  let cos = dot / (mag1 * mag2);
  // Clamp for floating point safety
  cos = Math.max(-1, Math.min(1, cos));
  const rad = Math.acos(cos);
  return (rad * 180) / Math.PI;
}

/**
 * Joint angle helper — given three keypoints, return the angle at the middle one.
 * Returns NaN if any keypoint is missing or below confidence threshold.
 */
export function jointAngle(
  keypoints: ReadonlyArray<PoseKeypoint>,
  a: KeypointName,
  b: KeypointName,
  c: KeypointName,
  minScore = 0.3,
): number {
  const pa = getKeypoint(keypoints, a);
  const pb = getKeypoint(keypoints, b);
  const pc = getKeypoint(keypoints, c);
  if (!pa || !pb || !pc) return NaN;
  if (pa.score < minScore || pb.score < minScore || pc.score < minScore) return NaN;
  return angleAt(pa, pb, pc);
}

/**
 * Signed angle (degrees, -180..180) — used for left/right detection.
 * Positive when c is to the right of a→b vector (in screen coords y down).
 */
export function signedAngleAt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = v1.x * v2.y - v1.y * v2.x;
  const angle = Math.atan2(cross, dot) * (180 / Math.PI);
  return angle;
}

/**
 * Average keypoint confidence across all keypoints with score > 0.
 */
export function averageConfidence(
  keypoints: ReadonlyArray<PoseKeypoint>,
): number {
  const scored = keypoints.filter((k) => k.score > 0);
  if (scored.length === 0) return 0;
  return scored.reduce((s, k) => s + k.score, 0) / scored.length;
}

/**
 * Average confidence across only the named keypoints (returns NaN if none visible).
 */
export function averageConfidenceOf(
  keypoints: ReadonlyArray<PoseKeypoint>,
  names: KeypointName[],
  minScore = 0.3,
): number {
  const visible = names
    .map((n) => getKeypoint(keypoints, n))
    .filter((k): k is PoseKeypoint => !!k && k.score >= minScore);
  if (visible.length === 0) return NaN;
  return visible.reduce((s, k) => s + k.score, 0) / visible.length;
}
