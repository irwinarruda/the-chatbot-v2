import { z } from "zod";

export const StatusResponseDTO = z.object({
  updatedAt: z.iso.datetime(),
  database: z.object({
    serverVersion: z.string().min(1),
    maxConnections: z.number().int().nonnegative(),
    openConnections: z.number().int().nonnegative(),
  }),
  ai: z.object({
    modelName: z.string().min(1),
  }),
  deployment: z.object({
    commitSha: z.string().min(1),
  }),
});

export type StatusResponseDTO = z.infer<typeof StatusResponseDTO>;
