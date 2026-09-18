/**
 * Coaching engine — converts raw form feedback into prioritized, de-duplicated,
 * cooldown-gated coaching messages.
 *
 * Goals (per spec section 8):
 *   - Don't spam messages
 *   - Priority: error > warning > info > success
 *   - Cooldown per cue (no repeat within X ms)
 *   - Duplicate suppression (don't speak the same text back-to-back)
 *   - Severity drives UI color and voice priority
 */
import type { CoachingMessage, FormFeedback, Severity } from "@/types/exercise";
import { COACHING_COOLDOWN_MS, REP_SUCCESS_COOLDOWN_MS } from "@/constants/pose";

export interface CoachState {
  /** Map of cue → last-shown timestamp (ms) */
  lastShownAt: Map<string, number>;
  /** Last message text shown (for duplicate suppression) */
  lastText: string | null;
  lastTextAt: number;
  /** Pending success messages */
  pendingSuccess: CoachingMessage[];
}

export function createCoachState(): CoachState {
  return {
    lastShownAt: new Map(),
    lastText: null,
    lastTextAt: 0,
    pendingSuccess: [],
  };
}

const SEVERITY_RANK: Record<Severity, number> = {
  error: 3,
  warning: 2,
  info: 1,
  success: 0,
};

export interface CoachEmitInput {
  feedback: FormFeedback[];
  repDelta: number;
  /** ms timestamp (performance.now) */
  now: number;
  /** When rep delta fires, a success cue text (e.g. "Great rep") */
  repSuccessText?: string;
}

/**
 * Pick the highest-priority feedback that hasn't been shown recently.
 * If a rep just completed, return the success message (with its own cooldown).
 * Returns null if nothing should be shown.
 */
export function pickCoaching(
  state: CoachState,
  input: CoachEmitInput,
): CoachingMessage | null {
  // Rep success takes priority — but only if the success cooldown has elapsed.
  if (input.repDelta > 0) {
    const lastSuccess = state.lastShownAt.get("rep_success");
    if (lastSuccess === undefined || input.now - lastSuccess >= REP_SUCCESS_COOLDOWN_MS) {
      const text = input.repSuccessText ?? "Good rep.";
      if (text !== state.lastText || input.now - state.lastTextAt > 1500) {
        const msg: CoachingMessage = {
          id: `rep-${input.now}`,
          text,
          severity: "success",
          timestamp: input.now,
          ruleId: "rep_success",
        };
        state.lastShownAt.set("rep_success", input.now);
        state.lastText = text;
        state.lastTextAt = input.now;
        return msg;
      }
    }
  }

  // Sort by severity (desc), then by score (asc — worst first).
  const sorted = [...input.feedback].sort((a, b) => {
    const sr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sr !== 0) return sr;
    return a.score - b.score;
  });

  for (const fb of sorted) {
    const key = fb.ruleId;
    const last = state.lastShownAt.get(key);
    // `last === undefined` means "never shown" — allow it.
    if (last !== undefined && input.now - last < COACHING_COOLDOWN_MS) continue;
    if (fb.cue === state.lastText && input.now - state.lastTextAt < 3000) {
      continue;
    }
    const msg: CoachingMessage = {
      id: `${fb.ruleId}-${input.now}`,
      text: fb.cue,
      severity: fb.severity,
      timestamp: input.now,
      ruleId: fb.ruleId,
    };
    state.lastShownAt.set(key, input.now);
    state.lastText = fb.cue;
    state.lastTextAt = input.now;
    return msg;
  }
  return null;
}

/**
 * Pick the lowest-severity (best) message to show when there is no issue.
 */
export function pickPraiseMessage(
  state: CoachState,
  now: number,
  hasFeedback: boolean,
): CoachingMessage | null {
  if (hasFeedback) return null;
  const last = state.lastShownAt.get("praise") ?? 0;
  if (now - last < 8000) return null;
  const options = ["Looking good.", "Keep going.", "Solid form.", "Nice pace."];
  const text = options[Math.floor(now / 8000) % options.length]!;
  if (text === state.lastText && now - state.lastTextAt < 5000) return null;
  state.lastShownAt.set("praise", now);
  state.lastText = text;
  state.lastTextAt = now;
  return {
    id: `praise-${now}`,
    text,
    severity: "success",
    timestamp: now,
    ruleId: "praise",
  };
}
