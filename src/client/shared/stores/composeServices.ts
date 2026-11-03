type Composed<Services extends object[]> = Services extends [
  infer First,
  ...infer Rest extends object[],
]
  ? First & Composed<Rest>
  : unknown;

export function composeServices<Services extends object[]>(
  ...services: Services
): Composed<Services> {
  const composed: Record<string, unknown> = {};
  for (const service of services) {
    for (const [key, value] of Object.entries(
      Object.getOwnPropertyDescriptors(service),
    )) {
      if (key in composed) {
        throw new Error(`Two services define the store key "${key}"`);
      }
      Object.defineProperty(composed, key, value);
    }
  }
  return composed as Composed<Services>;
}
