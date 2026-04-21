export const GoogleAuthScopes = {
  openId: "openid",
  email: "https://www.googleapis.com/auth/userinfo.email",
  profile: "https://www.googleapis.com/auth/userinfo.profile",
  spreadsheets: "https://www.googleapis.com/auth/spreadsheets",
} as const;

export function buildScopes(): string[] {
  return [
    GoogleAuthScopes.spreadsheets,
    GoogleAuthScopes.openId,
    GoogleAuthScopes.email,
    GoogleAuthScopes.profile,
  ];
}
