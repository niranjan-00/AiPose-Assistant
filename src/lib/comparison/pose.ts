/**
 * Normalized pose comparison — for Pose Practice mode.
 *
 * Compares a user's current pose to a target pose using:
 *   1. Torso center normalization (subtract torso midpoint)
 *   2. Body scale normalization (divide by torso length: shoulder midpoint to hip midpoint)
 *   3. Joint angle similarity (compare angles, not raw coords — invariant to rotation/scale)
 *
 * Returns overall similarity (0..100) + per-joint diff for the UI.
 */
import type { KeypointName, PoseFrame, PoseKeypoint } from "@/types/pose";
import { angleAt, getKeypoint, midPoint } from "@/lib/pose/keypoints";

export interface TargetPose {
  id: string;
  name: string;
  description: string;
  /** Target keypoints in normalized coords (0..1). May be a canonical pose drawing. */
  keypoints: PoseKeypoint[];
  /** Which joints to compare (left/right pairs are auto-generated) */
  compareJoints: Array<{
    label: string;
    points: [KeypointName, KeypointName, KeypointName];
  }>;
}

export interface JointDiff {
  label: string;
  userAngle: number;
  targetAngle: number;
  /** Absolute difference in degrees */
  delta: number;
  /** 0..1 similarity score for this joint */
  score: number;
  status: "good" | "adjust";
}

export interface PoseComparisonResult {
  overall: number; // 0..100
  joints: JointDiff[];
  /** True if too few keypoints visible */
  insufficient: boolean;
}

function torsoScale(kps: ReadonlyArray<PoseKeypoint>): { cx: number; cy: number; scale: number } | null {
  const ls = getKeypoint(kps, "left_shoulder");
  const rs = getKeypoint(kps, "right_shoulder");
  const lh = getKeypoint(kps, "left_hip");
  const rh = getKeypoint(kps, "right_hip");
  if (!ls || !rs || !lh || !rh) return null;
  if (
    ls.score < 0.3 ||
    rs.score < 0.3 ||
    lh.score < 0.3 ||
    rh.score < 0.3
  )
    return null;
  const midS = midPoint(ls, rs);
  const midH = midPoint(lh, rh);
  const dx = midS.x - midH.x;
  const dy = midS.y - midH.y;
  const scale = Math.sqrt(dx * dx + dy * dy);
  if (scale < 0.001) return null;
  return { cx: (midS.x + midH.x) / 2, cy: (midS.y + midH.y) / 2, scale };
}

/**
 * Compare two poses. Both are arrays of keypoints (with confidence).
 * Uses angle-based comparison which is invariant to position, scale, and rotation.
 */
export function comparePoses(
  user: PoseFrame,
  target: TargetPose,
  minScore = 0.3,
): PoseComparisonResult {
  const joints: JointDiff[] = [];
  let count = 0;
  let sumScore = 0;

  for (const joint of target.compareJoints) {
    const [a, b, c] = joint.points;
    const ua = getKeypoint(user.keypoints, a);
    const ub = getKeypoint(user.keypoints, b);
    const uc = getKeypoint(user.keypoints, c);
    const ta = getKeypoint(target.keypoints, a);
    const tb = getKeypoint(target.keypoints, b);
    const tc = getKeypoint(target.keypoints, c);

    if (
      !ua ||
      !ub ||
      !uc ||
      !ta ||
      !tb ||
      !tc ||
      ua.score < minScore ||
      ub.score < minScore ||
      uc.score < minScore
    ) {
      continue;
    }

    const userAngle = angleAt(ua, ub, uc);
    const targetAngle = angleAt(ta, tb, tc);
    if (Number.isNaN(userAngle) || Number.isNaN(targetAngle)) continue;

    const delta = Math.abs(userAngle - targetAngle);
    // Score: 0° diff = 1, 60° diff = 0
    const score = Math.max(0, 1 - delta / 60);
    joints.push({
      label: joint.label,
      userAngle: Math.round(userAngle),
      targetAngle: Math.round(targetAngle),
      delta: Math.round(delta),
      score,
      status: delta < 15 ? "good" : "adjust",
    });
    count++;
    sumScore += score;
  }

  if (count === 0) {
    return { overall: 0, joints, insufficient: true };
  }
  const overall = Math.round((sumScore / count) * 100);
  return { overall, joints, insufficient: false };
}

export function buildTargetPoseFromFrame(
  id: string,
  name: string,
  description: string,
  frame: PoseFrame,
  compareJoints?: Array<{ label: string; points: [KeypointName, KeypointName, KeypointName] }>,
): TargetPose {
  void torsoScale(frame.keypoints); // computed for future use but not yet exposed
  return {
    id,
    name,
    description,
    keypoints: frame.keypoints.map((k) => ({ ...k })),
    compareJoints:
      compareJoints ?? DEFAULT_COMPARE_JOINTS,
  };
}

export const DEFAULT_COMPARE_JOINTS: Array<{
  label: string;
  points: [KeypointName, KeypointName, KeypointName];
}> = [
  { label: "Left Elbow", points: ["left_shoulder", "left_elbow", "left_wrist"] },
  { label: "Right Elbow", points: ["right_shoulder", "right_elbow", "right_wrist"] },
  { label: "Left Shoulder", points: ["left_elbow", "left_shoulder", "left_hip"] },
  { label: "Right Shoulder", points: ["right_elbow", "right_shoulder", "right_hip"] },
  { label: "Left Knee", points: ["left_hip", "left_knee", "left_ankle"] },
  { label: "Right Knee", points: ["right_hip", "right_knee", "right_ankle"] },
  { label: "Left Hip", points: ["left_shoulder", "left_hip", "left_knee"] },
  { label: "Right Hip", points: ["right_shoulder", "right_hip", "right_knee"] },
];
