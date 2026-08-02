import { z } from "zod";

export const AiModelPreferenceDTO = z.object({
  idUser: z.uuid(),
  providerId: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(255),
});

export type AiModelPreferenceDTO = z.infer<typeof AiModelPreferenceDTO>;
