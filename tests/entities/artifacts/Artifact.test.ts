import { describe, expect, test } from "vitest";
import { Artifact } from "~/modules/artifacts/entities/Artifact";
import { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";
import { ValidationException } from "~/shared/errors/DomainErrors";

describe("Artifact", () => {
  test("replaces its document while preserving identity and incrementing version", () => {
    const artifact = new Artifact({
      idUser: crypto.randomUUID(),
      title: "Architecture",
      visibility: ArtifactVisibility.Private,
      sourceHtml: "<main>First</main>",
      renderedHtml: "<!doctype html><main>First</main>",
      rendererVersion: "static-html-v1",
    });
    const id = artifact.id;

    artifact.replace({
      title: "Architecture v2",
      visibility: ArtifactVisibility.Public,
      sourceHtml: "<main>Second</main>",
      renderedHtml: "<!doctype html><main>Second</main>",
      rendererVersion: "static-html-v1",
    });

    expect(artifact).toMatchObject({
      id,
      title: "Architecture v2",
      visibility: ArtifactVisibility.Public,
      version: 2,
    });
  });

  test("requires an owner, title, source, and rendered document", () => {
    const valid = {
      idUser: crypto.randomUUID(),
      title: "Artifact",
      visibility: ArtifactVisibility.Private,
      sourceHtml: "<main>Content</main>",
      renderedHtml: "<!doctype html><main>Content</main>",
      rendererVersion: "static-html-v1",
    };

    expect(() => new Artifact({ ...valid, idUser: "" })).toThrow(
      ValidationException,
    );
    expect(() => new Artifact({ ...valid, title: " " })).toThrow(
      ValidationException,
    );
    expect(() => new Artifact({ ...valid, sourceHtml: " " })).toThrow(
      ValidationException,
    );
    const artifact = new Artifact(valid);
    expect(() =>
      artifact.replace({
        title: "Blank replacement",
        visibility: ArtifactVisibility.Private,
        sourceHtml: " ",
        renderedHtml: "<!doctype html><main></main>",
        rendererVersion: "static-html-v1",
      }),
    ).toThrow(ValidationException);
  });
});
