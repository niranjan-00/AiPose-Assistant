/**
 * useExerciseRunner — wraps the pure-function ExerciseRunner with React state
 * suitable for the Fitness Coach mode.
 *
 * The hook consumes a stream of PoseFrames from usePoseDetection via an onFrame
 * callback. Each frame advances the state machine and updates:
 *   - repCount
 *   - phase
 *   - form breakdown
 *   - latest coaching message
 */
import { useCallback, useRef, useState } from "react";
import type {
  CoachingMessage,
  ExerciseDefinition,
  FormScoreBreakdown,
} from "@/types/exercise";
import type { PoseFrame } from "@/types/pose";
import {
  advanceRunner,
  createRunnerState,
  type ExerciseRunnerState,
} from "@/lib/exercises/engine";
import {
  createCoachState,
  pickCoaching,
  pickPraiseMessage,
  type CoachState,
} from "@/lib/coaching/coach";
import { COACHING_COOLDOWN_MS } from "@/constants/pose";

export interface UseExerciseRunnerResult {
  state: ExerciseRunnerState;
  repCount: number;
  phase: string;
  breakdown: FormScoreBreakdown;
  angles: Record<string, number>;
  latestMessage: CoachingMessage | null;
  lowConfidence: boolean;
  reset: () => void;
  onFrame: (frame: PoseFrame) => void;
}

export interface UseExerciseRunnerOptions {
  definition: ExerciseDefinition;
  mirrored: boolean;
  enabled: boolean;
}

export function useExerciseRunner(
  opts: UseExerciseRunnerOptions,
): UseExerciseRunnerResult {
  const { definition, mirrored, enabled } = opts;
  const [state, setState] = useState<ExerciseRunnerState>(() =>
    createRunnerState(performance.now()),
  );
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState("Ready");
  const [breakdown, setBreakdown] = useState<FormScoreBreakdown>({
    overall: 0,
    form: 0,
    rangeOfMotion: 0,
    symmetry: 0,
    tempo: 0,
    stability: 0,
  });
  const [angles, setAngles] = useState<Record<string, number>>({});
  const [latestMessage, setLatestMessage] = useState<CoachingMessage | null>(
    null,
  );
  const [lowConfidence, setLowConfidence] = useState(false);

  const stateRef = state;
  const coachRef = useRef<CoachState>(createCoachState());
  const lastUiUpdate = useRef(0);

  const reset = useCallback(() => {
    const fresh = createRunnerState(performance.now());
    setState(fresh);
    setRepCount(0);
    setPhase("Ready");
    setBreakdown({
      overall: 0,
      form: 0,
      rangeOfMotion: 0,
      symmetry: 0,
      tempo: 0,
      stability: 0,
    });
    setAngles({});
    setLatestMessage(null);
    setLowConfidence(false);
    coachRef.current = createCoachState();
  }, []);

  const onFrame = useCallback(
    (frame: PoseFrame) => {
      if (!enabled) return;
      const now = performance.now();
      const result = advanceRunner({
        definition,
        state: stateRef,
        frame,
        mirrored,
        now,
      });
      // Always update the ref-based state for the engine's internal history.
      stateRef.repCount = result.state.repCount;
      // Trigger React updates only at a throttled rate to avoid excessive renders.
      if (now - lastUiUpdate.current > 100 || result.repDelta > 0) {
        lastUiUpdate.current = now;
        setRepCount(result.state.repCount);
        setPhase(result.phase);
        setBreakdown(result.breakdown);
        setAngles(result.angles);
        setLowConfidence(result.lowConfidence);
        setState({ ...result.state });
      }
      // Pick a coaching message
      const msg = pickCoaching(coachRef.current, {
        feedback: result.feedback,
        repDelta: result.repDelta,
        now,
      });
      if (msg) {
        setLatestMessage(msg);
      } else if (result.feedback.length === 0 && result.state.repCount > 0) {
        // Occasionally praise if everything's going well
        const praise = pickPraiseMessage(
          coachRef.current,
          now,
          result.feedback.length > 0,
        );
        if (praise && now - lastUiUpdate.current > 1500) {
          setLatestMessage(praise);
        }
      }
      // Suppress stale messages after their cooldown
      if (
        latestMessage &&
        now - latestMessage.timestamp > COACHING_COOLDOWN_MS * 2
      ) {
        setLatestMessage(null);
      }
    },
    [definition, enabled, mirrored, stateRef, latestMessage],
  );

  return {
    state,
    repCount,
    phase,
    breakdown,
    angles,
    latestMessage,
    lowConfidence,
    reset,
    onFrame,
  };
}
