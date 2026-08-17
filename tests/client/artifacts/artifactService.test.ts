import { afterEach, describe, expect, test, vi } from "vitest";
import { artifactService } from "~/modules/artifacts/client/services/artifactService";
import { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";

const artifactId = "d8749e8c-57a9-4b9c-b6f7-392238f63312";
const timestamp = "2026-08-16T12:00:00.000Z";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("artifactService", () => {
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
            created_at: timestamp,
            updated_at: timestamp,
            rendered_html: renderedHtml,
          },
        }),
      ),
    );

    await expect(
      artifactService.getArtifact(artifactId),
    ).resolves.toMatchObject({ id: artifactId, renderedHtml });
  });

  test("sends visibility changes through the authenticated web API", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: artifactId,
        title: "Plan",
        visibility: "public",
        version: 1,
        created_at: timestamp,
        updated_at: timestamp,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await artifactService.changeVisibility(
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
