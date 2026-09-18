/**
 * Built-in target poses for Pose Practice mode.
 * Coordinates are normalized (0..1) in a canonical standing pose.
 */
import type { KeypointName, PoseKeypoint } from "@/types/pose";
import type { TargetPose } from "@/lib/comparison/pose";
import { DEFAULT_COMPARE_JOINTS } from "@/lib/comparison/pose";

export type { TargetPose };

function kp(name: KeypointName, x: number, y: number, score = 1): PoseKeypoint {
  return { name, x, y, score };
}

/** T-Pose — arms straight out to the sides, standing tall. */
export const T_POSE: TargetPose = {
  id: "t-pose",
  name: "T-Pose",
  description: "Stand tall with arms straight out to the sides, parallel to the ground.",
  keypoints: [
    kp("nose", 0.5, 0.18),
    kp("left_eye", 0.48, 0.17),
    kp("right_eye", 0.52, 0.17),
    kp("left_ear", 0.45, 0.2),
    kp("right_ear", 0.55, 0.2),
    kp("left_shoulder", 0.4, 0.32),
    kp("right_shoulder", 0.6, 0.32),
    kp("left_elbow", 0.25, 0.34),
    kp("right_elbow", 0.75, 0.34),
    kp("left_wrist", 0.1, 0.36),
    kp("right_wrist", 0.9, 0.36),
    kp("left_hip", 0.43, 0.55),
    kp("right_hip", 0.57, 0.55),
    kp("left_knee", 0.43, 0.78),
    kp("right_knee", 0.57, 0.78),
    kp("left_ankle", 0.43, 0.95),
    kp("right_ankle", 0.57, 0.95),
  ],
  compareJoints: DEFAULT_COMPARE_JOINTS,
};

/** Hands Up — arms raised overhead, standing. */
export const HANDS_UP: TargetPose = {
  id: "hands-up",
  name: "Hands Up",
  description: "Stand with arms straight overhead, biceps by your ears.",
  keypoints: [
    kp("nose", 0.5, 0.2),
    kp("left_shoulder", 0.42, 0.42),
    kp("right_shoulder", 0.58, 0.42),
    kp("left_elbow", 0.4, 0.28),
    kp("right_elbow", 0.6, 0.28),
    kp("left_wrist", 0.39, 0.14),
    kp("right_wrist", 0.61, 0.14),
    kp("left_hip", 0.44, 0.6),
    kp("right_hip", 0.56, 0.6),
    kp("left_knee", 0.44, 0.8),
    kp("right_knee", 0.56, 0.8),
    kp("left_ankle", 0.44, 0.95),
    kp("right_ankle", 0.56, 0.95),
  ],
  compareJoints: DEFAULT_COMPARE_JOINTS,
};

/** Tree Pose (yoga) — one leg bent, foot on inner thigh, hands overhead. */
export const TREE_POSE: TargetPose = {
  id: "tree-pose",
  name: "Tree Pose",
  description: "Stand on one leg with the other foot on your inner thigh, hands pressed overhead.",
  keypoints: [
    kp("nose", 0.5, 0.18),
    kp("left_shoulder", 0.42, 0.34),
    kp("right_shoulder", 0.58, 0.34),
    kp("left_elbow", 0.44, 0.22),
    kp("right_elbow", 0.56, 0.22),
    kp("left_wrist", 0.46, 0.1),
    kp("right_wrist", 0.54, 0.1),
    kp("left_hip", 0.44, 0.56),
    kp("right_hip", 0.56, 0.56),
    kp("left_knee", 0.36, 0.74), // bent outward
    kp("right_knee", 0.56, 0.78),
    kp("left_ankle", 0.46, 0.88), // resting near right inner thigh
    kp("right_ankle", 0.56, 0.95),
  ],
  compareJoints: DEFAULT_COMPARE_JOINTS,
};

/** Warrior Pose — wide stance, front knee bent, arms out to the sides. */
export const WARRIOR_POSE: TargetPose = {
  id: "warrior-pose",
  name: "Warrior Pose",
  description: "Wide stance with front knee bent ~90°, back leg straight, arms extended out to the sides.",
  keypoints: [
    kp("nose", 0.5, 0.2),
    kp("left_shoulder", 0.4, 0.36),
    kp("right_shoulder", 0.6, 0.36),
    kp("left_elbow", 0.25, 0.38),
    kp("right_elbow", 0.75, 0.38),
    kp("left_wrist", 0.1, 0.4),
    kp("right_wrist", 0.9, 0.4),
    kp("left_hip", 0.42, 0.56),
    kp("right_hip", 0.58, 0.56),
    kp("left_knee", 0.32, 0.75), // bent front leg
    kp("right_knee", 0.65, 0.7), // straight back leg
    kp("left_ankle", 0.28, 0.92),
    kp("right_ankle", 0.75, 0.85),
  ],
  compareJoints: DEFAULT_COMPARE_JOINTS,
};

/** Side Pose — body angled sideways, one arm up, one arm down. */
export const SIDE_POSE: TargetPose = {
  id: "side-pose",
  name: "Side Pose",
  description: "Stand with one arm overhead and the other down at your side.",
  keypoints: [
    kp("nose", 0.5, 0.2),
    kp("left_shoulder", 0.42, 0.34),
    kp("right_shoulder", 0.58, 0.34),
    kp("left_elbow", 0.4, 0.22),
    kp("right_elbow", 0.6, 0.5),
    kp("left_wrist", 0.39, 0.1),
    kp("right_wrist", 0.62, 0.7),
    kp("left_hip", 0.44, 0.56),
    kp("right_hip", 0.56, 0.56),
    kp("left_knee", 0.44, 0.78),
    kp("right_knee", 0.56, 0.78),
    kp("left_ankle", 0.44, 0.95),
    kp("right_ankle", 0.56, 0.95),
  ],
  compareJoints: DEFAULT_COMPARE_JOINTS,
};

export const TARGET_POSES: TargetPose[] = [
  T_POSE,
  HANDS_UP,
  TREE_POSE,
  WARRIOR_POSE,
  SIDE_POSE,
];

export function getTargetPose(id: string): TargetPose | undefined {
  return TARGET_POSES.find((p) => p.id === id);
}
