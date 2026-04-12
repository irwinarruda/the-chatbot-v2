"use client";

import { usePrefs } from "~/components/PrefsProvider";

export function ThemeLogo() {
  const { theme } = usePrefs();
  const src = theme === "dark" ? "/logo.svg" : "/logo-light.svg";

  return (
    <img
      className="terminal-logo"
      src={src}
      alt="The Chatbot"
      aria-label="The Chatbot"
    />
  );
}
