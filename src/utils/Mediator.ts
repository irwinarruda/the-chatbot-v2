export interface IMediator {
  send<T>(eventName: string, payload: T): Promise<void>;
  register<T>(
    eventName: string,
    handler: (payload: T) => Promise<void> | void,
  ): void;
}

export class Mediator implements IMediator {
  private handlers = new Map<
    string,
    ((...args: unknown[]) => Promise<void> | void)[]
  >();

  async send<T>(eventName: string, payload: T): Promise<void> {
    const handlers = this.handlers.get(eventName);
    if (!handlers) return;
    const tasks: Promise<void>[] = [];
    for (const handler of handlers) {
      const result = handler(payload);
      if (result instanceof Promise) {
        tasks.push(result);
      }
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  register<T>(
    eventName: string,
    handler: (payload: T) => Promise<void> | void,
  ): void {
    let handlerList = this.handlers.get(eventName);
    if (!handlerList) {
      handlerList = [];
      this.handlers.set(eventName, handlerList);
    }
    handlerList.push(handler as (...args: unknown[]) => Promise<void> | void);
  }
}
