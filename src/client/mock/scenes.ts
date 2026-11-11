export const SceneViewport = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
} as const;

export type SceneViewport = keyof typeof SceneViewport;

export interface Scene {
  path: string;
  theme: "dark" | "light";
  viewport: SceneViewport;
  waitFor: string;
}

export const Scenes: Record<string, Scene> = {
  "chat-dark": {
    path: "/chat",
    theme: "dark",
    viewport: "desktop",
    waitFor: "Yes, mark it paid",
  },
  "chat-light": {
    path: "/chat",
    theme: "light",
    viewport: "desktop",
    waitFor: "Yes, mark it paid",
  },
  todos: {
    path: "/todo",
    theme: "dark",
    viewport: "desktop",
    waitFor: "Renew passport",
  },
  notes: {
    path: "/notes",
    theme: "dark",
    viewport: "desktop",
    waitFor: "Lisbon trip",
  },
  "cash-flow": {
    path: "/cash-flow",
    theme: "dark",
    viewport: "desktop",
    waitFor: "Farmers market",
  },
  bills: {
    path: "/bills",
    theme: "light",
    viewport: "desktop",
    waitFor: "Electricity",
  },
};
