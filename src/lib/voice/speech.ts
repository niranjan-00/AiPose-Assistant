/**
 * Voice coach — wraps SpeechSynthesis with queue + cooldown so it never
 * repeats the same utterance back-to-back.
 *
 * Honors user settings: enabled, volume, rate, feedback frequency.
 * In minimal mode: only error + success cues are spoken.
 * In balanced mode: error + warning + success.
 * In verbose mode: everything including info cues.
 */
import type { CoachingMessage } from "@/types/exercise";
import type { FeedbackFrequency } from "@/types/settings";

export interface VoiceCoachConfig {
  enabled: boolean;
  volume: number; // 0..1
  rate: number; // 0.5..2
  frequency: FeedbackFrequency;
}

export interface VoiceCoachState {
  lastSpokenText: string | null;
  lastSpokenAt: number;
  queue: CoachingMessage[];
  speaking: boolean;
  /** Messages that are currently too low priority to speak */
  suppressed: Set<string>;
}

export function createVoiceCoachState(): VoiceCoachState {
  return {
    lastSpokenText: null,
    lastSpokenAt: 0,
    queue: [],
    speaking: false,
    suppressed: new Set(),
  };
}

const FREQUENCY_RANK: Record<FeedbackFrequency, number> = {
  minimal: 1, // success + error
  balanced: 2, // success + error + warning
  verbose: 3, // all
};

function shouldSpeak(
  cfg: VoiceCoachConfig,
  msg: CoachingMessage,
): boolean {
  if (!cfg.enabled) return false;
  const freqRank = FREQUENCY_RANK[cfg.frequency];
  if (msg.severity === "success") return true; // always speak success
  if (msg.severity === "error") return freqRank >= 1;
  if (msg.severity === "warning") return freqRank >= 2;
  return freqRank >= 3; // info
}

/**
 * Speak a coaching message via SpeechSynthesis. Respects the cooldown so the
 * same text isn't repeated back-to-back.
 *
 * Returns true if the message was actually spoken (for tests / observability).
 */
export function speakMessage(
  cfg: VoiceCoachConfig,
  state: VoiceCoachState,
  msg: CoachingMessage | null,
  now: number,
  synth: SpeechSynthesisLike | null = defaultSynth,
): boolean {
  if (!msg) return false;
  if (!shouldSpeak(cfg, msg)) return false;
  if (msg.text === state.lastSpokenText && now - state.lastSpokenAt < 4000) {
    return false;
  }
  if (!synth) return false;

  try {
    const utter = synth.createUtterance(msg.text);
    utter.volume = cfg.volume;
    utter.rate = cfg.rate;
    utter.pitch = 1.0;
    synth.speak(utter);
    state.lastSpokenText = msg.text;
    state.lastSpokenAt = now;
    return true;
  } catch {
    return false;
  }
}

/** SpeechSynthesis interface (subset we use) — extractable for tests. */
export interface SpeechSynthesisLike {
  speak(utter: SpeechSynthesisUtteranceLike): void;
  cancel(): void;
  createUtterance(text: string): SpeechSynthesisUtteranceLike;
}

interface SpeechSynthesisUtteranceLike {
  volume: number;
  rate: number;
  pitch: number;
  text: string;
}

class DefaultSynth implements SpeechSynthesisLike {
  speak(utter: SpeechSynthesisUtteranceLike): void {
    if (typeof speechSynthesis === "undefined") return;
    // Build a real SpeechSynthesisUtterance and copy props.
    const u = new SpeechSynthesisUtterance(utter.text);
    u.volume = utter.volume;
    u.rate = utter.rate;
    u.pitch = utter.pitch;
    speechSynthesis.speak(u);
  }
  cancel(): void {
    if (typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
  }
  createUtterance(text: string): SpeechSynthesisUtteranceLike {
    return {
      text,
      volume: 1,
      rate: 1,
      pitch: 1,
    };
  }
}

export const defaultSynth: SpeechSynthesisLike | null =
  typeof speechSynthesis !== "undefined" ? new DefaultSynth() : null;

/**
 * Stop speaking and clear the queue (e.g. on mode exit).
 */
export function stopVoiceCoach(
  state: VoiceCoachState,
  synth: SpeechSynthesisLike | null = defaultSynth,
): void {
  state.queue = [];
  state.speaking = false;
  if (synth) synth.cancel();
}
