import { usePrefs } from "~/client/shared/hooks/usePrefs";

export function ThemeLogo() {
  const prefs = usePrefs();
  const src = prefs.theme === "dark" ? "/logo.svg" : "/logo-light.svg";

  return (
    <img
      className="terminal-logo-glow mb-4 block size-12"
      src={src}
      alt="The Chatbot"
    />
  );
}
