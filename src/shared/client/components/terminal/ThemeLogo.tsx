import { usePrefs } from "~/shared/client/providers/usePrefs";

export function ThemeLogo() {
  const prefs = usePrefs();
  const src = prefs.theme === "dark" ? "/logo.svg" : "/logo-light.svg";

  return (
    <img
      className="terminal-logo-glow mx-auto mb-4 block size-12 sm:size-14"
      src={src}
      alt="The Chatbot"
    />
  );
}
