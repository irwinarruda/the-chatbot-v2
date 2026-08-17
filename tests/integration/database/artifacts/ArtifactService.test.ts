import { beforeEach, describe, expect, test } from "vitest";
import { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";
import { ArtifactService } from "~/modules/artifacts/services/ArtifactService";
import { compileArtifactHtml } from "~/modules/artifacts/utils/ArtifactHtmlCompiler";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "~/shared/errors/ApplicationErrors";
import { orquestrator } from "~/tests/orquestrator";

describe("ArtifactService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  test("publishes, replaces, scopes, and shares compiled HTML", async () => {
    const user = await orquestrator.createUser();
    const otherUser = await orquestrator.createUser();
    const credentials = await orquestrator.artifactService.rotateUploadToken(
      user.id,
    );
    const uploaderId =
      await orquestrator.artifactService.authenticateUploadToken(
        credentials.token,
      );
    const created = await orquestrator.artifactService.publishArtifact(
      uploaderId,
      {
        title: "Release plan",
        html: `<style>.card { color: #50dfaa; }</style><main class="card"><pre><code class="language-json">{"ready":true}</code></pre></main>`,
        visibility: ArtifactVisibility.Private,
      },
    );

    expect(created.renderedHtml).toContain("script-src 'none'");
    expect(created.renderedHtml).toContain("shiki github-dark");
    await expect(
      orquestrator.artifactService.getArtifactForViewer(created.id),
    ).rejects.toThrow(NotFoundException);
    await expect(
      orquestrator.artifactService.getArtifactForViewer(
        created.id,
        otherUser.id,
      ),
    ).rejects.toThrow(NotFoundException);
    await expect(
      orquestrator.artifactService.getArtifactForViewer(created.id, user.id),
    ).resolves.toMatchObject({ id: created.id });

    const replaced = await orquestrator.artifactService.replaceArtifact(
      uploaderId,
      created.id,
      {
        title: "Public release plan",
        html: "<main>Ready to share</main>",
        visibility: ArtifactVisibility.Public,
      },
    );

    expect(replaced).toMatchObject({
      id: created.id,
      version: 2,
      visibility: ArtifactVisibility.Public,
    });
    await expect(
      orquestrator.artifactService.getArtifactForViewer(created.id),
    ).resolves.toMatchObject({ title: "Public release plan" });
    await expect(
      orquestrator.artifactService.listArtifacts(user.id),
    ).resolves.toHaveLength(1);
  });

  test("stores only a token hash and revokes publishing access", async () => {
    const user = await orquestrator.createUser();
    const credentials = await orquestrator.artifactService.rotateUploadToken(
      user.id,
    );
    const rows = await orquestrator.database.sql<
      Array<{ token_hash: Buffer }>
    >`SELECT token_hash FROM artifact_upload_tokens WHERE id_user = ${user.id}`;

    expect(rows[0]?.token_hash).toHaveLength(32);
    expect(rows[0]?.token_hash.toString("utf8")).not.toContain(
      credentials.token,
    );

    await orquestrator.artifactService.revokeUploadToken(user.id);

    await expect(
      orquestrator.artifactService.authenticateUploadToken(credentials.token),
    ).rejects.toThrow(UnauthorizedException);
  });

  test("rejects one of two concurrent replacements", async () => {
    const user = await orquestrator.createUser();
    const credentials = await orquestrator.artifactService.rotateUploadToken(
      user.id,
    );
    const uploaderId =
      await orquestrator.artifactService.authenticateUploadToken(
        credentials.token,
      );
    const created = await orquestrator.artifactService.publishArtifact(
      uploaderId,
      {
        title: "Concurrent plan",
        html: "<main>First</main>",
        visibility: ArtifactVisibility.Private,
      },
    );

    let signalCompilationStarted = () => {};
    let releaseCompilation = () => {};
    const compilationStarted = new Promise<void>((resolve) => {
      signalCompilationStarted = resolve;
    });
    const compilationReleased = new Promise<void>((resolve) => {
      releaseCompilation = resolve;
    });
    const delayedService = new ArtifactService(
      orquestrator.database,
      async (sourceHtml, title) => {
        signalCompilationStarted();
        await compilationReleased;
        return compileArtifactHtml(sourceHtml, title);
      },
    );
    const staleReplacement = delayedService.replaceArtifact(
      uploaderId,
      created.id,
      {
        title: "Replacement A",
        html: "<main>Replacement A</main>",
        visibility: ArtifactVisibility.Private,
      },
    );
    await compilationStarted;
    await orquestrator.artifactService.replaceArtifact(uploaderId, created.id, {
      title: "Replacement B",
      html: "<main>Replacement B</main>",
      visibility: ArtifactVisibility.Private,
    });
    releaseCompilation();

    await expect(staleReplacement).rejects.toBeInstanceOf(ConflictException);
    await expect(
      orquestrator.artifactService.getArtifactForViewer(created.id, user.id),
    ).resolves.toMatchObject({ version: 2 });
  });

  test("visibility changes preserve the current document and version", async () => {
    const user = await orquestrator.createUser();
    const credentials = await orquestrator.artifactService.rotateUploadToken(
      user.id,
    );
    const uploaderId =
      await orquestrator.artifactService.authenticateUploadToken(
        credentials.token,
      );
    const created = await orquestrator.artifactService.publishArtifact(
      uploaderId,
      {
        title: "Visibility plan",
        html: "<main>First</main>",
        visibility: ArtifactVisibility.Private,
      },
    );
    const replaced = await orquestrator.artifactService.replaceArtifact(
      uploaderId,
      created.id,
      {
        title: "Visibility plan v2",
        html: "<main>Second</main>",
        visibility: ArtifactVisibility.Private,
      },
    );

    const updated = await orquestrator.artifactService.changeVisibility(
      user.id,
      created.id,
      ArtifactVisibility.Public,
    );

    expect(updated).toMatchObject({
      version: 2,
      visibility: ArtifactVisibility.Public,
      renderedHtml: replaced.renderedHtml,
    });
  });
});
