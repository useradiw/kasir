export function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findIngredientByName<T extends { name: string }>(
  query: string,
  options: T[],
): T | null {
  const n = normName(query);
  if (!n) return null;
  return (
    options.find((o) => normName(o.name) === n) ??
    options.find((o) => normName(o.name).startsWith(n)) ??
    options.find((o) => normName(o.name).includes(n) || n.includes(normName(o.name))) ??
    null
  );
}
