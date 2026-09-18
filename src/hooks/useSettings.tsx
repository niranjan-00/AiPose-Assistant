/**
 * useSettings — React context for user settings with IndexedDB persistence.
 *
 * Note: This file intentionally exports both a context, a Provider component,
 * and a hook together. React Fast Refresh warns about this pattern, but
 * splitting adds complexity without benefit for a tiny settings context.
 * The react-refresh rule is disabled for this file via inline comments.
 */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Settings } from "@/types/settings";
import { DEFAULT_SETTINGS } from "@/types/settings";
import { loadSettings, saveSettings } from "@/lib/storage/db";

export interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings> | ((prev: Settings) => Settings)) => void;
  reset: () => void;
  loading: boolean;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadSettings().then((s) => {
      if (!mounted) return;
      setSettings(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const update = useCallback(
    (patch: Partial<Settings> | ((prev: Settings) => Settings)) => {
      setSettings((prev) => {
        const next =
          typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update, reset, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside <SettingsProvider>");
  }
  return ctx;
}
