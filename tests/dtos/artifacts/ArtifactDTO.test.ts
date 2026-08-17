import { describe, expect, test } from "vitest";
import {
  ArtifactIdDTO,
  PublishArtifactRequestDTO,
} from "~/modules/artifacts/entities/dtos/ArtifactDTO";

describe("artifact contracts", () => {
  test("defaults new artifacts to private without trimming HTML", () => {
    const html = "  <!doctype html><main>Idea</main>\n";

    expect(
      PublishArtifactRequestDTO.parse({ title: "  Idea  ", html }),
    ).toEqual({ title: "Idea", html, visibility: "private" });
  });

  test("rejects oversized artifact source", () => {
    expect(() =>
      PublishArtifactRequestDTO.parse({
        title: "Large",
        html: "a".repeat(1_048_577),
      }),
    ).toThrow();
  });

  test("rejects blank and byte-oversized artifact source", () => {
    expect(() =>
      PublishArtifactRequestDTO.parse({ title: "Blank", html: " \n " }),
    ).toThrow();
    expect(() =>
      PublishArtifactRequestDTO.parse({
        title: "Large Unicode",
        html: "á".repeat(600_000),
      }),
    ).toThrow();
  });

  test("accepts only UUID artifact route identifiers", () => {
    expect(ArtifactIdDTO.parse("d8749e8c-57a9-4b9c-b6f7-392238f63312")).toBe(
      "d8749e8c-57a9-4b9c-b6f7-392238f63312",
    );
    expect(() => ArtifactIdDTO.parse("not-a-uuid")).toThrow();
  });
});
