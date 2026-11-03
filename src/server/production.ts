import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import { GoogleCashFlowSpreadsheetGateway } from "~/server/modules/cash-flow/gateways/google.cash-flow-spreadsheet";
import { LocalWebMessagingGateway } from "~/server/modules/chat/gateways/local.web-messaging";
import { MetaWhatsAppMessagingGateway } from "~/server/modules/chat/gateways/meta.whatsapp-messaging";
import { OpenAiSpeechToTextGateway } from "~/server/modules/chat/gateways/openai.speech-to-text";
import { PiAiChatGateway } from "~/server/modules/chat/gateways/pi.ai-chat";
import { PostgresAiCredentialStore } from "~/server/modules/chat/gateways/postgres.ai-credential-store";
import { R2StorageGateway } from "~/server/modules/chat/gateways/r2.storage";
import { AiCredentialEncryption } from "~/server/modules/chat/utils/ai-credential-encryption";
import { GoogleAuthGateway } from "~/server/modules/identity/gateways/google.auth";
import { NodePgMigrationsGateway } from "~/server/modules/system/gateways/node-pg.migrations";
import { createServer, type Server } from "~/server/server";
import { loadConfig } from "~/server/shared/config/config";
import { Database } from "~/server/shared/database/postgres.database";

registerBunOAuthFlows();

let server: Server | undefined;

export function getServer(): Server {
  server ??= createProductionServer();
  return server;
}

function createProductionServer(): Server {
  const config = loadConfig(process.env);
  const database = new Database(config.database.connectionString);
  const aiCredentialEncryption = new AiCredentialEncryption(
    config.credentialEncryption.key,
  );
  return createServer(
    config,
    {
      database,
      aiChat: new PiAiChatGateway(config.ai, {
        create: (idUser) =>
          new PostgresAiCredentialStore(
            database,
            aiCredentialEncryption,
            idUser,
          ),
      }),
      cashFlowSpreadsheet: new GoogleCashFlowSpreadsheetGateway(
        config.google,
        config.googleSheets,
      ),
      googleAuth: new GoogleAuthGateway(config.google),
      migrations: new NodePgMigrationsGateway(database, config.database),
      speechToText: new OpenAiSpeechToTextGateway(config.openAi),
      storage: new R2StorageGateway(config.r2),
      webMessaging: new LocalWebMessagingGateway(),
      whatsAppMessaging: new MetaWhatsAppMessagingGateway(config.whatsApp),
    },
    { isDevelopment: import.meta.env.DEV },
  );
}
