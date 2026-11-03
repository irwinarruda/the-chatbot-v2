import type { Status } from "~/domain/system/status";
import { StatusResponseDTO } from "./status";

export function toStatusResponse(status: Status): StatusResponseDTO {
  return StatusResponseDTO.parse({
    updatedAt: status.updatedAt.toISOString(),
    database: status.database,
    ai: status.ai,
    deployment: status.deployment,
  });
}
