import {
  ArtifactValidationDetailsDTO,
  type ArtifactViolationDTO,
} from "~/domain/artifacts/artifact-validation";
import { AppError } from "~/server/shared/errors/application-errors";

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
