/**
 * ModeNav — bottom navigation bar. Mobile-first with 5 primary destinations
 * plus a "more" overflow for Settings & Gallery.
 */
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export type AppMode =
  | "studio"
  | "fitness"
  | "posture"
  | "practice"
  | "workout"
  | "dashboard"
  | "settings"
  | "gallery";

export interface ModeNavItem {
  id: AppMode;
  label: string;
  icon: ReactNode;
}

interface ModeNavProps {
  value: AppMode;
  onChange: (mode: AppMode) => void;
  items: ModeNavItem[];
}

export function ModeNav({ value, onChange, items }: ModeNavProps) {
  return (
    <nav
      className="z-30 flex items-stretch justify-around border-t border-white/10 bg-black/85 px-2 pb-safe pt-2 backdrop-blur-xl"
      aria-label="App navigation"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors",
              active ? "text-lime-300" : "text-white/55 hover:text-white",
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center" aria-hidden="true">
              {item.icon}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
