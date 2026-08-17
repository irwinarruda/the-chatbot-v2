import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ArtifactFrame } from "~/modules/artifacts/client/components/ArtifactFrame";

describe("ArtifactFrame", () => {
  test("renders the document with all iframe sandbox restrictions enabled", () => {
    const html = "<!doctype html><main>Artifact</main>";
    render(<ArtifactFrame html={html} title="Plan" />);

    const frame = screen.getByTitle("Plan");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(frame).toHaveAttribute("srcdoc", html);
    expect(frame).not.toHaveAttribute("allow");
  });
});
