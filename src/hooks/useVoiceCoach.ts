/**
 * useVoiceCoach — wraps the SpeechSynthesis voice coach with React state.
 */
import { useCallback, useEffect, useRef } from "react";
import type { CoachingMessage } from "@/types/exercise";
import type { VoiceCoachConfig } from "@/lib/voice/speech";
import {
  createVoiceCoachState,
  defaultSynth,
  speakMessage,
  stopVoiceCoach,
  type VoiceCoachState,
} from "@/lib/voice/speech";

export type UseVoiceCoachOptions = VoiceCoachConfig;

export interface UseVoiceCoachResult {
  speak: (msg: CoachingMessage | null) => void;
  stop: () => void;
  supported: boolean;
}

export function useVoiceCoach(
  opts: UseVoiceCoachOptions,
): UseVoiceCoachResult {
  const stateRef = useRef<VoiceCoachState>(createVoiceCoachState());
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const supported = typeof speechSynthesis !== "undefined" && !!defaultSynth;
  const state = stateRef;

  const speak = useCallback((msg: CoachingMessage | null) => {
    if (!msg) return;
    if (!defaultSynth) return;
    speakMessage(optsRef.current, state.current, msg, performance.now(), defaultSynth);
  }, [state]);

  const stop = useCallback(() => {
    stopVoiceCoach(state.current, defaultSynth);
  }, [state]);

  // Stop on unmount
  useEffect(() => {
    const s = state.current;
    return () => {
      stopVoiceCoach(s, defaultSynth);
    };
  }, [state]);

  return { speak, stop, supported };
}
