export function getAvailableNoteName(
  base: string,
  takenNames: string[],
): string {
  const taken = new Set(takenNames.map((name) => name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`.toLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
}
