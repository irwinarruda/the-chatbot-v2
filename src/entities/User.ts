import { v4 as uuidv4 } from "uuid";
import { Credential } from "~/entities/Credentials";
import { CredentialType } from "~/entities/enums/CredentialType";
import { PhoneNumberUtils } from "~/entities/PhoneNumberUtils";
import { ValidationException } from "~/infra/exceptions";

export class User {
  id: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  isInactive: boolean;
  createdAt: Date;
  updatedAt: Date;
  googleCredential: Credential | undefined;

  constructor(name?: string, phoneNumber?: string) {
    this.id = uuidv4();
    this.isInactive = false;
    this.name = "";
    this.phoneNumber = "";
    this.email = null;
    this.googleCredential = undefined;
    this.createdAt = new Date();
    this.updatedAt = new Date();

    if (name != null && phoneNumber != null) {
      if (name.length >= 30) {
        throw new ValidationException(
          "User name cannot have more than 29 characters",
          "Chose another name and continue",
        );
      }
      const sanitized = PhoneNumberUtils.sanitize(phoneNumber);
      if (!PhoneNumberUtils.isValid(sanitized)) {
        throw new ValidationException(
          "User phone number is not valid",
          "Chose another phone number and continue",
        );
      }
      this.name = name;
      this.phoneNumber = sanitized;
    }
  }

  createGoogleCredential(
    accessToken: string,
    refreshToken: string,
    expiresInSeconds?: number,
  ): void {
    const googleCredential = new Credential(expiresInSeconds);
    googleCredential.idUser = this.id;
    googleCredential.accessToken = accessToken;
    googleCredential.refreshToken = refreshToken;
    googleCredential.type = CredentialType.Google;
    this.googleCredential = googleCredential;
  }

  addGoogleCredential(googleCredential: Credential): void {
    if (googleCredential.type !== CredentialType.Google) {
      throw new ValidationException("The credential must be from google");
    }
    this.googleCredential = googleCredential;
  }

  updateGoogleCredential(
    accessToken: string,
    refreshToken: string,
    expiresInSeconds?: number,
  ): void {
    if (this.googleCredential == null) {
      throw new ValidationException(
        "The user does not have credentials to be updated",
      );
    }
    this.googleCredential.update(accessToken, refreshToken, expiresInSeconds);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phoneNumber: this.phoneNumber,
    };
  }
}
