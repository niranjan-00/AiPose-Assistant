import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: "bottom" | "right";
}

export function Sheet({ open, onClose, title, children, side = "bottom" }: SheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        className={cn(
          "relative z-10 flex flex-col bg-zinc-950 text-white shadow-2xl",
          side === "bottom"
            ? "mt-auto max-h-[85vh] w-full rounded-t-3xl animate-slide-up pb-safe"
            : "ml-auto h-full w-full max-w-md animate-fade-in",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          {title && (
            <h2 className="text-base font-bold uppercase tracking-[0.2em]">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-full p-2 text-white/60 hover:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
