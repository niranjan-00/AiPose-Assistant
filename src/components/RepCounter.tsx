/**
 * RepCounter — large, mobile-first rep display. Shows current reps + target
 * + phase indicator + form score.
 */
import { cn } from "@/utils/cn";

interface RepCounterProps {
  reps: number;
  target?: number;
  phase: string;
  formScore: number;
  isHold?: boolean;
  /** For hold exercises: elapsed hold time in ms */
  holdMs?: number;
  holdTargetMs?: number;
}

function formatHold(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function RepCounter({
  reps,
  target,
  phase,
  formScore,
  isHold = false,
  holdMs,
  holdTargetMs,
}: RepCounterProps) {
  const formColor =
    formScore >= 85
      ? "text-lime-300"
      : formScore >= 65
        ? "text-yellow-300"
        : "text-red-400";
  const main = isHold ? formatHold(holdMs ?? 0) : String(reps);
  const mainTarget = isHold
    ? holdTargetMs
      ? formatHold(holdTargetMs)
      : undefined
    : target;
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
        {phase}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-6xl font-bold tabular-nums text-white sm:text-7xl">
          {main}
        </span>
        {mainTarget && (
          <span className="text-2xl font-semibold text-white/50">
            / {mainTarget}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
          Form
        </span>
        <span className={cn("text-xl font-bold tabular-nums", formColor)}>
          {formScore}
          <span className="text-white/50">%</span>
        </span>
      </div>
    </div>
  );
}
