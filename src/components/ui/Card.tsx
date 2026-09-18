import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function Card({ children, className, title, description }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl",
        className,
      )}
    >
      {title && (
        <div className="mb-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs text-white/40">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
