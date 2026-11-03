import { afterEach, describe, expect, test, vi } from "vitest";
import { apiArtifactRepository } from "~/client/modules/artifacts/app/repositories/ApiArtifactRepository";
import { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";

const artifactId = "d8749e8c-57a9-4b9c-b6f7-392238f63312";
const timestamp = "2026-08-16T12:00:00.000Z";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiArtifactRepository", () => {
  test("parses a viewer document without executing or changing its HTML", async () => {
    const renderedHtml = "<!doctype html><main>Structured page</main>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          artifact: {
            id: artifactId,
            title: "Plan",
            visibility: "public",
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            renderedHtml: renderedHtml,
          },
        }),
      ),
    );

    await expect(
      apiArtifactRepository.getArtifact(artifactId),
    ).resolves.toMatchObject({ id: artifactId, renderedHtml });
  });

  test("sends visibility changes through the authenticated web API", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: artifactId,
        title: "Plan",
        visibility: "public",
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiArtifactRepository.changeVisibility(
      artifactId,
      ArtifactVisibility.Public,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/web/artifacts/${artifactId}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ visibility: "public" }),
      }),
    );
  });
});
