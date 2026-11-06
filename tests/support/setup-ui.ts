import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { bootstrapAppContainer } from "~/client/shared/container/app";

beforeEach(() => {
  bootstrapAppContainer();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
