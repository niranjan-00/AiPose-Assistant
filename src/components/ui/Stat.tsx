import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface StatProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  accent?: "brand" | "info" | "warning" | "error" | "default";
}

export function Stat({ label, value, unit, hint, accent = "default" }: StatProps) {
  const colorCls =
    accent === "brand"
      ? "text-lime-300"
      : accent === "info"
        ? "text-sky-300"
        : accent === "warning"
          ? "text-yellow-300"
          : accent === "error"
            ? "text-red-400"
            : "text-white";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </span>
      <span className={cn("text-2xl font-bold tabular-nums", colorCls)}>
        {value}
        {unit && <span className="ml-1 text-sm text-white/50">{unit}</span>}
      </span>
      {hint && <span className="text-[10px] text-white/40">{hint}</span>}
    </div>
  );
}
