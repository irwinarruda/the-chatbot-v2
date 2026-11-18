export const GoogleAuthScopes = {
  openId: "openid",
  email: "https://www.googleapis.com/auth/userinfo.email",
  profile: "https://www.googleapis.com/auth/userinfo.profile",
  driveFile: "https://www.googleapis.com/auth/drive.file",
} as const;

export function buildScopes(): string[] {
  return [
    GoogleAuthScopes.driveFile,
    GoogleAuthScopes.openId,
    GoogleAuthScopes.email,
    GoogleAuthScopes.profile,
  ];
}
