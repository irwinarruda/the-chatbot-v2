import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MetaWhatsAppMessagingGateway } from "~/modules/chat/gateway/WhatsAppMessagingGateway/MetaWhatsAppMessagingGateway";

const appSecret = "test-app-secret";
const gateway = new MetaWhatsAppMessagingGateway({
  accountId: "test-account-id",
  businessId: "test-business-id",
  appName: "test-app",
  accessToken: "test-access-token",
  phoneNumberId: "test-phone-number-id",
  version: "v1",
  webhookVerifyToken: "test-webhook-token",
  appSecret,
});

describe("MetaWhatsAppMessagingGateway signatures", () => {
  test("accepts a valid signature and rejects a changed body", () => {
    const body = '{"entry":[]}';
    const hash = createHmac("sha256", appSecret).update(body).digest("hex");
    const signature = `sha256=${hash}`;

    expect(gateway.validateSignature(signature, body)).toBe(true);
    expect(gateway.validateSignature(signature, `${body} `)).toBe(false);
  });

  test.each([
    "",
    "sha256=",
    "sha256=abc",
    `sha256=${"a".repeat(63)}`,
    `sha256=${"a".repeat(65)}`,
    `sha256=${"g".repeat(64)}`,
    `sha1=${"a".repeat(64)}`,
    `sha256=${"a".repeat(64)}=extra`,
  ])("rejects a malformed signature without throwing: %s", (signature) => {
    expect(gateway.validateSignature(signature, "{}")).toBe(false);
  });
});

function webhook(
  message: unknown,
  contact: unknown = { wa_id: "551184444444" },
) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "test-phone-number-id" },
              contacts: [contact],
              messages: [message],
            },
          },
        ],
      },
    ],
  };
}

describe("MetaWhatsAppMessagingGateway incoming messages", () => {
  test.each([
    [{ text: { body: "hello" } }, { text: "hello" }],
    [
      { audio: { id: "media-1", mime_type: "audio/ogg" } },
      { mediaId: "media-1", mimeType: "audio/ogg" },
    ],
    [
      { interactive: { button_reply: { id: "button-1", title: "Yes" } } },
      { buttonReply: "Yes" },
    ],
  ])("maps supported provider content %j", (content, expected) => {
    const result = gateway.receiveWhatsAppMessage(
      webhook({ id: "message-1", ...content }),
    );
    expect(result).toEqual({
      fromAddress: "5511984444444",
      whatsAppBsuid: undefined,
      channelMessageId: "message-1",
      channel: "WhatsApp",
      ...expected,
    });
  });

  test("prefers the normalized phone address and preserves the message BSUID", () => {
    const result = gateway.receiveWhatsAppMessage(
      webhook(
        {
          id: "message-1",
          from_user_id: "BR.message-user",
          text: { body: "hello" },
        },
        { wa_id: "551184444444", user_id: "BR.contact-user" },
      ),
    );
    expect(result).toMatchObject({
      fromAddress: "5511984444444",
      whatsAppBsuid: "BR.message-user",
    });
  });

  test("accepts a contact BSUID when no phone address is shared", () => {
    const result = gateway.receiveWhatsAppMessage(
      webhook(
        { id: "message-1", text: { body: "hello" } },
        { user_id: "BR.contact-user" },
      ),
    );
    expect(result).toMatchObject({
      fromAddress: "BR.contact-user",
      whatsAppBsuid: "BR.contact-user",
    });
  });

  test.each([
    null,
    {},
    { entry: [] },
    { entry: "wrong-type" },
    webhook({ text: { body: "missing message id" } }),
    webhook({ id: "message-1", text: { body: 123 } }),
    webhook({ id: "message-1", audio: { id: "media-1" } }),
    webhook({
      id: "message-1",
      interactive: { button_reply: { title: false } },
    }),
    webhook({ id: "message-1", text: { body: "hello" } }, { wa_id: 123 }),
    webhook({ id: "message-1", text: { body: "hello" } }, {}),
    webhook({ id: "message-1", image: { id: "unsupported" } }),
  ])(
    "ignores malformed or unsupported payloads without throwing: %j",
    (payload) => {
      expect(gateway.receiveWhatsAppMessage(payload)).toBeUndefined();
    },
  );

  test("ignores delivery receipts and another configured phone number", () => {
    const receipt = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "test-phone-number-id" },
                statuses: [{ id: "message-1", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    expect(gateway.receiveWhatsAppMessage(receipt)).toBeUndefined();
    const otherPhone = webhook({ id: "message-1", text: { body: "hello" } });
    otherPhone.entry[0].changes[0].value.metadata.phone_number_id =
      "other-phone";
    expect(gateway.receiveWhatsAppMessage(otherPhone)).toBeUndefined();
  });
});

describe("MetaWhatsAppMessagingGateway media metadata", () => {
  afterEach(() => vi.unstubAllGlobals());

  test.each([{}, { url: 123 }, { url: "not-a-url" }])(
    "rejects malformed metadata before requesting media: %j",
    async (metadata) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(metadata)));
      vi.stubGlobal("fetch", fetch);
      await expect(gateway.downloadMediaAsync("media-1")).rejects.toThrow(
        "missing or invalid 'url'",
      );
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  test("downloads a validated media URL with the provider credential", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: "https://media.example/audio" })),
      )
      .mockResolvedValueOnce(new Response("audio-bytes"));
    vi.stubGlobal("fetch", fetch);
    await expect(gateway.downloadMediaAsync("media-1")).resolves.toEqual(
      Buffer.from("audio-bytes"),
    );
    expect(fetch).toHaveBeenLastCalledWith("https://media.example/audio", {
      headers: { Authorization: "Bearer test-access-token" },
    });
  });
});
