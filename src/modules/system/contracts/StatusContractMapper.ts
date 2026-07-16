import { StatusResponseDTO } from "~/modules/system/entities/dtos/StatusDTO";
import type { Status } from "~/modules/system/entities/Status";

export function toStatusResponse(status: Status): StatusResponseDTO {
  return StatusResponseDTO.parse({
    updatedAt: status.updatedAt.toISOString(),
    database: status.database,
    ai: status.ai,
    deployment: status.deployment,
  });
}
