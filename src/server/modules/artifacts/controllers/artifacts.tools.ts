import { toArtifactSummaryResponse } from "~/contracts/http/artifacts/artifact-mapper";
import { DeleteArtifactToolDTO } from "~/contracts/tools/artifacts/delete-artifact";
import { ListArtifactsToolDTO } from "~/contracts/tools/artifacts/list-artifacts";
import { PublishArtifactToolDTO } from "~/contracts/tools/artifacts/publish-artifact";
import { ReplaceArtifactToolDTO } from "~/contracts/tools/artifacts/replace-artifact";
import { SetArtifactVisibilityToolDTO } from "~/contracts/tools/artifacts/set-artifact-visibility";
import type { Artifact } from "~/domain/artifacts/artifact";
import { ToolRisk, ToolTopic } from "~/domain/chat/tool-exposure";
import type { ArtifactService } from "~/server/modules/artifacts/services/artifact.service";
import {
  type AiToolContext,
  type RegisteredTool,
  requireToolUser,
} from "~/server/modules/chat/services/tool-executor.service";
import type { AuthService } from "~/server/modules/identity/services/auth.service";

export function createArtifactTools(
  auth: AuthService,
  artifactService: ArtifactService,
): RegisteredTool[] {
  return [
    {
      name: "list_artifacts",
      description:
        "List the user's published HTML artifacts, newest first. Returns { count, artifacts: [ { id, title, visibility, version, createdAt, updatedAt, url } ] }.",
      inputSchema: ListArtifactsToolDTO,
      mutating: false,
      external: {
        topic: ToolTopic.Artifacts,
        risk: ToolRisk.Read,
        isExternalOnly: true,
      },
      run: async (args, context) => {
        ListArtifactsToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const artifacts = await artifactService.listArtifacts(user.id);
        return {
          count: artifacts.length,
          artifacts: artifacts.map((artifact) =>
            toArtifactToolResult(artifact, context),
          ),
        };
      },
    },
    {
      name: "publish_artifact",
      description: [
        "Publish a new self-contained HTML page as an artifact and get its link.",
        "Scripts are removed and the page is sandboxed, so use HTML and CSS only.",
        "Private artifacts open only for the signed-in owner; public ones open for anyone with the link.",
        "Returns { message, artifact: { id, title, visibility, version, createdAt, updatedAt, url } }.",
      ].join("\n"),
      inputSchema: PublishArtifactToolDTO,
      mutating: true,
      external: {
        topic: ToolTopic.Artifacts,
        risk: ToolRisk.Write,
        isExternalOnly: true,
      },
      run: async (args, context) => {
        const input = PublishArtifactToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const artifact = await artifactService.publishArtifact(user.id, input);
        return {
          message: "Artifact published",
          artifact: toArtifactToolResult(artifact, context),
        };
      },
    },
    {
      name: "replace_artifact",
      description: [
        "Replace the title and HTML of an existing artifact, keeping its link. Omit visibility to keep the current one.",
        "Send the complete new HTML; it replaces the whole page and bumps the version.",
        "Returns { message, artifact }.",
      ].join("\n"),
      inputSchema: ReplaceArtifactToolDTO,
      mutating: true,
      external: {
        topic: ToolTopic.Artifacts,
        risk: ToolRisk.Write,
        isExternalOnly: true,
      },
      run: async (args, context) => {
        const { artifact_id, ...input } = ReplaceArtifactToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const artifact = await artifactService.replaceArtifact(
          user.id,
          artifact_id,
          input,
        );
        return {
          message: "Artifact replaced",
          artifact: toArtifactToolResult(artifact, context),
        };
      },
    },
    {
      name: "set_artifact_visibility",
      description:
        "Make one artifact private or public without changing its content. Returns { message, artifact }.",
      inputSchema: SetArtifactVisibilityToolDTO,
      mutating: true,
      external: {
        topic: ToolTopic.Artifacts,
        risk: ToolRisk.Write,
        isExternalOnly: true,
      },
      run: async (args, context) => {
        const input = SetArtifactVisibilityToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const artifact = await artifactService.changeVisibility(
          user.id,
          input.artifact_id,
          input.visibility,
        );
        return {
          message: "Artifact visibility changed",
          artifact: toArtifactToolResult(artifact, context),
        };
      },
    },
    {
      name: "delete_artifact",
      description:
        "Permanently delete one artifact; its link stops working. Returns { message }.",
      inputSchema: DeleteArtifactToolDTO,
      mutating: true,
      external: {
        topic: ToolTopic.Artifacts,
        risk: ToolRisk.Destructive,
        isExternalOnly: true,
      },
      run: async (args, context) => {
        const input = DeleteArtifactToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        await artifactService.deleteArtifact(user.id, input.artifact_id);
        return { message: "Artifact deleted" };
      },
    },
  ];
}

function toArtifactToolResult(artifact: Artifact, context: AiToolContext) {
  const url = context.publicOrigin
    ? new URL(`/a/${artifact.id}`, context.publicOrigin).href
    : undefined;
  return { ...toArtifactSummaryResponse(artifact), url };
}
