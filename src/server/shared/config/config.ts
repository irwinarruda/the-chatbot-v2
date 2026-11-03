import { z } from "zod";

export const databaseConfigSchema = z.object({
  connectionString: z.string().min(1),
  name: z.string().min(1),
});
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

export const deploymentConfigSchema = z.object({
  commitSha: z.string().default("unknown"),
});
export type DeploymentConfig = z.infer<typeof deploymentConfigSchema>;

const credentialEncryptionKeySchema = z
  .base64()
  .refine(
    (value) => Buffer.from(value, "base64").length === 32,
    "The credential encryption key must decode to exactly 32 bytes",
  );

export const credentialEncryptionConfigSchema = z.object({
  key: credentialEncryptionKeySchema,
});
export type CredentialEncryptionConfig = z.infer<
  typeof credentialEncryptionConfigSchema
>;

export const googleConfigSchema = z.object({
  clientId: z.string().min(1),
  secretClientKey: z.string().min(1),
  redirectUri: z.string().min(1),
  loginUri: z.string().min(1),
  webRedirectUri: z.string().default(""),
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
  provider: z.string().min(1),
  apiKey: z.string().min(1).optional(),
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
  deployment: deploymentConfigSchema,
  credentialEncryption: credentialEncryptionConfigSchema,
  google: googleConfigSchema,
  whatsApp: whatsAppConfigSchema,
  r2: r2ConfigSchema,
  ai: aiConfigSchema,
  openAi: openAiConfigSchema,
  auth: authConfigSchema,
  googleSheets: googleSheetsConfigSchema,
  jwt: jwtConfigSchema,
  port: z.coerce.number().default(3000),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  return configSchema.parse({
    database: {
      connectionString: env.DATABASE_CONNECTION_STRING,
      name: env.DATABASE_NAME,
    },
    deployment: {
      commitSha: env.VERCEL_GIT_COMMIT_SHA,
    },
    credentialEncryption: {
      key: env.CREDENTIAL_ENCRYPTION_KEY,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      secretClientKey: env.GOOGLE_SECRET_CLIENT_KEY,
      redirectUri: env.GOOGLE_REDIRECT_URI,
      loginUri: env.GOOGLE_LOGIN_URI,
      webRedirectUri: env.GOOGLE_WEB_REDIRECT_URI,
      serviceAccountId: env.GOOGLE_SERVICE_ACCOUNT_ID,
      serviceAccountPrivateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      speechProjectId: env.GOOGLE_SPEECH_PROJECT_ID,
      speechRegion: env.GOOGLE_SPEECH_REGION,
      speechRecognizerId: env.GOOGLE_SPEECH_RECOGNIZER_ID,
      speechModel: env.GOOGLE_SPEECH_MODEL,
      speechLanguageCodes: env.GOOGLE_SPEECH_LANGUAGE_CODES?.split(","),
      speechEndpoint: env.GOOGLE_SPEECH_ENDPOINT,
      applicationName: env.GOOGLE_APPLICATION_NAME,
    },
    whatsApp: {
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      accountId: env.WHATSAPP_ACCOUNT_ID,
      businessId: env.WHATSAPP_BUSINESS_ID,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      appName: env.WHATSAPP_APP_NAME,
      version: env.WHATSAPP_VERSION,
      webhookVerifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      appSecret: env.WHATSAPP_APP_SECRET,
    },
    r2: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucketName: env.R2_BUCKET_NAME,
      publicUrl: env.R2_PUBLIC_URL,
      serviceUrl: env.R2_SERVICE_URL,
    },
    ai: {
      provider: env.AI_PROVIDER,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL,
    },
    openAi: {
      apiKey: env.OPENAI_API_KEY,
      speechModel: env.OPENAI_SPEECH_MODEL,
    },
    auth: {
      hashPassword: env.AUTH_HASH_PASSWORD,
    },
    googleSheets: {
      testSheetId: env.GOOGLE_SHEETS_TEST_SHEET_ID,
    },
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
    },
    port: env.PORT,
  });
}
