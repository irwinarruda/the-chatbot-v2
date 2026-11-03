import { DeleteUserByChatChannelAddressToolDTO } from "~/contracts/tools/identity/delete-user-by-chat-channel-address";
import type { AccountsService } from "~/server/modules/accounts/services/accounts.service";
import {
  type RegisteredTool,
  requireToolUser,
} from "~/server/modules/chat/services/tool-executor.service";
import type { AuthService } from "~/server/modules/identity/services/auth.service";

export function createAccountTools(
  auth: AuthService,
  accounts: AccountsService,
): RegisteredTool[] {
  return [
    {
      name: "delete_user_by_chat_channel_address",
      description:
        "Delete the current user and all related data. Returns { message }.",
      inputSchema: DeleteUserByChatChannelAddressToolDTO,
      mutating: true,
      run: async (args, context) => {
        DeleteUserByChatChannelAddressToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        await accounts.deleteAccount(user.id, context.chat.getChannelAddress());
        return { message: "The account was deleted successfully" };
      },
    },
  ];
}
