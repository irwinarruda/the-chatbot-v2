import { v4 as uuidv4 } from "uuid";
import { ValidationException } from "~/infra/exceptions";
import { Credential } from "~/shared/entities/Credentials";
import { CredentialType } from "~/shared/entities/enums/CredentialType";
import { PhoneNumberUtils } from "~/shared/entities/PhoneNumberUtils";

export class User {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  isInactive: boolean;
  createdAt: Date;
  updatedAt: Date;
  googleCredential?: Credential;

  constructor(name?: string, phoneNumber?: string, email?: string) {
    this.id = uuidv4();
    this.isInactive = false;
    this.name = "";
    this.phoneNumber = "";
    this.email = email;
    this.googleCredential = undefined;
    this.createdAt = new Date();
    this.updatedAt = new Date();

    if (name !== undefined && phoneNumber !== undefined) {
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

  updateEmail(email: string): void {
    this.email = email;
    this.updatedAt = new Date();
  }

  createGoogleCredential(
    accessToken: string,
    refreshToken: string,
    expiresInSeconds?: number,
  ) {
    const googleCredential = new Credential(expiresInSeconds);
    googleCredential.idUser = this.id;
    googleCredential.accessToken = accessToken;
    googleCredential.refreshToken = refreshToken;
    googleCredential.type = CredentialType.Google;
    this.googleCredential = googleCredential;
  }

  addGoogleCredential(
    googleCredential: Credential,
  ): asserts this is User & { googleCredential: Credential } {
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
    if (!this.googleCredential) {
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
