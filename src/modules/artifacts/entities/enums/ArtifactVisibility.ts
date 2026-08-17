export const ArtifactVisibility = {
  Private: "private",
  Public: "public",
} as const;

export type ArtifactVisibility = ValueOf<typeof ArtifactVisibility>;
