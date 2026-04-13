import { z } from "zod";

export const databaseConfigSchema = z.object({
  connectionString: z.string().min(1),
  name: z.string().min(1),
  serverVersion: z.string().default(""),
});
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

export const encryptionConfigSchema = z.object({
  text32Bytes: z.string().min(1),
  text16Bytes: z.string().min(1),
});
export type EncryptionConfig = z.infer<typeof encryptionConfigSchema>;

export const googleConfigSchema = z.object({
  clientId: z.string().min(1),
  secretClientKey: z.string().min(1),

  redirectUri: z.string().min(1),
  loginUri: z.string().min(1),
  webRedirectUri: z.string().default(""),
  webLoginUri: z.string().default(""),
  serviceAccountId: z.string().default(""),
  serviceAccountPrivateKey: z.string().default(""),
  speechProjectId: z.string().default(""),
  speechRegion: z.string().default(""),
  speechRecognizerId: z.string().default(""),
  speechModel: z.string().default(""),
  speechLanguageCodes: z.array(z.string()).default(["pt-BR"]),
  speechEndpoint: z.string().default(""),
  applicationName: z.string().default(""),
});
export type GoogleConfig = z.infer<typeof googleConfigSchema>;

export const whatsAppConfigSchema = z.object({
  phoneNumberId: z.string().min(1),
  accountId: z.string().min(1),
  businessId: z.string().min(1),
  accessToken: z.string().min(1),
  appName: z.string().min(1),
  version: z.string().min(1),
  webhookVerifyToken: z.string().min(1),
  appSecret: z.string().min(1),
});
export type WhatsAppConfig = z.infer<typeof whatsAppConfigSchema>;

export const r2ConfigSchema = z.object({
  accountId: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucketName: z.string().min(1),
  publicUrl: z.string().min(1),
  serviceUrl: z.string().min(1),
});
export type R2Config = z.infer<typeof r2ConfigSchema>;

export const aiConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});
export type AiConfig = z.infer<typeof aiConfigSchema>;

export const openAiConfigSchema = z.object({
  apiKey: z.string().min(1),
  speechModel: z.string().default("whisper-1"),
});
export type OpenAiConfig = z.infer<typeof openAiConfigSchema>;

export const authConfigSchema = z.object({
  hashPassword: z.string().min(1),
});
export type AuthConfig = z.infer<typeof authConfigSchema>;

export const summarizationConfigSchema = z.object({
  messageCountThreshold: z.coerce.number().int().positive().default(20),
});
export type SummarizationConfig = z.infer<typeof summarizationConfigSchema>;

export const googleSheetsConfigSchema = z.object({
  testSheetId: z.string().default(""),
});
export type GoogleSheetsConfig = z.infer<typeof googleSheetsConfigSchema>;

export const jwtConfigSchema = z.object({
  secret: z.string().min(1),
  expiresIn: z.string().default("7d"),
});
export type JwtConfig = z.infer<typeof jwtConfigSchema>;

export const configSchema = z.object({
  database: databaseConfigSchema,
  encryption: encryptionConfigSchema,
  google: googleConfigSchema,
  whatsApp: whatsAppConfigSchema,
  r2: r2ConfigSchema,
  ai: aiConfigSchema,
  openAi: openAiConfigSchema,
  auth: authConfigSchema,
  summarization: summarizationConfigSchema,
  googleSheets: googleSheetsConfigSchema,
  jwt: jwtConfigSchema,
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  mode: z
    .enum(["local", "development", "test", "preview", "production", "tui"])
    .default("local"),
  port: z.coerce.number().default(3000),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    database: {
      connectionString: process.env.DATABASE_CONNECTION_STRING,
      name: process.env.DATABASE_NAME,
      serverVersion: process.env.DATABASE_SERVER_VERSION,
    },
    encryption: {
      text32Bytes: process.env.ENCRYPTION_TEXT_32_BYTES,
      text16Bytes: process.env.ENCRYPTION_TEXT_16_BYTES,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      secretClientKey: process.env.GOOGLE_SECRET_CLIENT_KEY,

      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      loginUri: process.env.GOOGLE_LOGIN_URI,
      webRedirectUri: process.env.GOOGLE_WEB_REDIRECT_URI,
      webLoginUri: process.env.GOOGLE_WEB_LOGIN_URI,
      serviceAccountId: process.env.GOOGLE_SERVICE_ACCOUNT_ID,
      serviceAccountPrivateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      speechProjectId: process.env.GOOGLE_SPEECH_PROJECT_ID,
      speechRegion: process.env.GOOGLE_SPEECH_REGION,
      speechRecognizerId: process.env.GOOGLE_SPEECH_RECOGNIZER_ID,
      speechModel: process.env.GOOGLE_SPEECH_MODEL,
      speechLanguageCodes: process.env.GOOGLE_SPEECH_LANGUAGE_CODES?.split(","),
      speechEndpoint: process.env.GOOGLE_SPEECH_ENDPOINT,
      applicationName: process.env.GOOGLE_APPLICATION_NAME,
    },
    whatsApp: {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accountId: process.env.WHATSAPP_ACCOUNT_ID,
      businessId: process.env.WHATSAPP_BUSINESS_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      appName: process.env.WHATSAPP_APP_NAME,
      version: process.env.WHATSAPP_VERSION,
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      appSecret: process.env.WHATSAPP_APP_SECRET,
    },
    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME,
      publicUrl: process.env.R2_PUBLIC_URL,
      serviceUrl: process.env.R2_SERVICE_URL,
    },
    ai: {
      provider: process.env.AI_PROVIDER,
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL,
    },
    openAi: {
      apiKey: process.env.OPENAI_API_KEY,
      speechModel: process.env.OPENAI_SPEECH_MODEL,
    },
    auth: {
      hashPassword: process.env.AUTH_HASH_PASSWORD,
    },
    summarization: {
      messageCountThreshold: process.env.SUMMARIZATION_MESSAGE_COUNT_THRESHOLD,
    },
    googleSheets: {
      testSheetId: process.env.GOOGLE_SHEETS_TEST_SHEET_ID,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
    nodeEnv: process.env.NODE_ENV,
    mode: process.env.MODE,
    port: process.env.PORT,
  });
}
