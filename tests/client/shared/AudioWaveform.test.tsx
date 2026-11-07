import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { AudioWaveform } from "~/client/shared/components/AudioWaveform";

const mocked = vi.hoisted(() => ({
  prefs: { locale: "en", theme: "dark", palette: "terminal" } as Prefs,
  create: vi.fn(() => ({
    on: vi.fn(() => () => {}),
    destroy: vi.fn(),
    playPause: vi.fn(),
    getDuration: () => 0,
  })),
}));

vi.mock("wavesurfer.js", () => ({ default: { create: mocked.create } }));

vi.mock("~/client/shared/hooks/usePrefs", () => ({
  usePrefs: () => mocked.prefs,
}));

describe("AudioWaveform", () => {
  test("redraws the waveform in the new colors when the palette changes", () => {
    const { rerender } = render(<AudioWaveform src="/audio/note.ogg" />);
    const drawsBefore = mocked.create.mock.calls.length;

    mocked.prefs = { ...mocked.prefs, palette: "favo" };
    rerender(<AudioWaveform src="/audio/note.ogg" />);

    expect(mocked.create.mock.calls.length).toBe(drawsBefore + 1);
  });
});
