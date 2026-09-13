import type { AuthService } from "~/modules/identity/services/AuthService";

export async function createAppGoogleLoginChallenge(
  authService: AuthService,
  channelAddress: string,
): Promise<string> {
  const loginUrl = await authService.getAppLoginUrl(channelAddress);
  const challenge = new URL(loginUrl).pathname.split("/").at(-1);
  if (!challenge) {
    throw new Error("App login URL must contain a challenge");
  }
  return challenge;
}

export async function createAppGoogleLoginState(
  authService: AuthService,
  channelAddress: string,
): Promise<string> {
  const challenge = await createAppGoogleLoginChallenge(
    authService,
    channelAddress,
  );
  const result = await authService.handleGoogleLogin(challenge);
  if (result.type !== "redirect") {
    throw new Error("App login must redirect to Google");
  }
  const state = new URL(result.url).searchParams.get("state");
  if (!state) {
    throw new Error("Google authorization URL must contain state");
  }
  return state;
}
