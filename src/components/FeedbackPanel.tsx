/**
 * FeedbackPanel — displays the latest coaching message with severity color.
 * Big, high-contrast, single-cue — designed for use mid-exercise.
 */
import type { CoachingMessage } from "@/types/exercise";
import { cn } from "@/utils/cn";

interface FeedbackPanelProps {
  message: CoachingMessage | null;
  /** When low confidence, show "move into view" prompt instead */
  lowConfidence?: boolean;
  className?: string;
  /** Compact mode (smaller text, used in overlay) */
  compact?: boolean;
}

const SEVERITY_CLASS = {
  success: "text-lime-300 border-lime-300/40 bg-lime-300/10",
  info: "text-sky-300 border-sky-300/40 bg-sky-300/10",
  warning: "text-yellow-300 border-yellow-300/40 bg-yellow-300/10",
  error: "text-red-400 border-red-400/40 bg-red-400/10",
} as const;

const SEVERITY_ICON = {
  success: "✓",
  info: "i",
  warning: "!",
  error: "✕",
} as const;

export function FeedbackPanel({
  message,
  lowConfidence,
  className,
  compact = false,
}: FeedbackPanelProps) {
  const msg: CoachingMessage | null = lowConfidence
    ? {
        id: "low-conf",
        text: "Move into view",
        severity: "warning",
        timestamp: performance.now(),
      }
    : message;

  if (!msg) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md",
          compact ? "px-3 py-2" : "px-5 py-3",
          className,
        )}
      >
        <p
          className={cn(
            "font-semibold text-white/60",
            compact ? "text-sm" : "text-base",
          )}
        >
          Waiting for form data…
        </p>
      </div>
    );
  }

  const cls = SEVERITY_CLASS[msg.severity];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-2xl border backdrop-blur-md",
        cls,
        compact ? "px-3 py-2" : "px-5 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-bold",
            compact ? "text-sm" : "text-base",
          )}
          aria-hidden="true"
        >
          {SEVERITY_ICON[msg.severity]}
        </span>
        <p
          className={cn(
            "font-bold uppercase tracking-wide",
            compact ? "text-sm" : "text-lg",
          )}
        >
          {msg.text}
        </p>
      </div>
    </div>
  );
}
