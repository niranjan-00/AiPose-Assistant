import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/cn";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className, active, label, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={active}
        title={label}
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-all",
          active
            ? "border-lime-300 bg-lime-300/15 text-lime-300"
            : "border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
