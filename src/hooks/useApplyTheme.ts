/**
 * Theme application — split into a separate file so React Fast Refresh
 * recognizes the export-only-functions pattern.
 */
import { useEffect } from "react";
import type { Settings } from "@/types/settings";

/**
 * Apply the theme to <html> element based on user settings.
 */
export function useApplyTheme(settings: Settings): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (theme: "light" | "dark") => {
      if (theme === "light") {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      } else {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      }
    };
    if (settings.appearance.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches ? "dark" : "light");
      const onChange = (e: MediaQueryListEvent) => apply(e.matches ? "dark" : "light");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    apply(settings.appearance.theme);
  }, [settings.appearance.theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.appearance.reducedMotion) {
      root.classList.add("reduce-motion");
    } else {
      root.classList.remove("reduce-motion");
    }
  }, [settings.appearance.reducedMotion]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.appearance.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
  }, [settings.appearance.highContrast]);
}
