import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/utils/cn";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "secondary",
      size = "md",
      active = false,
      ...props
    },
    ref,
  ) {
    const sizeCls =
      size === "sm"
        ? "px-3 py-1.5 text-xs"
        : size === "lg"
          ? "px-6 py-3 text-base"
          : "px-4 py-2 text-sm";
    const variantCls =
      variant === "primary"
        ? "bg-lime-300 text-black hover:bg-lime-200"
        : variant === "danger"
          ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
          : variant === "ghost"
            ? "text-white/70 hover:text-white hover:bg-white/10"
            : "bg-white/10 text-white hover:bg-white/20";
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          sizeCls,
          variantCls,
          active && "ring-2 ring-lime-300 ring-offset-2 ring-offset-black",
          className,
        )}
        {...props}
      />
    );
  },
);
