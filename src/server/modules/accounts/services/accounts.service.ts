import type { User } from "~/domain/identity/user";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { ChatRepository } from "~/server/modules/chat/repositories/chat.repository";
import type { ChatDeliveryService } from "~/server/modules/chat/services/chat-delivery.service";
import type { AuthService } from "~/server/modules/identity/services/auth.service";

export class AccountsService {
  constructor(
    private auth: AuthService,
    private chats: ChatRepository,
    private delivery: ChatDeliveryService,
  ) {}

  async completeGoogleSignIn(state: string, code: string): Promise<User> {
    const { user, channelAddress, isNewUser } =
      await this.auth.handleGoogleRedirect(state, code);
    await this.linkChats(user);
    if (isNewUser) await this.delivery.sendSignedInMessage(channelAddress);
    return user;
  }

  async completeWebGoogleSignIn(code: string): Promise<string> {
    const user = await this.auth.handleWebGoogleRedirect(code);
    await this.linkChats(user);
    return this.auth.createWebToken(user);
  }

  async deleteAccount(idUser: string, channelAddress: string): Promise<void> {
    await this.auth.deleteUserById(idUser);
    await this.deleteChat(channelAddress);
  }

  async deleteAccountByChannelAddress(channelAddress: string): Promise<void> {
    await this.auth.deleteUserByChatChannelAddress(channelAddress);
    await this.deleteChat(channelAddress);
  }

  async deleteChat(channelAddress: string): Promise<void> {
    const chat = await this.chats.findByChannelAddress(channelAddress);
    if (!chat) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    chat.deleteChat();
    await this.chats.save(chat);
  }

  private async linkChats(user: User): Promise<void> {
    await this.chats.syncUserAddresses({
      idUser: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      bsuid: user.bsuid,
    });
  }
}
