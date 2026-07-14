import { z } from "zod";

export const GetCurrentDateTimeToolDTO = z.object({}).strict();

export type GetCurrentDateTimeToolDTO = z.infer<
  typeof GetCurrentDateTimeToolDTO
>;
