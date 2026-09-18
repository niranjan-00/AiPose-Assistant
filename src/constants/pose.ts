/**
 * Pose engine constants — MoveNet SinglePose Lightning has 17 keypoints.
 * All thresholds here are documented and tunable.
 */
import type { KeypointName } from "@/types/pose";

/** Minimum keypoint confidence to be considered "visible" for scoring. */
export const MIN_KEYPOINT_SCORE = 0.3;

/** Average keypoint confidence required to call the frame a "person". */
export const PERSON_MIN_AVG_SCORE = 0.34;

/** Minimum number of visible keypoints to call the frame a "person". */
export const PERSON_MIN_KEYPOINTS = 5;

/** Detect pose at most every N ms (FPS throttle). */
export const DETECTION_INTERVAL_MS = 65; // ~15 FPS

/** Re-run scene analysis every N ms. */
export const ANALYSIS_INTERVAL_MS = 1200;

/** Mirror UI by default for front camera. */
export const DEFAULT_MIRRORED = true;

/** MoveNet skeleton connections (bone pairs). */
export const SKELETON_CONNECTIONS: ReadonlyArray<
  readonly [KeypointName, KeypointName]
> = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["nose", "left_eye"],
  ["nose", "right_eye"],
  ["left_eye", "left_ear"],
  ["right_eye", "right_ear"],
];

/** Keypoints forming the torso (used for many pose quality checks). */
export const TORSO_KEYPOINTS: KeypointName[] = [
  "left_shoulder",
  "right_shoulder",
  "left_hip",
  "right_hip",
];

/** Minimum keypoint confidence for an angle to be considered reliable. */
export const ANGLE_MIN_CONFIDENCE = 0.35;

/** Minimum confidence delta before a rep state transition is allowed. */
export const REP_MIN_CONFIDENCE = 0.4;

/** Default cooldown between identical coaching cues (ms). */
export const COACHING_COOLDOWN_MS = 2500;

/** Cooldown for "rep completed" success messages (ms). */
export const REP_SUCCESS_COOLDOWN_MS = 1200;

/** Max reps counted in one session before auto-pause (safety). */
export const MAX_REPS_PER_SESSION = 999;

/** Camera resolution presets. */
export const VIDEO_QUALITY_PRESETS: Record<
  string,
  { width: number; height: number; label: string }
> = {
  "480p": { width: 640, height: 480, label: "480p" },
  "720p": { width: 1280, height: 720, label: "720p" },
  "1080p": { width: 1920, height: 1080, label: "1080p" },
  max: { width: 1920, height: 1080, label: "Max" },
};

/** Frame color tokens (kept in sync with index.css). */
export const SEVERITY_COLORS: Record<
  "info" | "warning" | "error" | "success",
  string
> = {
  info: "#62d9ff",
  warning: "#f5c84c",
  error: "#ff4b42",
  success: "#b8ff5a",
};
