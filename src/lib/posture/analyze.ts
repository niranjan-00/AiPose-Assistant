/**
 * Posture analysis — for the Posture Monitor mode.
 *
 * Checks:
 *   - Head forward posture (head x offset from shoulder center)
 *   - Shoulder alignment (level shoulders)
 *   - Torso angle (lean forward/sideways)
 *   - Hip alignment (level hips)
 *
 * Returns a score 0..100 + per-rule feedback.
 */
import type { PoseFrame, Severity } from "@/types/pose";
import { getKeypoint, midPoint } from "@/lib/pose/keypoints";

export interface PostureRule {
  id: string;
  description: string;
  cue: string;
  severity: Severity;
  /** 0..1 score (1 = perfect) */
  score: number;
}

export interface PostureAnalysis {
  score: number;
  rules: PostureRule[];
  /** Quick summary for the UI */
  summary: string;
  /** True if person not detected */
  noPerson: boolean;
}

export function analyzePosture(frame: PoseFrame): PostureAnalysis {
  const nose = getKeypoint(frame.keypoints, "nose");
  const ls = getKeypoint(frame.keypoints, "left_shoulder");
  const rs = getKeypoint(frame.keypoints, "right_shoulder");
  const lh = getKeypoint(frame.keypoints, "left_hip");
  const rh = getKeypoint(frame.keypoints, "right_hip");
  const le = getKeypoint(frame.keypoints, "left_ear");
  const re = getKeypoint(frame.keypoints, "right_ear");

  const requiredVisible =
    (ls?.score ?? 0) >= 0.3 && (rs?.score ?? 0.3) >= 0.3;
  if (!requiredVisible) {
    return {
      score: 0,
      rules: [],
      summary: "Move into view",
      noPerson: true,
    };
  }
  const rules: PostureRule[] = [];

  // 1. Head forward posture
  if (nose && (nose.score ?? 0) >= 0.3 && ls && rs) {
    const midS = midPoint(ls, rs);
    // Forward head = nose x offset from shoulder center (in normalized coords)
    const dx = Math.abs(nose.x - midS.x);
    let score = 1;
    let cue = "Head aligned with shoulders";
    if (dx > 0.04) {
      score = 0.4;
      cue = "Your head is forward — tuck chin back";
    } else if (dx > 0.025) {
      score = 0.7;
      cue = "Bring head back slightly";
    }
    rules.push({
      id: "head-forward",
      description: "Head aligned over shoulders",
      cue,
      severity: dx > 0.04 ? "warning" : "info",
      score,
    });
  }

  // 2. Shoulder alignment
  if (ls && rs) {
    const dy = Math.abs(ls.y - rs.y);
    const dx = Math.max(0.001, Math.abs(rs.x - ls.x));
    const slope = dy / dx;
    let score = 1;
    let cue = "Shoulders level";
    let severity: Severity = "success";
    if (slope > 0.18) {
      score = 0.3;
      cue = "Level your shoulders";
      severity = "warning";
    } else if (slope > 0.1) {
      score = 0.65;
      cue = "Drop the higher shoulder slightly";
      severity = "info";
    }
    rules.push({
      id: "shoulder-level",
      description: "Shoulders level",
      cue,
      severity,
      score,
    });
  }

  // 3. Torso angle (if hips visible)
  if (ls && rs && lh && rh) {
    if (
      (lh?.score ?? 0) >= 0.3 &&
      (rh?.score ?? 0) >= 0.3
    ) {
      const midS = midPoint(ls, rs);
      const midH = midPoint(lh, rh);
      const dx = midS.x - midH.x;
      const dy = midS.y - midH.y;
      if (dy > 0.001) {
        const leanDeg = Math.abs(Math.atan2(dx, dy)) * (180 / Math.PI);
        let score = 1;
        let cue = "Torso upright";
        let severity: Severity = "success";
        if (leanDeg > 22) {
          score = 0.3;
          cue = "Stand tall — straighten your torso";
          severity = "warning";
        } else if (leanDeg > 12) {
          score = 0.65;
          cue = "Straighten your torso";
          severity = "info";
        }
        rules.push({
          id: "torso-upright",
          description: "Torso upright",
          cue,
          severity,
          score,
        });
      }
    }
  }

  // 4. Hip alignment
  if (lh && rh && (lh.score ?? 0) >= 0.3 && (rh.score ?? 0) >= 0.3) {
    const dy = Math.abs(lh.y - rh.y);
    const dx = Math.max(0.001, Math.abs(rh.x - lh.x));
    const slope = dy / dx;
    let score = 1;
    let cue = "Hips level";
    let severity: Severity = "success";
    if (slope > 0.18) {
      score = 0.4;
      cue = "Level your hips";
      severity = "warning";
    } else if (slope > 0.1) {
      score = 0.7;
      cue = "Hips slightly uneven";
      severity = "info";
    }
    rules.push({
      id: "hip-level",
      description: "Hips level",
      cue,
      severity,
      score,
    });
  }

  // 5. Head tilt (if ears visible)
  if (le && re && (le?.score ?? 0) >= 0.3 && (re?.score ?? 0) >= 0.3) {
    const dy = Math.abs(le.y - re.y);
    const dx = Math.max(0.001, Math.abs(re.x - le.x));
    const slope = dy / dx;
    if (slope > 0.2) {
      rules.push({
        id: "head-tilt",
        description: "Head not tilted",
        cue: "Level your head",
        severity: "info",
        score: 0.6,
      });
    } else {
      rules.push({
        id: "head-tilt",
        description: "Head not tilted",
        cue: "Head level",
        severity: "success",
        score: 1,
      });
    }
  }

  // Overall: average of all rule scores.
  const score =
    rules.length > 0
      ? Math.round(
          (rules.reduce((s, r) => s + r.score, 0) / rules.length) * 100,
        )
      : 0;

  // Summary
  const worst = rules
    .filter((r) => r.severity === "warning" || r.severity === "error")
    .sort((a, b) => a.score - b.score)[0];
  const summary = worst
    ? worst.cue
    : rules.length > 0
      ? "Posture looks good"
      : "Move into view";

  return { score, rules, summary, noPerson: false };
}
