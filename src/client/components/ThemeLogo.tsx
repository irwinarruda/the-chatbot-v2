import { useApp } from "~/client/stores";

export function ThemeLogo() {
  const theme = useApp((s) => s.theme);
  const src = theme === "dark" ? "/logo.svg" : "/logo-light.svg";

  return (
    <img
      className="terminal-logo-glow mx-auto mb-4 block h-12 w-12 sm:h-16 sm:w-16"
      src={src}
      alt="The Chatbot"
      aria-label="The Chatbot"
    />
  );
}
