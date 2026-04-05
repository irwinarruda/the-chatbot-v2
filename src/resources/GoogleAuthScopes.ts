export const GoogleAuthScopes = {
  openId: "openid",
  email: "https://www.googleapis.com/auth/userinfo.email",
  profile: "https://www.googleapis.com/auth/userinfo.profile",
  spreadsheets: "https://www.googleapis.com/auth/spreadsheets",
  tasks: "https://www.googleapis.com/auth/tasks",
} as const;

export function buildScopes(): string[] {
  return [
    GoogleAuthScopes.spreadsheets,
    GoogleAuthScopes.tasks,
    GoogleAuthScopes.openId,
    GoogleAuthScopes.email,
    GoogleAuthScopes.profile,
  ];
}
