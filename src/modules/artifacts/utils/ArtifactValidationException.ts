import {
  ArtifactValidationDetailsDTO,
  type ArtifactViolationDTO,
} from "~/modules/artifacts/entities/dtos/ArtifactValidationDTO";
import { AppError } from "~/shared/errors/ApplicationErrors";

export type ArtifactViolation = ArtifactViolationDTO;

export class ArtifactValidationException extends AppError {
  readonly violations: ArtifactViolation[];

  constructor(violations: ArtifactViolation[]) {
    const details = ArtifactValidationDetailsDTO.parse({ violations });
    super(
      "The artifact contains unsupported or unsafe HTML or CSS.",
      "Correct the reported violations and publish the artifact again.",
      "ArtifactValidationException",
      422,
      details,
    );
    this.violations = details.violations;
  }
}
