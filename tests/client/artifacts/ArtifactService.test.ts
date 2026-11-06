import { describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import type { ArtifactRepository } from "~/client/modules/artifacts/app/repositories/ArtifactRepository";
import {
  type ArtifactService,
  createArtifactService,
} from "~/client/modules/artifacts/app/services/ArtifactService";
import { container } from "~/client/shared/container";
import { ApiError } from "~/client/shared/error/ApiError";
import type {
  ArtifactDTO,
  ArtifactViewerDTO,
} from "~/contracts/http/artifacts/artifact";
import { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";
import { createDeferred } from "~/tests/support/create-deferred";

const privateArtifact: ArtifactDTO = {
  id: "8c9d6f53-5c4f-4f4e-9b2f-0d2f2d3b8c11",
  title: "Report",
  visibility: ArtifactVisibility.Private,
  version: 1,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

function viewerOf(artifact: ArtifactDTO): ArtifactViewerDTO {
  return { ...artifact, renderedHtml: "<p>Report</p>" };
}

function createRepository(): ArtifactRepository {
  return {
    listArtifacts: vi.fn(async () => [privateArtifact]),
    getArtifact: vi.fn(async () => viewerOf(privateArtifact)),
    changeVisibility: vi.fn(async (_id, visibility) => ({
      ...privateArtifact,
      visibility,
    })),
    deleteArtifact: vi.fn(async () => {}),
    getUploadTokenStatus: vi.fn(async () => ({ configured: false })),
    rotateUploadToken: vi.fn(async () => ({
      configured: true,
      token: "tca_secret",
      createdAt: "2026-11-01T12:00:00.000Z",
    })),
    revokeUploadToken: vi.fn(async () => {}),
  };
}

function createStore(repository: ArtifactRepository) {
  container.register("ArtifactRepository", repository);
  return create<ArtifactService>()(createArtifactService);
}

describe("ArtifactService", () => {
  test("toggling visibility replaces the artifact with the server's version", async () => {
    const store = createStore(createRepository());
    await store.getState().loadArtifacts();
    await store.getState().toggleArtifactVisibility(privateArtifact);
    expect(store.getState().artifacts[0]?.visibility).toBe(
      ArtifactVisibility.Public,
    );
    expect(store.getState().isArtifactSubmitting).toBe(false);
  });

  test("a failed delete keeps the artifact and keeps the server error", async () => {
    const repository = createRepository();
    const failure = new ApiError("Artifact not found", 404);
    vi.mocked(repository.deleteArtifact).mockRejectedValueOnce(failure);
    const store = createStore(repository);
    await store.getState().loadArtifacts();
    await store.getState().deleteArtifact(privateArtifact.id);
    expect(store.getState().artifacts).toEqual([privateArtifact]);
    expect(store.getState().artifactError).toBe(failure);
  });

  test("a rotated token is revealed once and hidden on the next load", async () => {
    const store = createStore(createRepository());
    await store.getState().loadUploadTokenStatus();
    await store.getState().rotateUploadToken();
    expect(store.getState().revealedUploadToken).toBe("tca_secret");
    await store.getState().loadUploadTokenStatus();
    expect(store.getState().revealedUploadToken).toBeUndefined();
  });

  test("viewing another artifact ignores the slower previous response", async () => {
    const repository = createRepository();
    const first = createDeferred<ArtifactViewerDTO>();
    const second = { ...viewerOf(privateArtifact), title: "Second" };
    vi.mocked(repository.getArtifact)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(second);
    const store = createStore(repository);
    const firstView = store.getState().viewArtifact("first");
    await store.getState().viewArtifact("second");
    first.resolve(viewerOf(privateArtifact));
    await firstView;
    expect(store.getState().viewedArtifact?.title).toBe("Second");
  });
});

describe("ArtifactService token lifecycle", () => {
  test("a status that arrives after a rotation does not overwrite it", async () => {
    const repository = createRepository();
    const late = createDeferred<{ configured: boolean }>();
    vi.mocked(repository.getUploadTokenStatus)
      .mockResolvedValueOnce({ configured: false })
      .mockReturnValueOnce(late.promise);
    const store = createStore(repository);
    await store.getState().loadUploadTokenStatus();
    const reload = store.getState().loadUploadTokenStatus();
    expect(store.getState().uploadTokenStatus).toBeUndefined();
    store.setState({ uploadTokenStatus: { configured: false } });
    await store.getState().rotateUploadToken();
    late.resolve({ configured: false });
    await reload;
    expect(store.getState().uploadTokenStatus?.configured).toBe(true);
    expect(store.getState().revealedUploadToken).toBe("tca_secret");
  });

  test("leaving the viewer clears the artifact so the next one starts empty", async () => {
    const store = createStore(createRepository());
    await store.getState().viewArtifact(privateArtifact.id);
    store.getState().closeArtifact();
    expect(store.getState().viewedArtifact).toBeUndefined();
  });
});
