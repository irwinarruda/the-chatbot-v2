import { z } from "zod";

export const DeleteUserByChatChannelAddressToolDTO = z.object({});

export type DeleteUserByChatChannelAddressToolDTO = z.infer<
  typeof DeleteUserByChatChannelAddressToolDTO
>;
