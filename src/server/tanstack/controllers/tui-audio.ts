import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import os from "os";
import path from "path";
import { ValidationException } from "~/infra/exceptions";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { requireTuiGateway } from "~/infra/tui";
import type { ReceiveAudioMessageDTO } from "~/server/resources/IMessagingGateway";
import type { IWhatsAppMessagingGateway } from "~/server/resources/IWhatsAppMessagingGateway";
import type { MessagingService } from "~/server/services/MessagingService";
import { Http } from "~/server/utils/Http";
import { ChatType } from "~/shared/entities/enums/ChatType";

export const Route = createFileRoute("/api/v1/tui/audio")({
  server: {
    handlers: {
      async POST({ request }) {
        const rawGateway =
          ServerBootstrap.getService<IWhatsAppMessagingGateway>(
            "IWhatsAppMessagingGateway",
          );
        const gateway = requireTuiGateway(rawGateway);
        if (gateway instanceof Response) {
          return gateway;
        }
        const body = (await request.json()) as {
          phone_number: string;
          file_path: string;
          mime_type?: string;
        };
        const filePath = normalizeFilePath(body.file_path);
        if (!path.isAbsolute(filePath)) {
          throw new ValidationException(
            "File path must be absolute (or start with ~/)",
            "Provide an absolute file path and try again.",
          );
        }
        if (!fs.existsSync(filePath)) {
          throw new ValidationException(
            "Audio file not found",
            "Provide a valid audio file path and try again.",
          );
        }
        const mimeType = body.mime_type ?? getMimeType(filePath);
        if (!mimeType.startsWith("audio/")) {
          throw new ValidationException(
            "MimeType must be an audio type",
            "Provide a supported audio mime type and try again.",
          );
        }
        const fileBuffer = fs.readFileSync(filePath);
        const mediaId = await gateway.saveMediaAsync(Buffer.from(fileBuffer));
        const messagingService =
          ServerBootstrap.getService<MessagingService>("MessagingService");
        const dto: ReceiveAudioMessageDTO = {
          from: body.phone_number,
          mimeType,
          mediaId,
          chatType: ChatType.WhatsApp,
          idProvider: crypto.randomUUID(),
        };
        await messagingService.listenToMessage(dto);
        return Http.json({ status: "ok", mediaId });
      },
    },
  },
});

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".ogg":
      return "audio/ogg";
    case ".flac":
      return "audio/flac";
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".amr":
      return "audio/amr";
    case ".webm":
      return "audio/webm";
    default:
      return "application/octet-stream";
  }
}

function normalizeFilePath(filePath: string): string {
  const trimmedPath = filePath.trim();
  if (trimmedPath === "~") {
    return os.homedir();
  }
  if (trimmedPath.startsWith("~/")) {
    return path.join(os.homedir(), trimmedPath.slice(2));
  }
  return trimmedPath;
}
