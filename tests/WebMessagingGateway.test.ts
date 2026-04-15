import type { WebChatEvent } from "~/resources/IWebMessagingGateway";
import { WebMessagingGateway } from "~/resources/WebMessagingGateway";

function withTimeout<T>(promise: Promise<T>, timeoutMs = 100): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

describe("WebMessagingGateway", () => {
  test("broadcasts events to every active subscriber of the same phone", async () => {
    const gateway = new WebMessagingGateway();
    const phoneNumber = "5511912345678";
    const event: WebChatEvent = {
      type: "text",
      data: {
        to: phoneNumber,
        text: "Processing your audio...",
      },
    };

    const firstController = new AbortController();
    const secondController = new AbortController();
    const firstSubscriber = gateway.subscribe(
      phoneNumber,
      firstController.signal,
    );
    const secondSubscriber = gateway.subscribe(
      phoneNumber,
      secondController.signal,
    );

    const firstNext = firstSubscriber.next();
    const secondNext = secondSubscriber.next();

    gateway.enqueue(phoneNumber, event);

    await expect(withTimeout(firstNext)).resolves.toEqual({
      done: false,
      value: event,
    });
    await expect(withTimeout(secondNext)).resolves.toEqual({
      done: false,
      value: event,
    });

    firstController.abort();
    secondController.abort();

    await expect(firstSubscriber.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
    await expect(secondSubscriber.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });

  test("replays queued events to the next subscriber when nobody is connected", async () => {
    const gateway = new WebMessagingGateway();
    const phoneNumber = "5511912345678";
    const event: WebChatEvent = {
      type: "text",
      data: {
        to: phoneNumber,
        text: "hello from backlog",
      },
    };

    gateway.enqueue(phoneNumber, event);

    const controller = new AbortController();
    const subscriber = gateway.subscribe(phoneNumber, controller.signal);

    await expect(withTimeout(subscriber.next())).resolves.toEqual({
      done: false,
      value: event,
    });

    controller.abort();

    await expect(subscriber.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });
});
