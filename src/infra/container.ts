type Lifetime = "singleton" | "transient";
type Factory<T = unknown> = () => T;

interface Registration<T = unknown> {
  factory: Factory<T>;
  lifetime: Lifetime;
  instance?: T;
}

export class Container {
  private registrations = new Map<string, Registration>();

  register<T>(
    name: string,
    factory: Factory<T>,
    lifetime: Lifetime = "singleton",
  ): void {
    this.registrations.set(name, { factory, lifetime });
  }

  resolve<T>(name: string): T {
    const registration = this.registrations.get(name);
    if (!registration) throw new Error(`No registration found for: ${name}`);

    if (registration.lifetime === "singleton") {
      if (!registration.instance) {
        registration.instance = registration.factory();
      }
      return registration.instance as T;
    }

    return registration.factory() as T;
  }

  reset(): void {
    this.registrations.clear();
  }
}

export const container = new Container();
