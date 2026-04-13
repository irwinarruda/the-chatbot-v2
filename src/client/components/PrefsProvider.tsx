import { useRouter } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { Locale } from "~/client/i18n";

export type Theme = "light" | "dark";

interface PrefsContextValue {
  locale: Locale;
  theme: Theme;
  toggleTheme: () => void;
  toggleLocale: () => void;
}

const PrefsContext = createContext<PrefsContextValue | undefined>(undefined);

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) {
    throw new Error("usePrefs must be used within PrefsProvider");
  }
  return ctx;
}

function setCookie(name: string, value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: simple cookie setter for theme/locale persistence
  document.cookie = `${name}=${value};path=/;max-age=31536000;SameSite=Lax`;
}

export function PrefsProvider({
  initialLocale,
  initialTheme,
  children,
}: {
  initialLocale: Locale;
  initialTheme: Theme;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setCookie("theme", next);
    setTheme(next);
  };

  const router = useRouter();

  const toggleLocale = () => {
    const next: Locale = locale === "pt-BR" ? "en" : "pt-BR";
    setCookie("locale", next);
    setLocale(next);
    router.invalidate();
  };

  return (
    <PrefsContext.Provider
      value={{
        locale,
        theme,
        toggleTheme,
        toggleLocale,
      }}
    >
      {children}
    </PrefsContext.Provider>
  );
}
