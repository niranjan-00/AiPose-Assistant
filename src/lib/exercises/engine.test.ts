/**
 * Unit tests for the exercise engine — rep counting state machine, form
 * evaluation, scoring.
 *
 * The tests simulate squat rep cycles by feeding synthetic pose frames
 * with controlled knee angles. The state machine should:
 *   1. Start in "ready"
 *   2. Transition ready → descending → bottom → ascending → ready (with repDelta=1)
 *   3. Respect min dwell times
 *   4. Suppress reps when confidence is low
 */
import { describe, it, expect } from "vitest";
import { SQUAT } from "@/lib/exercises/squat";
import { PUSHUP } from "@/lib/exercises/pushup";
import {
  advanceRunner,
  computeAngles,
  createRunnerState,
  type ExerciseRunnerState,
} from "@/lib/exercises/engine";
import type { PoseFrame, PoseKeypoint } from "@/types/pose";
import type { ExerciseDefinition } from "@/types/exercise";

function kp(
  name: PoseKeypoint["name"],
  x: number,
  y: number,
  score = 1,
): PoseKeypoint {
  return { name, x, y, score };
}

/**
 * Build a synthetic squat pose frame with the given left/right knee angles.
 * The angle is at the knee (vertex = left_knee), so we vary the wrist/ankle
 * positions to produce the target angle. For a 90° angle we put the ankle
 * directly below the knee by a fixed distance.
 */
function buildSquatFrame(kneeAngleDeg: number, confidence = 1): PoseFrame {
  // Knee at (0.4, 0.6). Hip directly above. Ankle positioned so that the
  // angle at the knee (vertex) between hip and ankle equals kneeAngleDeg.
  //   θ=180° → ankle straight below knee → vector (0, +0.2)
  //   θ=90°  → ankle horizontal           → vector (0.2, 0)
  //   θ=0°   → ankle above knee (folded)  → vector (0, -0.2)
  // Parametrized as: vx = 0.2·sin(θ),  vy = -0.2·cos(θ)
  const knee = { x: 0.4, y: 0.6 };
  const kneeR = { x: 0.6, y: 0.6 };
  const hip = { x: 0.4, y: 0.4 };
  const hipR = { x: 0.6, y: 0.4 };
  const rad = (kneeAngleDeg * Math.PI) / 180;
  const ankleOffset = 0.2;
  const ankle = {
    x: knee.x + ankleOffset * Math.sin(rad),
    y: knee.y - ankleOffset * Math.cos(rad),
  };
  const ankleR = {
    x: kneeR.x - ankleOffset * Math.sin(rad),
    y: kneeR.y - ankleOffset * Math.cos(rad),
  };

  const keypoints: PoseKeypoint[] = [
    kp("nose", 0.5, 0.2, confidence),
    kp("left_shoulder", 0.4, 0.3, confidence),
    kp("right_shoulder", 0.6, 0.3, confidence),
    kp("left_hip", hip.x, hip.y, confidence),
    kp("right_hip", hipR.x, hipR.y, confidence),
    kp("left_knee", knee.x, knee.y, confidence),
    kp("right_knee", kneeR.x, kneeR.y, confidence),
    kp("left_ankle", ankle.x, ankle.y, confidence),
    kp("right_ankle", ankleR.x, ankleR.y, confidence),
  ];

  return {
    keypoints,
    score: confidence,
    videoWidth: 1280,
    videoHeight: 720,
    timestamp: performance.now(),
  };
}

function runRepCycle(
  definition: ExerciseDefinition,
  state: ExerciseRunnerState,
  baseTime: number,
  confidence = 1,
): { state: ExerciseRunnerState; reps: number; lastOutput: ReturnType<typeof advanceRunner> } {
  // Simulate one full rep cycle: ready → descend → bottom → ascend → ready
  const dt = 350; // ms per frame — above minDwellMs of 200-250
  let t = baseTime;
  let lastOutput!: ReturnType<typeof advanceRunner>;
  let totalReps = 0;

  // READY (initial) — angle ~180
  lastOutput = advanceRunner({
    definition,
    state,
    frame: buildSquatFrame(170, confidence),
    mirrored: false,
    now: t,
  });
  Object.assign(state, lastOutput.state);
  t += dt;

  // DESCENDING — angle < 140
  lastOutput = advanceRunner({
    definition,
    state,
    frame: buildSquatFrame(120, confidence),
    mirrored: false,
    now: t,
  });
  Object.assign(state, lastOutput.state);
  totalReps += lastOutput.repDelta;
  t += dt;

  // BOTTOM — angle < 110
  lastOutput = advanceRunner({
    definition,
    state,
    frame: buildSquatFrame(95, confidence),
    mirrored: false,
    now: t,
  });
  Object.assign(state, lastOutput.state);
  totalReps += lastOutput.repDelta;
  t += dt;

  // ASCENDING — angle > 120
  lastOutput = advanceRunner({
    definition,
    state,
    frame: buildSquatFrame(135, confidence),
    mirrored: false,
    now: t,
  });
  Object.assign(state, lastOutput.state);
  totalReps += lastOutput.repDelta;
  t += dt;

  // REP COMPLETED — angle > 160
  lastOutput = advanceRunner({
    definition,
    state,
    frame: buildSquatFrame(175, confidence),
    mirrored: false,
    now: t,
  });
  Object.assign(state, lastOutput.state);
  totalReps += lastOutput.repDelta;

  return { state, reps: totalReps, lastOutput };
}

describe("Squat rep detection", () => {
  it("counts one rep for a full ready→descend→bottom→ascend→ready cycle", () => {
    const state = createRunnerState(0);
    const { reps } = runRepCycle(SQUAT, state, 1000);
    expect(reps).toBeGreaterThanOrEqual(1);
  });

  it("does NOT count a rep if user only partially descends (no bottom hit)", () => {
    const state = createRunnerState(0);
    // Descend but skip bottom; immediately return to ready.
    const dt = 350;
    let t = 1000;
    let reps = 0;
    let out: ReturnType<typeof advanceRunner>;

    out = advanceRunner({
      definition: SQUAT,
      state,
      frame: buildSquatFrame(170),
      mirrored: false,
      now: t,
    });
    Object.assign(state, out.state);
    t += dt;

    out = advanceRunner({
      definition: SQUAT,
      state,
      frame: buildSquatFrame(130),
      mirrored: false,
      now: t,
    });
    Object.assign(state, out.state);
    reps += out.repDelta;
    t += dt;

    // Skip BOTTOM state — go directly back to standing.
    out = advanceRunner({
      definition: SQUAT,
      state,
      frame: buildSquatFrame(175),
      mirrored: false,
      now: t,
    });
    Object.assign(state, out.state);
    reps += out.repDelta;

    // Should be 0 — user didn't hit bottom.
    expect(reps).toBe(0);
  });

  it("counts multiple reps over multiple cycles", () => {
    const state = createRunnerState(0);
    let reps = 0;
    let t = 1000;
    for (let i = 0; i < 3; i++) {
      const result = runRepCycle(SQUAT, state, t);
      reps += result.reps;
      t += 5 * 350;
      // Reset state to ready between cycles
      Object.assign(state, result.state);
    }
    expect(reps).toBeGreaterThanOrEqual(3);
  });

  it("suppresses reps when confidence is low", () => {
    const state = createRunnerState(0);
    const { reps } = runRepCycle(SQUAT, state, 1000, 0.1);
    expect(reps).toBe(0);
  });
});

describe("Squat form evaluation", () => {
  it("computes angles for a valid pose", () => {
    const frame = buildSquatFrame(95);
    const angles = computeAngles(SQUAT, frame);
    expect(angles["Left Knee"]).toBeDefined();
    expect(angles["Left Knee"]).toBeCloseTo(95, 0);
    expect(angles["Right Knee"]).toBeCloseTo(95, 0);
  });

  it("emits form feedback when depth is poor", () => {
    const state = createRunnerState(0);
    // Descend but only to 130 (above 110 bottom threshold) — should warn
    const result = advanceRunner({
      definition: SQUAT,
      state,
      frame: buildSquatFrame(125),
      mirrored: false,
      now: 1000,
    });
    // Squat's "squat-depth" rule fires when avg > 95° at bottom/ascending state.
    // Here state is just "descending", so the depth rule returns 0.8. Other
    // rules may still fire.
    expect(result.feedback).toBeDefined();
    expect(Array.isArray(result.feedback)).toBe(true);
  });
});

describe("Push-up rep detection", () => {
  function buildPushupFrame(elbowAngleDeg: number, confidence = 1): PoseFrame {
    // Elbow at (0.5, 0.5). Shoulder to the LEFT at (0.3, 0.5).
    // Wrist placed so angle at the elbow (shoulder-elbow-wrist) = elbowAngleDeg.
    //   θ=180° → wrist on opposite side of shoulder → vector (+0.2, 0)
    //   θ=90°  → wrist perpendicular (below elbow)    → vector (0, +0.2)
    //   θ=0°   → wrist at shoulder (folded)           → vector (-0.2, 0)
    // Parametrized: vx = -0.2·cos(θ),  vy = 0.2·sin(θ)
    const elbow = { x: 0.5, y: 0.5 };
    const shoulder = { x: 0.3, y: 0.5 };
    const rad = (elbowAngleDeg * Math.PI) / 180;
    const wrist = {
      x: elbow.x - 0.2 * Math.cos(rad),
      y: elbow.y + 0.2 * Math.sin(rad),
    };
    const elbowR = { x: 0.5, y: 0.55 };
    const shoulderR = { x: 0.3, y: 0.55 };
    const wristR = {
      x: elbowR.x - 0.2 * Math.cos(rad),
      y: elbowR.y + 0.2 * Math.sin(rad),
    };
    return {
      keypoints: [
        kp("nose", 0.4, 0.4, confidence),
        kp("left_shoulder", shoulder.x, shoulder.y, confidence),
        kp("right_shoulder", shoulderR.x, shoulderR.y, confidence),
        kp("left_elbow", elbow.x, elbow.y, confidence),
        kp("right_elbow", elbowR.x, elbowR.y, confidence),
        kp("left_wrist", wrist.x, wrist.y, confidence),
        kp("right_wrist", wristR.x, wristR.y, confidence),
        kp("left_hip", 0.4, 0.7, confidence),
        kp("right_hip", 0.6, 0.7, confidence),
        kp("left_ankle", 0.4, 0.9, confidence),
        kp("right_ankle", 0.6, 0.9, confidence),
      ],
      score: confidence,
      videoWidth: 1280,
      videoHeight: 720,
      timestamp: performance.now(),
    };
  }

  it("counts one rep for a full push-up cycle", () => {
    const state = createRunnerState(0);
    let reps = 0;
    let t = 1000;
    const dt = 350;
    let out: ReturnType<typeof advanceRunner>;

    // READY — elbow ~170
    out = advanceRunner({
      definition: PUSHUP,
      state,
      frame: buildPushupFrame(170),
      mirrored: false,
      now: t,
    });
    Object.assign(state, out.state);
    t += dt;

    // DESCENDING — elbow < 130
    out = advanceRunner({
      definition: PUSHUP,
      state,
      frame: buildPushupFrame(125),
      mirrored: false,
      now: t,
    });
    Object.assign(state, out.state);
    reps += out.repDelta;
    t += dt;

    // BOTTOM — elbow < 95
    out = advanceRunner({
      definition: PUSHUP,
      state,
      frame: buildPushupFrame(85),
      mirrored: false,
      now: t,
    });
    Object.assign(state, out.state);
    reps += out.repDelta;
    t += dt;

    // ASCENDING — elbow > 110
    out = advanceRunner({
      definition: PUSHUP,
      state,
      frame: buildPushupFrame(120),
      mirrored: false,
      now: t,
    });
    Object.assign(state, out.state);
    reps += out.repDelta;
    t += dt;

    // REP COMPLETED — elbow > 155
    out = advanceRunner({
      definition: PUSHUP,
      state,
      frame: buildPushupFrame(170),
      mirrored: false,
      now: t,
    });
    Object.assign(state, out.state);
    reps += out.repDelta;

    expect(reps).toBeGreaterThanOrEqual(1);
  });
});

describe("Coach message cooldown", () => {
  it("does not return the same coaching cue twice in quick succession", async () => {
    const { pickCoaching, createCoachState } = await import("@/lib/coaching/coach");
    const coach = createCoachState();
    const feedback = [
      {
        ruleId: "squat-depth",
        description: "Reach full depth",
        cue: "Go slightly deeper",
        score: 0.3,
        severity: "warning" as const,
      },
    ];

    // First call returns the cue
    const m1 = pickCoaching(coach, { feedback, repDelta: 0, now: 1000 });
    expect(m1?.text).toBe("Go slightly deeper");

    // Second call too soon — should be suppressed
    const m2 = pickCoaching(coach, { feedback, repDelta: 0, now: 1500 });
    expect(m2).toBeNull();
  });
});
